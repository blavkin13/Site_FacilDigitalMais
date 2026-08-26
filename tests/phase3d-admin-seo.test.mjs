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
  "Fase 3D-B - Interface editorial, publicação e SEO",
  () => {
    let isolated;

    let adminToken;

    let db;

    let products;

    let productsRoute;


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


        const schema =
          await import(
            "../db/schema.ts"
          );


        await auth.registerUser(
          "admin-3db@teste.local",
          "SenhaAdmin3DB123",
          "Administrador 3D-B",
          undefined,
          undefined,
          "admin"
        );


        const login =
          await auth.authenticateUser(
            "admin-3db@teste.local",
            "SenhaAdmin3DB123"
          );


        assert.ok(
          login
        );


        adminToken =
          login.session.token;


        db =
          database.getDb();


        products =
          schema.products;


        productsRoute =
          await import(
            "../app/api/admin/products/route.ts"
          );
      }
    );


    test(
      "modal deve preservar todas as sete seções editoriais",
      () => {
        const content =
          readProjectFile(
            "components",
            "admin-apostilas.tsx"
          );


        const headings = [
          "1. Identificação",
          "2. Conteúdo e preço",
          "3. Apresentação",
          "4. Conteúdo programático",
          "5. Depoimento",
          "6. SEO e compartilhamento",
          "7. Arquivos",
        ];


        let previousIndex =
          -1;


        for (
          const heading of headings
        ) {
          const index =
            content.indexOf(
              heading
            );


          assert.ok(
            index >=
              0,
            `Seção ausente: ${heading}`
          );


          assert.ok(
            index >
              previousIndex,
            `Seções fora de ordem em ${heading}`
          );


          previousIndex =
            index;
        }
      }
    );


    test(
      "painel deve possuir organização, concurso e SEO",
      () => {
        const content =
          readProjectFile(
            "components",
            "admin-apostilas.tsx"
          );


        for (
          const field of [
            "form.organization",
            "form.contestSlug",
            "form.seoTitle",
            "form.seoDescription",
          ]
        ) {
          assert.ok(
            content.includes(
              field
            ),
            `${field} deve estar no formulário`
          );
        }
      }
    );


    test(
      "painel deve mostrar checklist de prontidão",
      () => {
        const component =
          readProjectFile(
            "components",
            "admin-publication-readiness.tsx"
          );


        assert.match(
          component,
          /getProductPublicationIssues/
        );


        assert.match(
          component,
          /Pronta para publicar/
        );


        assert.match(
          component,
          /pendência/
        );
      }
    );


    test(
      "produto publicado não pode se tornar editorialmente inválido",
      async () => {
        const inserted =
          await db
            .insert(
              products
            )
            .values({
              slug:
                "produto-publicado-3db",

              title:
                "Transpetro — Engenharia Naval",

              shortTitle:
                "Engenharia Naval",

              category:
                "Estatais",

              bank:
                "Cesgranrio",

              level:
                "Superior",

              organization:
                "Transpetro",

              contestSlug:
                "transpetro",

              description:
                "Material completo.",

              price:
                99.9,

              cover:
                "/covers/teste.png",

              pdfPath:
                "managed-pdf:99-00000000-0000-4000-8000-000000000000.pdf",

              active:
                true,

              publishedAt:
                new Date()
                  .toISOString(),
            })
            .returning();


        const response =
          await productsRoute.PATCH(
            patchRequest(
              adminToken,
              {
                id:
                  inserted[0].id,

                organization:
                  null,
              }
            )
          );


        assert.equal(
          response.status,
          409
        );


        const data =
          await response.json();


        assert.ok(
          data.issues.some(
            (
              issue
            ) =>
              issue.field ===
              "organization"
          )
        );
      }
    );


    test(
      "landing individual deve utilizar SEO explícito",
      () => {
        const content =
          readProjectFile(
            "app",
            "apostilas",
            "[slug]",
            "page.tsx"
          );


        assert.match(
          content,
          /product\.seoTitle/
        );


        assert.match(
          content,
          /product\.seoDescription/
        );


        assert.match(
          content,
          /product\.cover/
        );
      }
    );


    test(
      "concurso deve priorizar organization explícita",
      () => {
        const content =
          readProjectFile(
            "app",
            "concurso",
            "[slug]",
            "page.tsx"
          );


        assert.match(
          content,
          /product\.organization/
        );


        assert.doesNotMatch(
          content,
          /title\.split\s*\(/
        );
      }
    );


    test(
      "sitemap deve usar datas reais das apostilas",
      () => {
        const content =
          readProjectFile(
            "app",
            "sitemap.ts"
          );


        assert.match(
          content,
          /product\.publishedAt/
        );


        assert.match(
          content,
          /product\.updatedAt/
        );


        assert.match(
          content,
          /getContestLastModified/
        );
      }
    );


    test(
      "landing não pode voltar a inventar preços",
      () => {
        const content =
          readProjectFile(
            "components",
            "product-detail.tsx"
          );


        assert.doesNotMatch(
          content,
          /\bplanPrice\b/
        );


        assert.doesNotMatch(
          content,
          /product\.price\s*\+\s*(?:30|50)/
        );


        assert.doesNotMatch(
          content,
          /(?:product\.price|planPrice)\s*\*\s*0\.95/
        );


        assert.match(
          content,
          /product\.price/
        );


        assert.doesNotMatch(
          content,
          /product\.pixPrice/,
          "Landing pública deve utilizar apenas product.price"
        );
      }
    );


    test(
      "test:phase3d deve incluir foundation e interface",
      () => {
        const packageJson =
          JSON.parse(
            readProjectFile(
              "package.json"
            )
          );


        assert.ok(
          packageJson.scripts[
            "test:phase3d-ui"
          ]
        );


        assert.match(
          packageJson.scripts[
            "test:phase3d"
          ],
          /test:phase3d-foundation/
        );


        assert.match(
          packageJson.scripts[
            "test:phase3d"
          ],
          /test:phase3d-ui/
        );


        assert.match(
          packageJson.scripts[
            "test:all"
          ],
          /test:phase3d/
        );
      }
    );


    after(
      () => {
        isolated?.cleanup();


        console.log(
          "✅ Fase 3D-B concluída usando SQLite temporário."
        );
      }
    );
  }
);