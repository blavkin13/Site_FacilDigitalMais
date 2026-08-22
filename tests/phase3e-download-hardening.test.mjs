import {
  after,
  before,
  describe,
  test,
} from "node:test";

import assert from "node:assert/strict";

import {
  readFileSync,
} from "node:fs";

import {
  writeFile,
} from "node:fs/promises";

import {
  join,
} from "node:path";

import {
  NextRequest,
} from "next/server";

import {
  PDFDocument,
} from "pdf-lib";

import {
  eq,
} from "drizzle-orm";

import {
  createIsolatedDatabase,
} from "./helpers/isolated-database.mjs";


function readProjectFile(
  ...segments
) {
  return readFileSync(
    join(
      process.cwd(),
      ...segments
    ),
    "utf8"
  );
}


function downloadRequest(
  token,
  sessionToken =
    null
) {
  const headers =
    new Headers();


  if (
    sessionToken
  ) {
    headers.set(
      "cookie",
      `fd-session=${sessionToken}`
    );
  }


  return new NextRequest(
    `http://localhost/api/download/${token}`,
    {
      method:
        "GET",

      headers,
    }
  );
}


function downloadContext(
  token
) {
  return {
    params:
      Promise.resolve({
        token,
      }),
  };
}


describe(
  "Fase 3E-A - Hardening de arquivos e downloads",
  () => {
    let isolated;

    let db;

    let schema;

    let pdfProtection;

    let downloadRoute;

    let owner;

    let otherUser;

    let ownerSession;

    let otherSession;

    let productId;

    let orderId;

    let protectedResult;

    let originalPdfPath;


    before(
      async () => {
        isolated =
          await createIsolatedDatabase();


        const auth =
          await import(
            "../lib/auth.ts"
          );


        const database =
          await import(
            "../db/index.ts"
          );


        schema =
          await import(
            "../db/schema.ts"
          );


        pdfProtection =
          await import(
            "../lib/pdf-protection.ts"
          );


        downloadRoute =
          await import(
            "../app/api/download/[token]/route.ts"
          );


        db =
          database.getDb();


        owner =
          await auth.registerUser(
            "comprador-3e@teste.local",
            "SenhaComprador3E123",
            "Comprador 3E",
            "52998224725"
          );


        otherUser =
          await auth.registerUser(
            "outro-3e@teste.local",
            "SenhaOutro3E123",
            "Outro Usuário 3E",
            "52998224725"
          );


        assert.ok(
          owner
        );


        assert.ok(
          otherUser
        );


        ownerSession =
          await auth.authenticateUser(
            "comprador-3e@teste.local",
            "SenhaComprador3E123"
          );


        otherSession =
          await auth.authenticateUser(
            "outro-3e@teste.local",
            "SenhaOutro3E123"
          );


        assert.ok(
          ownerSession
        );


        assert.ok(
          otherSession
        );


        const insertedProduct =
          await db
            .insert(
              schema.products
            )
            .values({
              slug:
                "apostila-download-3e",

              title:
                "Apostila Download 3E",

              price:
                79.9,

              active:
                true,
            })
            .returning();


        productId =
          insertedProduct[0].id;


        const insertedOrder =
          await db
            .insert(
              schema.orders
            )
            .values({
              userId:
                owner.id,

              status:
                "approved",

              subtotal:
                79.9,

              total:
                79.9,
            })
            .returning();


        orderId =
          insertedOrder[0].id;


        await db
          .insert(
            schema.orderItems
          )
          .values({
            orderId,

            productId,

            quantity:
              1,

            unitPrice:
              79.9,
          });


        originalPdfPath =
          join(
            isolated.rootDirectory,
            "original-3e.pdf"
          );


        const originalPdf =
          await PDFDocument.create();


        const page =
          originalPdf.addPage([
            595,
            842,
          ]);


        page.drawText(
          "Apostila de teste da Fase 3E",
          {
            x:
              50,

            y:
              750,

            size:
              18,
          }
        );


        await writeFile(
          originalPdfPath,
          await originalPdf.save()
        );


        protectedResult =
          await pdfProtection
            .generateProtectedPdf(
              originalPdfPath,
              owner.cpf,
              owner.id
            );


        await db
          .insert(
            schema.protectedDownloads
          )
          .values({
            userId:
              owner.id,

            productId,

            orderId,

            downloadToken:
              protectedResult
                .downloadToken,

            expiresAt:
              protectedResult
                .expiresAt
                .toISOString(),
          });
      }
    );


    test(
      "PDF original ausente deve falhar sem gerar documento substituto",
      async () => {
        await assert.rejects(
          () =>
            pdfProtection
              .generateProtectedPdf(
                join(
                  isolated.rootDirectory,
                  "arquivo-inexistente.pdf"
                ),

                owner.cpf,

                owner.id
              )
        );


        const source =
          readProjectFile(
            "lib",
            "pdf-protection.ts"
          );


        assert.doesNotMatch(
          source,
          /Este é um PDF de exemplo gerado para testes/
        );


        assert.doesNotMatch(
          source,
          /Em produção, este será o conteúdo real da apostila/
        );
      }
    );


    test(
      "token deve localizar somente o arquivo exato",
      async () => {
        const exact =
          await pdfProtection
            .getProtectedPdfByToken(
              protectedResult
                .downloadToken
            );


        assert.ok(
          exact
        );


        const token =
          protectedResult
            .downloadToken;


        const replacement =
          token[8] ===
          "0"
            ? "1"
            : "0";


        const samePrefixToken =
          token.slice(
            0,
            8
          ) +
          replacement +
          token.slice(
            9
          );


        assert.equal(
          samePrefixToken.slice(
            0,
            8
          ),
          token.slice(
            0,
            8
          )
        );


        assert.notEqual(
          samePrefixToken,
          token
        );


        const wrong =
          await pdfProtection
            .getProtectedPdfByToken(
              samePrefixToken
            );


        assert.equal(
          wrong,
          null
        );
      }
    );


    test(
      "download deve exigir sessão autenticada",
      async () => {
        const response =
          await downloadRoute.GET(
            downloadRequest(
              protectedResult
                .downloadToken
            ),

            downloadContext(
              protectedResult
                .downloadToken
            )
          );


        assert.equal(
          response.status,
          401
        );
      }
    );


    test(
      "token de um comprador não pode ser usado por outro usuário",
      async () => {
        const response =
          await downloadRoute.GET(
            downloadRequest(
              protectedResult
                .downloadToken,

              otherSession
                .session
                .token
            ),

            downloadContext(
              protectedResult
                .downloadToken
            )
          );


        assert.equal(
          response.status,
          404
        );
      }
    );


    test(
      "comprador correto com pedido aprovado deve receber PDF",
      async () => {
        const response =
          await downloadRoute.GET(
            downloadRequest(
              protectedResult
                .downloadToken,

              ownerSession
                .session
                .token
            ),

            downloadContext(
              protectedResult
                .downloadToken
            )
          );


        assert.equal(
          response.status,
          200
        );


        assert.equal(
          response.headers.get(
            "content-type"
          ),
          "application/pdf"
        );


        assert.match(
          response.headers.get(
            "cache-control"
          ) ??
            "",
          /no-store/
        );


        const bytes =
          new Uint8Array(
            await response
              .arrayBuffer()
          );


        assert.ok(
          bytes.length >
            0
        );
      }
    );


    test(
      "pedido reembolsado deve revogar link e arquivo protegido",
      async () => {
        await db
          .update(
            schema.orders
          )
          .set({
            status:
              "refunded",
          })
          .where(
            eq(
              schema.orders.id,
              orderId
            )
          );


        const response =
          await downloadRoute.GET(
            downloadRequest(
              protectedResult
                .downloadToken,

              ownerSession
                .session
                .token
            ),

            downloadContext(
              protectedResult
                .downloadToken
            )
          );


        assert.equal(
          response.status,
          403
        );


        const pdf =
          await pdfProtection
            .getProtectedPdfByToken(
              protectedResult
                .downloadToken
            );


        assert.equal(
          pdf,
          null
        );


        const databaseRecord =
          await db
            .select()
            .from(
              schema.protectedDownloads
            )
            .where(
              eq(
                schema
                  .protectedDownloads
                  .downloadToken,
                protectedResult
                  .downloadToken
              )
            )
            .get();


        assert.equal(
          databaseRecord,
          undefined
        );
      }
    );


    test(
      "API não deve afirmar que o PDF possui senha quando não possui",
      () => {
        const generateRoute =
          readProjectFile(
            "app",
            "api",
            "download",
            "generate",
            "route.ts"
          );


        assert.doesNotMatch(
          generateRoute,
          /password:\s*["']Seu CPF["']/
        );


        assert.match(
          generateRoute,
          /passwordProtected:\s*false/
        );
      }
    );


    test(
      "substituição de asset deve preservar novo arquivo após commit do banco",
      () => {
        const assetRoute =
          readProjectFile(
            "app",
            "api",
            "admin",
            "products",
            "[id]",
            "assets",
            "route.ts"
          );


        assert.match(
          assetRoute,
          /const committedAsset\s*=\s*storedAsset/
        );


        assert.match(
          assetRoute,
          /storedAsset\s*=\s*null/
        );


        assert.match(
          assetRoute,
          /Falha ao limpar/
        );
      }
    );


    test(
      "package deve incorporar Fase 3E ao gate global",
      () => {
        const packageJson =
          JSON.parse(
            readProjectFile(
              "package.json"
            )
          );


        assert.ok(
          packageJson.scripts[
            "test:phase3e-hardening"
          ]
        );


        assert.ok(
          packageJson.scripts[
            "test:phase3e"
          ]
        );


        assert.match(
          packageJson.scripts[
            "test:all"
          ],
          /test:phase3e/
        );
      }
    );


    after(
      () => {
        isolated?.cleanup();


        console.log(
          "✅ Fase 3E-A concluída usando armazenamento e SQLite temporários."
        );
      }
    );
  }
);