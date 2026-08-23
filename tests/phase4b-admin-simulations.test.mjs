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
  createIsolatedDatabase,
} from "./helpers/isolated-database.mjs";


function request({
  path,
  method = "GET",
  token = null,
  body = undefined,
}) {
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
    `http://localhost${path}`,
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
  "Fase 4B - Backend administrativo de Simulados",
  () => {
    let isolated;
    let db;

    let adminToken;
    let userToken;

    let productId;
    let activeQuestionId;
    let unusedQuestionId;
    let simulationId;

    let simulationRoute;
    let questionRoute;
    let productRelationRoute;
    let questionRelationRoute;


    before(
      async () => {
        isolated =
          await createIsolatedDatabase();

        const auth =
          await import(
            "../lib/auth.ts"
          );

        const schema =
          await import(
            "../db/schema.ts"
          );

        const database =
          await import(
            "../db/index.ts"
          );

        db =
          database.getDb();


        await auth.registerUser(
          "admin-4b@teste.local",
          "SenhaAdmin123",
          "Administrador 4B",
          undefined,
          undefined,
          "admin"
        );

        await auth.registerUser(
          "aluno-4b@teste.local",
          "SenhaAluno123",
          "Aluno 4B"
        );

        const adminLogin =
          await auth.authenticateUser(
            "admin-4b@teste.local",
            "SenhaAdmin123"
          );

        const userLogin =
          await auth.authenticateUser(
            "aluno-4b@teste.local",
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


        const product =
          await db
            .insert(
              schema.products
            )
            .values({
              slug:
                "produto-phase4b",

              title:
                "Produto Phase 4B",

              price:
                79.9,

              active:
                true,
            })
            .returning();

        productId =
          product[0].id;


        const questionRows =
          await db
            .insert(
              schema.questions
            )
            .values([
              {
                bank:
                  "Cesgranrio",

                subject:
                  "Português",

                questionText:
                  "Questão utilizada pelo simulado.",

                options:
                  JSON.stringify([
                    "Alternativa A",
                    "Alternativa B",
                  ]),

                correctAnswer:
                  0,

                difficulty:
                  "medium",

                active:
                  true,

                updatedAt:
                  new Date()
                    .toISOString(),
              },

              {
                bank:
                  "Cesgranrio",

                subject:
                  "Matemática",

                questionText:
                  "Questão não utilizada.",

                options:
                  JSON.stringify([
                    "Alternativa A",
                    "Alternativa B",
                  ]),

                correctAnswer:
                  1,

                difficulty:
                  "easy",

                active:
                  true,

                updatedAt:
                  new Date()
                    .toISOString(),
              },
            ])
            .returning();

        activeQuestionId =
          questionRows[0].id;

        unusedQuestionId =
          questionRows[1].id;


        const simulation =
          await db
            .insert(
              schema.simulations
            )
            .values({
              title:
                "Simulado Administrativo 4B",

              bank:
                "Cesgranrio",

              description:
                "Simulado administrativo de teste.",

              timeLimit:
                60,

              questionIds:
                "[]",

              active:
                false,

              updatedAt:
                new Date()
                  .toISOString(),
            })
            .returning();

        simulationId =
          simulation[0].id;


        simulationRoute =
          await import(
            "../app/api/admin/simulations/route.ts"
          );

        questionRoute =
          await import(
            "../app/api/admin/questions/route.ts"
          );

        productRelationRoute =
          await import(
            "../app/api/admin/simulations/[id]/products/route.ts"
          );

        questionRelationRoute =
          await import(
            "../app/api/admin/simulations/[id]/questions/route.ts"
          );
      }
    );


    test(
      "rotas administrativas devem exigir role admin",
      async () => {
        const anonymous =
          await simulationRoute.GET(
            request({
              path:
                "/api/admin/simulations",
            })
          );

        assert.equal(
          anonymous.status,
          401
        );

        const normalUser =
          await simulationRoute.GET(
            request({
              path:
                "/api/admin/simulations",

              token:
                userToken,
            })
          );

        assert.equal(
          normalUser.status,
          403
        );

        const admin =
          await simulationRoute.GET(
            request({
              path:
                "/api/admin/simulations",

              token:
                adminToken,
            })
          );

        assert.equal(
          admin.status,
          200
        );
      }
    );


    test(
      "POST de simulado deve bloquear mass assignment e criar rascunho",
      async () => {
        const forbidden =
          await simulationRoute.POST(
            request({
              path:
                "/api/admin/simulations",

              method:
                "POST",

              token:
                adminToken,

              body: {
                title:
                  "Tentativa",

                bank:
                  "Cesgranrio",

                timeLimit:
                  30,

                active:
                  true,
              },
            })
          );

        assert.equal(
          forbidden.status,
          400
        );

        const createdResponse =
          await simulationRoute.POST(
            request({
              path:
                "/api/admin/simulations",

              method:
                "POST",

              token:
                adminToken,

              body: {
                title:
                  "Novo Simulado 4B",

                bank:
                  "Cesgranrio",

                description:
                  "Novo simulado.",

                timeLimit:
                  45,
              },
            })
          );

        assert.equal(
          createdResponse.status,
          201
        );

        const created =
          await createdResponse.json();

        assert.equal(
          created.simulation.active,
          false
        );

        assert.equal(
          created.simulation.publishedAt,
          null
        );

        assert.deepEqual(
          created.simulation.productIds,
          []
        );

        assert.deepEqual(
          created.simulation.questionIds,
          []
        );
      }
    );


    test(
      "questões administrativas devem validar alternativas e mass assignment",
      async () => {
        const invalid =
          await questionRoute.POST(
            request({
              path:
                "/api/admin/questions",

              method:
                "POST",

              token:
                adminToken,

              body: {
                bank:
                  "Cesgranrio",

                subject:
                  "Português",

                questionText:
                  "Questão inválida",

                options: [
                  "A",
                  "B",
                ],

                correctAnswer:
                  5,
              },
            })
          );

        assert.equal(
          invalid.status,
          400
        );

        const massAssignment =
          await questionRoute.POST(
            request({
              path:
                "/api/admin/questions",

              method:
                "POST",

              token:
                adminToken,

              body: {
                bank:
                  "Cesgranrio",

                subject:
                  "Português",

                questionText:
                  "Questão",

                options: [
                  "A",
                  "B",
                ],

                correctAnswer:
                  0,

                createdAt:
                  "2000-01-01",
              },
            })
          );

        assert.equal(
          massAssignment.status,
          400
        );

        const createdResponse =
          await questionRoute.POST(
            request({
              path:
                "/api/admin/questions",

              method:
                "POST",

              token:
                adminToken,

              body: {
                bank:
                  "Cesgranrio",

                subject:
                  "Informática",

                questionText:
                  "Qual alternativa está correta?",

                options: [
                  "Primeira",
                  "Segunda",
                  "Terceira",
                ],

                correctAnswer:
                  1,

                explanation:
                  "A segunda é correta.",

                difficulty:
                  "easy",
              },
            })
          );

        assert.equal(
          createdResponse.status,
          201
        );

        const created =
          await createdResponse.json();

        assert.deepEqual(
          created.question.options,
          [
            "Primeira",
            "Segunda",
            "Terceira",
          ]
        );

        assert.equal(
          created.question.active,
          true
        );
      }
    );


    test(
      "relacionamentos devem persistir produto e ordem das questões",
      async () => {
        const context = {
          params:
            Promise.resolve({
              id:
                String(
                  simulationId
                ),
            }),
        };

        const productsResponse =
          await productRelationRoute.PUT(
            request({
              path:
                `/api/admin/simulations/${simulationId}/products`,

              method:
                "PUT",

              token:
                adminToken,

              body: {
                productIds: [
                  productId,
                ],
              },
            }),
            context
          );

        assert.equal(
          productsResponse.status,
          200
        );

        const questionsResponse =
          await questionRelationRoute.PUT(
            request({
              path:
                `/api/admin/simulations/${simulationId}/questions`,

              method:
                "PUT",

              token:
                adminToken,

              body: {
                questionIds: [
                  activeQuestionId,
                  unusedQuestionId,
                ],
              },
            }),
            context
          );

        assert.equal(
          questionsResponse.status,
          200
        );

        const questionsData =
          await questionsResponse.json();

        assert.deepEqual(
          questionsData.questionIds,
          [
            activeQuestionId,
            unusedQuestionId,
          ]
        );
      }
    );


    test(
      "relacionamentos devem rejeitar IDs duplicados e inexistentes",
      async () => {
        const context = {
          params:
            Promise.resolve({
              id:
                String(
                  simulationId
                ),
            }),
        };

        const duplicate =
          await questionRelationRoute.PUT(
            request({
              path:
                `/api/admin/simulations/${simulationId}/questions`,

              method:
                "PUT",

              token:
                adminToken,

              body: {
                questionIds: [
                  activeQuestionId,
                  activeQuestionId,
                ],
              },
            }),
            context
          );

        assert.equal(
          duplicate.status,
          400
        );

        const missing =
          await productRelationRoute.PUT(
            request({
              path:
                `/api/admin/simulations/${simulationId}/products`,

              method:
                "PUT",

              token:
                adminToken,

              body: {
                productIds: [
                  999999,
                ],
              },
            }),
            context
          );

        assert.equal(
          missing.status,
          400
        );
      }
    );


    test(
      "publicação deve ocorrer somente quando relações estiverem válidas",
      async () => {
        const response =
          await simulationRoute.PATCH(
            request({
              path:
                "/api/admin/simulations",

              method:
                "PATCH",

              token:
                adminToken,

              body: {
                id:
                  simulationId,

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
          data.simulation.active,
          true
        );

        assert.ok(
          data.simulation.publishedAt
        );
      }
    );


    test(
      "simulado publicado não pode perder todos os produtos ou questões",
      async () => {
        const context = {
          params:
            Promise.resolve({
              id:
                String(
                  simulationId
                ),
            }),
        };

        const productsResponse =
          await productRelationRoute.PUT(
            request({
              path:
                `/api/admin/simulations/${simulationId}/products`,

              method:
                "PUT",

              token:
                adminToken,

              body: {
                productIds:
                  [],
              },
            }),
            context
          );

        assert.equal(
          productsResponse.status,
          409
        );

        const questionsResponse =
          await questionRelationRoute.PUT(
            request({
              path:
                `/api/admin/simulations/${simulationId}/questions`,

              method:
                "PUT",

              token:
                adminToken,

              body: {
                questionIds:
                  [],
              },
            }),
            context
          );

        assert.equal(
          questionsResponse.status,
          409
        );
      }
    );


    test(
      "questão usada em simulado publicado não pode ser arquivada",
      async () => {
        const response =
          await questionRoute.PATCH(
            request({
              path:
                "/api/admin/questions",

              method:
                "PATCH",

              token:
                adminToken,

              body: {
                id:
                  activeQuestionId,

                active:
                  false,
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
          data.simulationIds.includes(
            simulationId
          )
        );
      }
    );


    test(
      "questão não utilizada pode ser arquivada depois de removida do simulado",
      async () => {
        const context = {
          params:
            Promise.resolve({
              id:
                String(
                  simulationId
                ),
            }),
        };

        const replaceResponse =
          await questionRelationRoute.PUT(
            request({
              path:
                `/api/admin/simulations/${simulationId}/questions`,

              method:
                "PUT",

              token:
                adminToken,

              body: {
                questionIds: [
                  activeQuestionId,
                ],
              },
            }),
            context
          );

        assert.equal(
          replaceResponse.status,
          200
        );

        const deleteResponse =
          await questionRoute.DELETE(
            request({
              path:
                `/api/admin/questions?id=${unusedQuestionId}`,

              method:
                "DELETE",

              token:
                adminToken,
            })
          );

        assert.equal(
          deleteResponse.status,
          200
        );

        const deleted =
          await deleteResponse.json();

        assert.equal(
          deleted.question.active,
          false
        );
      }
    );


    after(
      () => {
        isolated?.cleanup();
      }
    );
  }
);