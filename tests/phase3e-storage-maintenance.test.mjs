import {
  after,
  before,
  describe,
  test,
} from "node:test";

import assert from "node:assert/strict";

import {
  existsSync,
  readFileSync,
} from "node:fs";

import {
  mkdir,
  utimes,
  writeFile,
} from "node:fs/promises";

import {
  join,
} from "node:path";

import {
  NextRequest,
} from "next/server";

import {
  eq,
} from "drizzle-orm";

import {
  createIsolatedDatabase,
} from "./helpers/isolated-database.mjs";


const OLD_DATE =
  new Date(
    "2020-01-01T00:00:00.000Z"
  );


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


function patchRequest(
  token,
  body
) {
  return new NextRequest(
    "http://localhost/api/admin/products",
    {
      method:
        "PATCH",

      headers: {
        cookie:
          `fd-session=${token}`,

        "content-type":
          "application/json",
      },

      body:
        JSON.stringify(
          body
        ),
    }
  );
}


describe(
  "Fase 3E-B - Integridade e manutenção do armazenamento",
  () => {
    let isolated;

    let previousUploadRoot;

    let db;

    let schema;

    let storage;

    let maintenance;

    let productsRoute;

    let adminToken;


    before(
      async () => {
        isolated =
          await createIsolatedDatabase();


        previousUploadRoot =
          process.env
            .UPLOAD_ROOT_DIR;


        process.env
          .UPLOAD_ROOT_DIR =
          join(
            isolated.rootDirectory,
            "uploads"
          );


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


        storage =
          await import(
            "../lib/admin-product-storage.ts"
          );


        maintenance =
          await import(
            "../lib/admin-product-storage-maintenance.ts"
          );


        productsRoute =
          await import(
            "../app/api/admin/products/route.ts"
          );


        db =
          database.getDb();


        await auth.registerUser(
          "admin-3eb@teste.local",
          "SenhaAdmin3EB123",
          "Administrador 3E-B",
          undefined,
          undefined,
          "admin"
        );


        const login =
          await auth.authenticateUser(
            "admin-3eb@teste.local",
            "SenhaAdmin3EB123"
          );


        assert.ok(
          login
        );


        adminToken =
          login.session.token;
      }
    );


    test(
      "integridade deve detectar referência gerenciada sem arquivo físico",
      async () => {
        const issues =
          await maintenance
            .getManagedProductAssetIntegrityIssues({
              cover:
                "/api/media/covers/1-00000000-0000-4000-8000-000000000001.png",

              pdfPath:
                "managed-pdf:1-00000000-0000-4000-8000-000000000002.pdf",
            });


        const fields =
          issues.map(
            (
              issue
            ) =>
              issue.field
          );


        assert.ok(
          fields.includes(
            "cover"
          )
        );


        assert.ok(
          fields.includes(
            "pdfPath"
          )
        );
      }
    );


    test(
      "referências legadas não devem ser tratadas como storage gerenciado",
      async () => {
        const issues =
          await maintenance
            .getManagedProductAssetIntegrityIssues({
              cover:
                "/covers/capa-legada.png",

              pdfPath:
                "/pdfs/apostila-legada.pdf",
            });


        assert.deepEqual(
          issues,
          []
        );
      }
    );


    test(
      "API deve bloquear publicação quando arquivo gerenciado desapareceu",
      async () => {
        const inserted =
          await db
            .insert(
              schema.products
            )
            .values({
              slug:
                "produto-storage-ausente-3eb",

              title:
                "Transpetro — Engenharia Naval",

              shortTitle:
                "Engenharia Naval",

              organization:
                "Transpetro",

              contestSlug:
                "transpetro",

              category:
                "Estatais",

              bank:
                "Cesgranrio",

              level:
                "Superior",

              description:
                "Material completo.",

              price:
                99.9,

              cover:
                "/api/media/covers/3-00000000-0000-4000-8000-000000000003.png",

              pdfPath:
                "managed-pdf:3-00000000-0000-4000-8000-000000000004.pdf",

              active:
                false,
            })
            .returning();


        const response =
          await productsRoute.PATCH(
            patchRequest(
              adminToken,
              {
                id:
                  inserted[0].id,

                active:
                  true,
              }
            )
          );


        assert.equal(
          response.status,
          409
        );


        const data =
          await response.json();


        const fields =
          data.issues.map(
            (
              issue
            ) =>
              issue.field
          );


        assert.ok(
          fields.includes(
            "cover"
          )
        );


        assert.ok(
          fields.includes(
            "pdfPath"
          )
        );
      }
    );


    test(
      "dry-run deve localizar órfãos sem removê-los",
      async () => {
        const coverDirectory =
          storage
            .getCoverUploadDirectory();


        await mkdir(
          coverDirectory,
          {
            recursive:
              true,
          }
        );


        const filename =
          "90-00000000-0000-4000-8000-000000000090.png";


        const path =
          join(
            coverDirectory,
            filename
          );


        await writeFile(
          path,
          new Uint8Array([
            1,
            2,
            3,
          ])
        );


        await utimes(
          path,
          OLD_DATE,
          OLD_DATE
        );


        const report =
          await maintenance
            .runManagedStorageMaintenance({
              apply:
                false,

              now:
                new Date(
                  "2026-08-22T12:00:00.000Z"
                ),

              orphanGraceMs:
                0,
            });


        assert.ok(
          report
            .managedAssets
            .coverOrphans
            .includes(
              filename
            )
        );


        assert.equal(
          existsSync(
            path
          ),
          true
        );
      }
    );


    test(
      "limpeza deve remover órfão antigo mas preservar arquivo arbitrário",
      async () => {
        const pdfDirectory =
          storage
            .getPdfUploadDirectory();


        await mkdir(
          pdfDirectory,
          {
            recursive:
              true,
          }
        );


        const orphanFilename =
          "91-00000000-0000-4000-8000-000000000091.pdf";


        const arbitraryFilename =
          "nao-remover.pdf";


        const orphanPath =
          join(
            pdfDirectory,
            orphanFilename
          );


        const arbitraryPath =
          join(
            pdfDirectory,
            arbitraryFilename
          );


        await writeFile(
          orphanPath,
          "%PDF-1.4"
        );


        await writeFile(
          arbitraryPath,
          "arquivo arbitrário"
        );


        await utimes(
          orphanPath,
          OLD_DATE,
          OLD_DATE
        );


        await utimes(
          arbitraryPath,
          OLD_DATE,
          OLD_DATE
        );


        const report =
          await maintenance
            .runManagedStorageMaintenance({
              apply:
                true,

              now:
                new Date(
                  "2026-08-22T12:00:00.000Z"
                ),

              orphanGraceMs:
                0,
            });


        assert.ok(
          report
            .managedAssets
            .pdfOrphans
            .includes(
              orphanFilename
            )
        );


        assert.equal(
          existsSync(
            orphanPath
          ),
          false
        );


        assert.equal(
          existsSync(
            arbitraryPath
          ),
          true
        );
      }
    );


    test(
      "arquivo órfão recente deve respeitar janela de tolerância",
      async () => {
        const coverDirectory =
          storage
            .getCoverUploadDirectory();


        await mkdir(
          coverDirectory,
          {
            recursive:
              true,
          }
        );


        const filename =
          "92-00000000-0000-4000-8000-000000000092.webp";


        const path =
          join(
            coverDirectory,
            filename
          );


        await writeFile(
          path,
          new Uint8Array([
            1,
          ])
        );


        const now =
          new Date();


        await utimes(
          path,
          now,
          now
        );


        const report =
          await maintenance
            .runManagedStorageMaintenance({
              apply:
                true,

              now,

              orphanGraceMs:
                15 *
                60 *
                1000,
            });


        assert.equal(
          report
            .managedAssets
            .coverOrphans
            .includes(
              filename
            ),
          false
        );


        assert.equal(
          existsSync(
            path
          ),
          true
        );
      }
    );


    test(
      "download protegido expirado deve remover arquivo e registro",
      async () => {
        const user =
          await db
            .insert(
              schema.users
            )
            .values({
              email:
                "expired-3eb@teste.local",

              passwordHash:
                "hash",

              name:
                "Expired 3E-B",

              role:
                "user",
            })
            .returning();


        const product =
          await db
            .insert(
              schema.products
            )
            .values({
              slug:
                "produto-expirado-3eb",

              title:
                "Produto expirado",

              price:
                10,

              active:
                false,
            })
            .returning();


        const token =
          "a".repeat(
            64
          );


        const protectedDirectory =
          isolated
            .protectedPdfDirectory;


        await mkdir(
          protectedDirectory,
          {
            recursive:
              true,
          }
        );


        const protectedPath =
          join(
            protectedDirectory,
            `protected_${token}.pdf`
          );


        await writeFile(
          protectedPath,
          "%PDF-1.4"
        );


        const record =
          await db
            .insert(
              schema
                .protectedDownloads
            )
            .values({
              userId:
                user[0].id,

              productId:
                product[0].id,

              downloadToken:
                token,

              expiresAt:
                "2020-01-01T00:00:00.000Z",
            })
            .returning();


        const report =
          await maintenance
            .runManagedStorageMaintenance({
              apply:
                true,

              now:
                new Date(
                  "2026-08-22T12:00:00.000Z"
                ),

              orphanGraceMs:
                0,
            });


        assert.ok(
          report
            .protectedDownloads
            .expiredRecords
            .includes(
              record[0].id
            )
        );


        assert.equal(
          existsSync(
            protectedPath
          ),
          false
        );


        const databaseRecord =
          await db
            .select()
            .from(
              schema
                .protectedDownloads
            )
            .where(
              eq(
                schema
                  .protectedDownloads
                  .id,
                record[0].id
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
      "PDF protegido órfão antigo deve ser removido",
      async () => {
        const protectedDirectory =
          isolated
            .protectedPdfDirectory;


        await mkdir(
          protectedDirectory,
          {
            recursive:
              true,
          }
        );


        const token =
          "b".repeat(
            64
          );


        const filename =
          `protected_${token}.pdf`;


        const path =
          join(
            protectedDirectory,
            filename
          );


        await writeFile(
          path,
          "%PDF-1.4"
        );


        await utimes(
          path,
          OLD_DATE,
          OLD_DATE
        );


        const report =
          await maintenance
            .runManagedStorageMaintenance({
              apply:
                true,

              now:
                new Date(
                  "2026-08-22T12:00:00.000Z"
                ),

              orphanGraceMs:
                0,
            });


        assert.ok(
          report
            .protectedDownloads
            .orphanFiles
            .includes(
              filename
            )
        );


        assert.equal(
          existsSync(
            path
          ),
          false
        );
      }
    );


    test(
      "scripts de manutenção devem existir no package",
      () => {
        const packageJson =
          JSON.parse(
            readProjectFile(
              "package.json"
            )
          );


        assert.ok(
          packageJson.scripts[
            "storage:check"
          ]
        );


        assert.ok(
          packageJson.scripts[
            "storage:cleanup"
          ]
        );


        assert.ok(
          packageJson.scripts[
            "test:phase3e-maintenance"
          ]
        );


        assert.match(
          packageJson.scripts[
            "test:phase3e"
          ],
          /test:phase3e-maintenance/
        );
      }
    );


    after(
      () => {
        if (
          previousUploadRoot ===
          undefined
        ) {
          delete process.env
            .UPLOAD_ROOT_DIR;
        } else {
          process.env
            .UPLOAD_ROOT_DIR =
            previousUploadRoot;
        }


        isolated?.cleanup();


        console.log(
          "✅ Fase 3E-B concluída usando armazenamento temporário."
        );
      }
    );
  }
);