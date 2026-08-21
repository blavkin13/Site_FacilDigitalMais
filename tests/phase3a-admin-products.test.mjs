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


function createRequest(
  {
    method =
      "GET",

    token =
      null,

    body =
      undefined,

    query =
      "",
  } = {}
) {
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
    `http://localhost/api/admin/products${query}`,
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
  "Fase 3A - Base administrativa segura de Apostilas",
  () => {
    let isolated;
    let adminToken;
    let userToken;
    let productsRoute;
    let validation;


    before(
      async () => {
        isolated =
          await createIsolatedDatabase();


        const auth =
          await import(
            "../lib/auth.ts"
          );


        await auth.registerUser(
          "admin-3a@teste.local",
          "SenhaAdmin123",
          "Administrador 3A",
          undefined,
          undefined,
          "admin"
        );


        await auth.registerUser(
          "aluno-3a@teste.local",
          "SenhaAluno123",
          "Aluno 3A"
        );


        const adminLogin =
          await auth.authenticateUser(
            "admin-3a@teste.local",
            "SenhaAdmin123"
          );


        const userLogin =
          await auth.authenticateUser(
            "aluno-3a@teste.local",
            "SenhaAluno123"
          );


        assert.ok(
          adminLogin
        );


        assert.ok(
          userLogin
        );


        adminToken =
          adminLogin.session.token;


        userToken =
          userLogin.session.token;


        productsRoute =
          await import(
            "../app/api/admin/products/route.ts"
          );


        validation =
          await import(
            "../lib/admin-product-validation.ts"
          );
      }
    );


    test(
      "guard administrativo deve diferenciar 401, 403 e admin",
      async () => {
        const adminAuth =
          await import(
            "../lib/admin-auth.ts"
          );


        const anonymous =
          await adminAuth.resolveAdminSession(
            null
          );


        assert.equal(
          anonymous.status,
          "unauthenticated"
        );


        const normalUser =
          await adminAuth.resolveAdminSession(
            userToken
          );


        assert.equal(
          normalUser.status,
          "forbidden"
        );


        const administrator =
          await adminAuth.resolveAdminSession(
            adminToken
          );


        assert.equal(
          administrator.status,
          "authenticated"
        );


        assert.equal(
          administrator.user.role,
          "admin"
        );
      }
    );


    test(
      "API deve bloquear requisição sem sessão",
      async () => {
        const response =
          await productsRoute.GET(
            createRequest()
          );


        assert.equal(
          response.status,
          401
        );
      }
    );


    test(
      "API deve bloquear aluno autenticado",
      async () => {
        const response =
          await productsRoute.GET(
            createRequest({
              token:
                userToken,
            })
          );


        assert.equal(
          response.status,
          403
        );
      }
    );


    test(
      "validator deve rejeitar mass assignment e caminhos de arquivo",
      () => {
        const base = {
          slug:
            "apostila-segura",

          title:
            "Apostila Segura",

          price:
            79.9,
        };


        assert.throws(
          () =>
            validation
              .validateAdminProductCreate({
                ...base,
                id:
                  999,
              }),
          /Campo "id" não é permitido/
        );


        assert.throws(
          () =>
            validation
              .validateAdminProductCreate({
                ...base,
                createdAt:
                  "2000-01-01",
              }),
          /Campo "createdAt" não é permitido/
        );


        assert.throws(
          () =>
            validation
              .validateAdminProductCreate({
                ...base,
                pdfPath:
                  "/etc/passwd",
              }),
          /Campo "pdfPath" não é permitido/
        );


        assert.throws(
          () =>
            validation
              .validateAdminProductCreate({
                ...base,
                cover:
                  "/arquivo-arbitrario",
              }),
          /Campo "cover" não é permitido/
        );


        assert.throws(
          () =>
            validation
              .validateAdminProductCreate({
                ...base,
                active:
                  true,
              }),
          /Campo "active" não é permitido/
        );
      }
    );


    test(
      "validator deve normalizar dados estruturados",
      () => {
        const product =
          validation
            .validateAdminProductCreate({
              slug:
                "transpetro-teste-3a",

              title:
                "  Transpetro — Teste 3A  ",

              shortTitle:
                " Teste 3A ",

              category:
                " Estatais ",

              bank:
                " Cesgranrio ",

              level:
                " Superior ",

              pages:
                250,

              questions:
                400,

              oldPrice:
                129.9,

              price:
                79.9,

              pixPrice:
                75.9,

              highlights: [
                " Conteúdo atualizado ",
                " Questões comentadas ",
              ],

              syllabus: [
                {
                  title:
                    " Língua Portuguesa ",

                  pages:
                    100,

                  questions:
                    150,

                  topics: [
                    " Interpretação ",
                    " Gramática ",
                  ],
                },
              ],

              testimonial: {
                name:
                  " Aluno Teste ",

                role:
                  " Aprovado ",

                quote:
                  " Excelente material. ",

                score:
                  " 90% ",
              },

              mpLink:
                "https://www.mercadopago.com.br/",
            });


        assert.equal(
          product.title,
          "Transpetro — Teste 3A"
        );


        assert.equal(
          product.active,
          false
        );


        assert.deepEqual(
          JSON.parse(
            product.highlights
          ),
          [
            "Conteúdo atualizado",
            "Questões comentadas",
          ]
        );


        const syllabus =
          JSON.parse(
            product.syllabus
          );


        assert.equal(
          syllabus[0].title,
          "Língua Portuguesa"
        );
      }
    );


    test(
      "validator deve rejeitar slug, preço e estruturas inválidas",
      () => {
        assert.throws(
          () =>
            validation
              .validateAdminProductCreate({
                slug:
                  "Slug Inválido",

                title:
                  "Teste",

                price:
                  79.9,
              }),
          /slug/
        );


        assert.throws(
          () =>
            validation
              .validateAdminProductCreate({
                slug:
                  "produto-teste",

                title:
                  "Teste",

                price:
                  0,
              }),
          /maior que zero/
        );


        assert.throws(
          () =>
            validation
              .validateAdminProductCreate({
                slug:
                  "produto-teste",

                title:
                  "Teste",

                price:
                  79.9,

                highlights:
                  "não é array",
              }),
          /highlights/
        );
      }
    );


    test(
      "POST administrativo deve criar apostila como rascunho",
      async () => {
        const response =
          await productsRoute.POST(
            createRequest({
              method:
                "POST",

              token:
                adminToken,

              body: {
                slug:
                  "apostila-integracao-3a",

                title:
                  "Apostila Integração 3A",

                shortTitle:
                  "Integração 3A",

                category:
                  "Testes",

                bank:
                  "Cesgranrio",

                level:
                  "Superior",

                pages:
                  300,

                questions:
                  500,

                oldPrice:
                  129.9,

                price:
                  79.9,

                pixPrice:
                  75.9,

                description:
                  "Produto criado exclusivamente no SQLite temporário.",
              },
            })
          );


        assert.equal(
          response.status,
          201
        );


        const data =
          await response.json();


        assert.equal(
          data.success,
          true
        );


        assert.equal(
          data.product.slug,
          "apostila-integracao-3a"
        );


        assert.equal(
          data.product.active,
          false
        );


        assert.equal(
          data.product.cover,
          null
        );


        assert.equal(
          data.product.pdfPath,
          null
        );
      }
    );


    test(
      "POST deve rejeitar campo administrativo não permitido",
      async () => {
        const response =
          await productsRoute.POST(
            createRequest({
              method:
                "POST",

              token:
                adminToken,

              body: {
                slug:
                  "tentativa-mass-assignment",

                title:
                  "Tentativa",

                price:
                  79.9,

                pdfPath:
                  "/etc/passwd",
              },
            })
          );


        assert.equal(
          response.status,
          400
        );


        const data =
          await response.json();


        assert.equal(
          data.field,
          "pdfPath"
        );
      }
    );


    test(
      "PATCH deve permitir somente campos validados",
      async () => {
        const listResponse =
          await productsRoute.GET(
            createRequest({
              token:
                adminToken,
            })
          );


        const list =
          await listResponse.json();


        const product =
          list.products.find(
            (
              item
            ) =>
              item.slug ===
              "apostila-integracao-3a"
          );


        assert.ok(
          product
        );


        const updateResponse =
          await productsRoute.PATCH(
            createRequest({
              method:
                "PATCH",

              token:
                adminToken,

              body: {
                id:
                  product.id,

                active:
                  true,

                title:
                  "Apostila Integração 3A Atualizada",
              },
            })
          );


        assert.equal(
          updateResponse.status,
          200
        );


        const updated =
          await updateResponse.json();


        assert.equal(
          updated.product.active,
          true
        );


        assert.equal(
          updated.product.title,
          "Apostila Integração 3A Atualizada"
        );


        const forbiddenResponse =
          await productsRoute.PATCH(
            createRequest({
              method:
                "PATCH",

              token:
                adminToken,

              body: {
                id:
                  product.id,

                createdAt:
                  "1999-01-01",
              },
            })
          );


        assert.equal(
          forbiddenResponse.status,
          400
        );
      }
    );


    test(
      "DELETE deve executar soft delete",
      async () => {
        const listResponse =
          await productsRoute.GET(
            createRequest({
              token:
                adminToken,
            })
          );


        const list =
          await listResponse.json();


        const product =
          list.products.find(
            (
              item
            ) =>
              item.slug ===
              "apostila-integracao-3a"
          );


        assert.ok(
          product
        );


        const response =
          await productsRoute.DELETE(
            createRequest({
              method:
                "DELETE",

              token:
                adminToken,

              query:
                `?id=${product.id}`,
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
          false
        );
      }
    );


    test(
      "rota não pode espalhar body recebido diretamente no ORM",
      () => {
        const content =
          readProjectFile(
            "app",
            "api",
            "admin",
            "products",
            "route.ts"
          );


        /**
         * Comentários técnicos podem documentar padrões inseguros
         * que foram removidos da implementação.
         *
         * As verificações abaixo precisam analisar somente o código
         * executável, evitando falso positivo em comentários como:
         *
         *   const { id, ...updates } = body
         */
        const runtimeContent =
          content.replace(
            /\/\*[\s\S]*?\*\//g,
            ""
          );


        assert.doesNotMatch(
          runtimeContent,
          /\.\.\.\s*body/,
          "A API não pode executar spread direto do request body"
        );


        assert.doesNotMatch(
          runtimeContent,
          /const\s*\{\s*id\s*,\s*\.\.\.\s*updates\s*\}\s*=\s*body/,
          "PATCH não pode transformar body diretamente em updates"
        );


        assert.match(
          runtimeContent,
          /validateAdminProductCreate/,
          "POST deve utilizar validator"
        );


        assert.match(
          runtimeContent,
          /validateAdminProductPatch/,
          "PATCH deve utilizar validator"
        );


        assert.match(
          runtimeContent,
          /authorizeAdminRequest/,
          "API deve utilizar guard administrativo central"
        );


        /**
         * O spread de `updates` continua permitido porque esse objeto
         * é reconstruído campo a campo pelo validator e não deriva
         * diretamente do corpo recebido.
         */
        assert.match(
          runtimeContent,
          /\.set\s*\(\s*\{\s*\.\.\.\s*updates/,
          "PATCH deve persistir somente o objeto sanitizado pelo validator"
        );
      }
    );


    test(
      "página admin deve possuir autorização server-side independente",
      () => {
        const content =
          readProjectFile(
            "app",
            "admin",
            "page.tsx"
          );


        assert.match(
          content,
          /resolveAdminSession/,
          "Página deve validar sessão no servidor"
        );


        assert.match(
          content,
          /cookies/,
          "Página deve ler o cookie server-side"
        );


        assert.match(
          content,
          /redirect/,
          "Página deve bloquear acessos inválidos"
        );


        assert.match(
          content,
          /robots/,
          "Página administrativa não deve ser indexada"
        );
      }
    );


    after(
      () => {
        isolated?.cleanup();


        console.log(
          "✅ Fase 3A concluída usando SQLite temporário."
        );
      }
    );
  }
);