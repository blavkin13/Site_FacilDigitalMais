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
  join,
} from "node:path";

import {
  NextRequest,
} from "next/server";

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


function createAdminRequest({
  method =
    "GET",

  token =
    null,

  body =
    undefined,
} = {}) {
  const headers =
    new Headers();


  if (
    token
  ) {
    headers.set(
      "cookie",
      `fd-session=${token}`
    );
  }


  if (
    body !==
    undefined
  ) {
    headers.set(
      "content-type",
      "application/json"
    );
  }


  return new NextRequest(
    "http://localhost/api/admin/products",
    {
      method,

      headers,

      body:
        body ===
        undefined
          ? undefined
          : JSON.stringify(
              body
            ),
    }
  );
}


describe(
  "Fase 3C-B - Integração administrativa de arquivos",
  () => {
    let isolated;

    let adminToken;

    let productsRoute;


    before(
      async () => {
        isolated =
          await createIsolatedDatabase();


        const auth =
          await import(
            "../lib/auth.ts"
          );


        await auth.registerUser(
          "admin-3cb@teste.local",
          "SenhaAdmin3CB123",
          "Administrador 3C-B",
          undefined,
          undefined,
          "admin"
        );


        const login =
          await auth.authenticateUser(
            "admin-3cb@teste.local",
            "SenhaAdmin3CB123"
          );


        assert.ok(
          login
        );


        adminToken =
          login.session.token;


        productsRoute =
          await import(
            "../app/api/admin/products/route.ts"
          );
      }
    );


    test(
      "painel deve possuir upload de capa e PDF",
      () => {
        const content =
          readProjectFile(
            "components",
            "admin-apostilas.tsx"
          );


        assert.match(
          content,
          /type="file"/
        );


        assert.match(
          content,
          /uploadAsset/
        );


        assert.match(
          content,
          /removeAsset/
        );


        assert.match(
          content,
          /\/api\/admin\/products\/\$\{editingProduct\.id\}\/assets/
        );
      }
    );


    test(
      "interface deve restringir formatos e comunicar limites",
      () => {
        const content =
          readProjectFile(
            "components",
            "admin-apostilas.tsx"
          );


        assert.match(
          content,
          /image\/png,image\/jpeg,image\/webp/
        );


        assert.match(
          content,
          /application\/pdf/
        );


        assert.match(
          content,
          /8 MB/
        );


        assert.match(
          content,
          /120 MB/
        );
      }
    );


    test(
      "novo rascunho deve permanecer aberto para receber arquivos",
      () => {
        const content =
          readProjectFile(
            "components",
            "admin-apostilas.tsx"
          );


        assert.match(
          content,
          /Rascunho criado\. Agora você pode enviar a capa e o PDF\./
        );


        assert.match(
          content,
          /syncProduct/
        );


        assert.match(
          content,
          /productToForm\s*\(\s*savedProduct/
        );
      }
    );


    test(
      "servidor deve bloquear publicação sem capa e PDF",
      async () => {
        const createResponse =
          await productsRoute.POST(
            createAdminRequest({
              method:
                "POST",

              token:
                adminToken,

              body: {
                slug:
                  "apostila-sem-arquivos-3cb",

                title:
                  "Apostila sem arquivos 3C-B",

                price:
                  79.9,
              },
            })
          );


        assert.equal(
          createResponse.status,
          201
        );


        const created =
          await createResponse.json();


        assert.equal(
          created.product.active,
          false
        );


        assert.equal(
          created.product.cover,
          null
        );


        assert.equal(
          created.product.pdfPath,
          null
        );


        const publishResponse =
          await productsRoute.PATCH(
            createAdminRequest({
              method:
                "PATCH",

              token:
                adminToken,

              body: {
                id:
                  created.product.id,

                active:
                  true,
              },
            })
          );


        assert.equal(
          publishResponse.status,
          409
        );


        const error =
          await publishResponse.json();


        /**
         * A Fase 3D ampliou a regra de publicação.
         *
         * Em vez de uma mensagem específica apenas
         * para capa/PDF, a API retorna uma mensagem
         * geral e uma lista estruturada de requisitos
         * pendentes.
         */
        assert.match(
          error.error,
          /não está pronta para publicação/i
        );


        assert.ok(
          Array.isArray(
            error.issues
          ),
          "Resposta deve informar requisitos pendentes"
        );


        const issueFields =
          error.issues.map(
            (
              issue
            ) =>
              issue.field
          );


        /**
         * O objetivo histórico da Fase 3C continua
         * garantido: sem capa e PDF não existe
         * publicação.
         */
        assert.ok(
          issueFields.includes(
            "cover"
          ),
          "Capa ausente deve impedir publicação"
        );


        assert.ok(
          issueFields.includes(
            "pdfPath"
          ),
          "PDF ausente deve impedir publicação"
        );
      }
    );


    test(
      "download deve resolver managed-pdf e exigir compra aprovada",
      () => {
        const content =
          readProjectFile(
            "app",
            "api",
            "download",
            "generate",
            "route.ts"
          );


        assert.match(
          content,
          /resolveManagedPdfPath/
        );


        assert.match(
          content,
          /managed-pdf:/
        );


        assert.match(
          content,
          /eq\s*\(\s*orders\.status\s*,\s*["']approved["']/
        );


        assert.match(
          content,
          /fileIsReadable/
        );
      }
    );


    test(
      "download não pode gerar sample PDF quando original está ausente",
      () => {
        const content =
          readProjectFile(
            "app",
            "api",
            "download",
            "generate",
            "route.ts"
          );


        assert.doesNotMatch(
          content,
          /sample\.pdf/
        );


        assert.doesNotMatch(
          content,
          /purchase\.pdfPath\s*\|\|/
        );
      }
    );


    test(
      "não deve existir endpoint público para PDFs originais",
      () => {
        assert.equal(
          existsSync(
            join(
              process.cwd(),
              "app",
              "api",
              "media",
              "pdfs"
            )
          ),
          false
        );


        const storage =
          readProjectFile(
            "lib",
            "admin-product-storage.ts"
          );


        assert.match(
          storage,
          /MANAGED_PDF_PREFIX/
        );


        assert.match(
          storage,
          /managed-pdf:/
        );
      }
    );


    test(
      "CSS deve possuir interface de upload",
      () => {
        const content =
          readProjectFile(
            "app",
            "extra.css"
          );


        const classes = [
          ".admin-assets-grid",
          ".admin-asset-card",
          ".admin-upload-control",
          ".admin-cover-preview",
          ".admin-private-file-note",
          ".admin-assets-save-first",
        ];


        for (
          const className of classes
        ) {
          assert.ok(
            content.includes(
              className
            ),
            `${className} deve existir`
          );
        }
      }
    );


    test(
      "package deve executar toda a Fase 3C no test:all",
      () => {
        const packageJson =
          JSON.parse(
            readProjectFile(
              "package.json"
            )
          );


        assert.ok(
          packageJson.scripts[
            "test:phase3c-upload"
          ]
        );


        assert.ok(
          packageJson.scripts[
            "test:phase3c-integration"
          ]
        );


        assert.ok(
          packageJson.scripts[
            "test:phase3c"
          ]
        );


        assert.match(
          packageJson.scripts[
            "test:all"
          ],
          /test:phase3c/
        );
      }
    );


    after(
      () => {
        isolated?.cleanup();


        console.log(
          "✅ Fase 3C-B concluída usando SQLite temporário."
        );
      }
    );
  }
);