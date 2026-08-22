import {
  after,
  before,
  describe,
  test,
} from "node:test";

import assert from "node:assert/strict";

import {
  NextRequest,
} from "next/server";

import {
  eq,
} from "drizzle-orm";

import {
  createIsolatedDatabase,
} from "./helpers/isolated-database.mjs";


function createRequest({
  token,
  body,
}) {
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
  "Fase 3D-A - Fundação editorial e publicação",
  () => {
    let isolated;

    let db;

    let products;

    let adminToken;

    let productsRoute;

    let repository;

    let validation;

    let publication;


    before(
      async () => {
        isolated =
          await createIsolatedDatabase();


        const database =
          await import(
            "../db/index.ts"
          );


        const schema =
          await import(
            "../db/schema.ts"
          );


        const auth =
          await import(
            "../lib/auth.ts"
          );


        repository =
          await import(
            "../lib/product-repository.ts"
          );


        validation =
          await import(
            "../lib/admin-product-validation.ts"
          );


        publication =
          await import(
            "../lib/product-publication.ts"
          );


        productsRoute =
          await import(
            "../app/api/admin/products/route.ts"
          );


        db =
          database.getDb();


        products =
          schema.products;


        await auth.registerUser(
          "admin-3d@teste.local",
          "SenhaAdmin3D123",
          "Administrador 3D",
          undefined,
          undefined,
          "admin"
        );


        const login =
          await auth.authenticateUser(
            "admin-3d@teste.local",
            "SenhaAdmin3D123"
          );


        assert.ok(
          login
        );


        adminToken =
          login.session.token;
      }
    );


    test(
      "migration deve criar campos editoriais e SEO",
      () => {
        const sqlite =
          db.$client;


        const columns =
          sqlite
            .prepare(
              "PRAGMA table_info(products)"
            )
            .all()
            .map(
              (
                column
              ) =>
                column.name
            );


        for (
          const column of [
            "organization",
            "contest_slug",
            "seo_title",
            "seo_description",
            "published_at",
          ]
        ) {
          assert.ok(
            columns.includes(
              column
            ),
            `Coluna ${column} deve existir`
          );
        }
      }
    );


    test(
      "validator deve aceitar metadados editoriais e SEO",
      () => {
        const result =
          validation
            .validateAdminProductCreate({
              slug:
                "apostila-editorial-3d",

              title:
                "Apostila Editorial 3D",

              shortTitle:
                "Engenharia",

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
                "Descrição editorial completa.",

              seoTitle:
                "Apostila Transpetro Engenharia",

              seoDescription:
                "Material completo para preparação do concurso Transpetro.",

              price:
                79.9,
            });


        assert.equal(
          result.organization,
          "Transpetro"
        );


        assert.equal(
          result.contestSlug,
          "transpetro"
        );


        assert.equal(
          result.seoTitle,
          "Apostila Transpetro Engenharia"
        );
      }
    );


    test(
      "contestSlug inválido deve ser rejeitado",
      () => {
        assert.throws(
          () =>
            validation
              .validateAdminProductCreate({
                slug:
                  "apostila-contest-invalid",

                title:
                  "Apostila Teste",

                price:
                  79.9,

                contestSlug:
                  "../transpetro",
              }),

          /contestSlug/
        );
      }
    );


    test(
      "publicação deve informar campos editoriais ausentes",
      () => {
        const issues =
          publication
            .getProductPublicationIssues({
              slug:
                "teste",

              title:
                "Teste",

              shortTitle:
                null,

              category:
                null,

              bank:
                null,

              level:
                null,

              organization:
                null,

              contestSlug:
                null,

              description:
                null,

              price:
                79.9,

              cover:
                null,

              pdfPath:
                null,
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
            "organization"
          )
        );


        assert.ok(
          fields.includes(
            "contestSlug"
          )
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
      "repository deve priorizar contestSlug explícito",
      async () => {
        await db
          .insert(
            products
          )
          .values({
            slug:
              "produto-slug-sem-relacao",

            title:
              "Título sem travessão",

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
              "Descrição de teste.",

            price:
              99.9,

            pixPrice:
              null,

            cover:
              "/covers/teste.png",

            pdfPath:
              "managed-pdf:1-00000000-0000-4000-8000-000000000000.pdf",

            active:
              true,
          });


        const found =
          await repository
            .getProductsByContest(
              "transpetro"
            );


        assert.ok(
          found.some(
            (
              product
            ) =>
              product.slug ===
              "produto-slug-sem-relacao"
          )
        );


        const mapped =
          found.find(
            (
              product
            ) =>
              product.slug ===
              "produto-slug-sem-relacao"
          );


        assert.ok(
          mapped
        );


        /**
         * Sem pixPrice explicitamente cadastrado,
         * não deve surgir desconto inventado.
         */
        assert.equal(
          mapped.pixPrice,
          mapped.price
        );
      }
    );


    test(
      "API deve bloquear publicação editorialmente incompleta",
      async () => {
        const inserted =
          await db
            .insert(
              products
            )
            .values({
              slug:
                "rascunho-incompleto-3d",

              title:
                "Rascunho incompleto",

              price:
                89.9,

              cover:
                "/covers/teste.png",

              pdfPath:
                "managed-pdf:2-00000000-0000-4000-8000-000000000000.pdf",

              active:
                false,
            })
            .returning();


        const response =
          await productsRoute.PATCH(
            createRequest({
              token:
                adminToken,

              body: {
                id:
                  inserted[0].id,

                active:
                  true,
              },
            })
          );


        assert.equal(
          response.status,
          409
        );


        const data =
          await response.json();


        assert.ok(
          Array.isArray(
            data.issues
          )
        );


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
      "publicação válida deve registrar publishedAt",
      async () => {
        const inserted =
          await db
            .insert(
              products
            )
            .values({
              slug:
                "apostila-publicavel-3d",

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
                "Material completo para Engenharia Naval.",

              price:
                99.9,

              cover:
                "/covers/teste.png",

              pdfPath:
                "managed-pdf:3-00000000-0000-4000-8000-000000000000.pdf",

              active:
                false,
            })
            .returning();


        const response =
          await productsRoute.PATCH(
            createRequest({
              token:
                adminToken,

              body: {
                id:
                  inserted[0].id,

                active:
                  true,
              },
            })
          );


        assert.equal(
          response.status,
          200
        );


        const data =
          await response.json();


        assert.equal(
          data.product.active,
          true
        );


        assert.ok(
          data.product.publishedAt
        );


        const persisted =
          await db
            .select()
            .from(
              products
            )
            .where(
              eq(
                products.id,
                inserted[0].id
              )
            )
            .get();


        assert.ok(
          persisted?.publishedAt
        );
      }
    );


    after(
      () => {
        isolated?.cleanup();


        console.log(
          "✅ Fase 3D-A concluída usando SQLite temporário."
        );
      }
    );
  }
);