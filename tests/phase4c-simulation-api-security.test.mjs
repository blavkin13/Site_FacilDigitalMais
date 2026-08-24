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
  "Fase 4C - Segurança das APIs públicas de Simulados",
  () => {
    let isolated;
    let db;
    let schema;
    let eq;

    let userToken;
    let userId;

    let relatedProductId;
    let unrelatedProductId;

    let simulationId;

    let question1Id;
    let question2Id;
    let foreignQuestionId;

    let relatedOrderId;

    let listRoute;
    let detailRoute;
    let startAttemptRoute;
    let submitRoute;


    async function setRelatedOrderStatus(
      status
    ) {
      await db
        .update(
          schema.orders
        )
        .set({
          status,
        })
        .where(
          eq(
            schema.orders.id,
            relatedOrderId
          )
        );
    }

    async function startAttemptToken() {
      const response =
        await startAttemptRoute.POST(
          request({
            path:
              `/api/simulations/${simulationId}/attempts`,

            method:
              "POST",

            token:
              userToken,
          }),
          {
            params:
              Promise.resolve({
                id:
                  String(
                    simulationId
                  ),
              }),
          }
        );


      assert.ok(
        response.status ===
          200 ||
        response.status ===
          201
      );


      const data =
        await response.json();


      assert.match(
        data.attempt.token,
        /^[a-f0-9]{64}$/
      );


      return data.attempt.token;
    }


    before(
      async () => {
        isolated =
          await createIsolatedDatabase();

        schema =
          await import(
            "../db/schema.ts"
          );

        const database =
          await import(
            "../db/index.ts"
          );

        ({
          eq,
        } =
          await import(
            "drizzle-orm"
          ));

        const auth =
          await import(
            "../lib/auth.ts"
          );

        db =
          database.getDb();


        const user =
          await auth.registerUser(
            "aluno-4c@teste.local",
            "SenhaAluno123",
            "Aluno 4C"
          );

        assert.ok(
          user
        );

        userId =
          user.id;

        const login =
          await auth.authenticateUser(
            "aluno-4c@teste.local",
            "SenhaAluno123"
          );

        assert.ok(
          login
        );

        userToken =
          login.session.token;


        const productRows =
          await db
            .insert(
              schema.products
            )
            .values([
              {
                slug:
                  "produto-relacionado-4c",

                title:
                  "Produto Relacionado 4C",

                price:
                  79.9,

                active:
                  true,
              },

              {
                slug:
                  "produto-nao-relacionado-4c",

                title:
                  "Produto Não Relacionado 4C",

                price:
                  89.9,

                active:
                  true,
              },
            ])
            .returning();

        relatedProductId =
          productRows[0].id;

        unrelatedProductId =
          productRows[1].id;


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
                  "Questão oficial 1.",

                options:
                  JSON.stringify([
                    "A",
                    "B",
                    "C",
                  ]),

                correctAnswer:
                  1,

                explanation:
                  "Resposta B.",

                difficulty:
                  "easy",

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
                  "Questão oficial 2.",

                options:
                  JSON.stringify([
                    "A",
                    "B",
                  ]),

                correctAnswer:
                  0,

                explanation:
                  "Resposta A.",

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
                  "Informática",

                questionText:
                  "Questão estrangeira ao simulado.",

                options:
                  JSON.stringify([
                    "A",
                    "B",
                  ]),

                correctAnswer:
                  0,

                active:
                  true,

                updatedAt:
                  new Date()
                    .toISOString(),
              },
            ])
            .returning();

        question1Id =
          questionRows[0].id;

        question2Id =
          questionRows[1].id;

        foreignQuestionId =
          questionRows[2].id;


        const simulation =
          await db
            .insert(
              schema.simulations
            )
            .values({
              title:
                "Simulado Seguro 4C",

              bank:
                "Cesgranrio",

              description:
                "Teste das APIs públicas.",

              timeLimit:
                30,

              questionIds:
                "[]",

              active:
                true,

              publishedAt:
                new Date()
                  .toISOString(),

              updatedAt:
                new Date()
                  .toISOString(),
            })
            .returning();

        simulationId =
          simulation[0].id;


        await db
          .insert(
            schema.simulationProducts
          )
          .values({
            simulationId,

            productId:
              relatedProductId,
          });


        await db
          .insert(
            schema.simulationQuestions
          )
          .values([
            {
              simulationId,

              questionId:
                question1Id,

              position:
                1,
            },

            {
              simulationId,

              questionId:
                question2Id,

              position:
                2,
            },
          ]);


        const relatedOrder =
          await db
            .insert(
              schema.orders
            )
            .values({
              userId,

              status:
                "pending",

              subtotal:
                79.9,

              total:
                79.9,
            })
            .returning();

        relatedOrderId =
          relatedOrder[0].id;


        await db
          .insert(
            schema.orderItems
          )
          .values({
            orderId:
              relatedOrderId,

            productId:
              relatedProductId,

            quantity:
              1,

            unitPrice:
              79.9,
          });


        const unrelatedOrder =
          await db
            .insert(
              schema.orders
            )
            .values({
              userId,

              status:
                "approved",

              subtotal:
                89.9,

              total:
                89.9,
            })
            .returning();


        await db
          .insert(
            schema.orderItems
          )
          .values({
            orderId:
              unrelatedOrder[0].id,

            productId:
              unrelatedProductId,

            quantity:
              1,

            unitPrice:
              89.9,
          });


        listRoute =
          await import(
            "../app/api/simulations/route.ts"
          );

        detailRoute =
          await import(
            "../app/api/simulations/[id]/route.ts"
          );

        startAttemptRoute =
          await import(
            "../app/api/simulations/[id]/attempts/route.ts"
          );

        submitRoute =
          await import(
            "../app/api/simulations/[id]/submit/route.ts"
          );
      }
    );


    test(
      "compra aprovada de outro produto não deve listar o simulado",
      async () => {
        await setRelatedOrderStatus(
          "pending"
        );

        const response =
          await listRoute.GET(
            request({
              path:
                "/api/simulations",

              token:
                userToken,
            })
          );

        assert.equal(
          response.status,
          200
        );

        const data =
          await response.json();

        assert.equal(
          data.hasAccess,
          false
        );

        assert.deepEqual(
          data.simulations,
          []
        );
      }
    );


    test(
      "pedido aprovado do produto relacionado deve liberar somente o simulado relacionado",
      async () => {
        await setRelatedOrderStatus(
          "approved"
        );

        const response =
          await listRoute.GET(
            request({
              path:
                "/api/simulations",

              token:
                userToken,
            })
          );

        assert.equal(
          response.status,
          200
        );

        const data =
          await response.json();

        assert.equal(
          data.hasAccess,
          true
        );

        assert.equal(
          data.simulations.length,
          1
        );

        assert.equal(
          data.simulations[0].id,
          simulationId
        );
      }
    );


    test(
      "GET do simulado não deve expor gabarito nem explicação",
      async () => {
        await setRelatedOrderStatus(
          "approved"
        );

        const response =
          await detailRoute.GET(
            request({
              path:
                `/api/simulations/${simulationId}`,

              token:
                userToken,
            }),
            {
              params:
                Promise.resolve({
                  id:
                    String(
                      simulationId
                    ),
                }),
            }
          );

        assert.equal(
          response.status,
          200
        );

        const data =
          await response.json();

        assert.equal(
          data.questions.length,
          2
        );

        for (
          const question of
            data.questions
        ) {
          assert.equal(
            Object.hasOwn(
              question,
              "correctAnswer"
            ),
            false
          );

          assert.equal(
            Object.hasOwn(
              question,
              "explanation"
            ),
            false
          );
        }

        assert.deepEqual(
          data.questions.map(
            (
              question
            ) =>
              question.id
          ),
          [
            question1Id,
            question2Id,
          ]
        );
      }
    );


    test(
      "submit deve rejeitar score e tempo enviados pelo cliente",
      async () => {
        await setRelatedOrderStatus(
          "approved"
        );


        const attemptToken =
          await startAttemptToken();


        const scoreResponse =
          await submitRoute.POST(
            request({
              path:
                `/api/simulations/${simulationId}/submit`,

              method:
                "POST",

              token:
                userToken,

              body: {
                attemptToken,

                score:
                  999,

                answers: [
                  {
                    questionId:
                      question1Id,

                    selectedOption:
                      1,
                  },

                  {
                    questionId:
                      question2Id,

                    selectedOption:
                      0,
                  },
                ],
              },
            }),
            {
              params:
                Promise.resolve({
                  id:
                    String(
                      simulationId
                    ),
                }),
            }
          );


        assert.equal(
          scoreResponse.status,
          400
        );


        const timeResponse =
          await submitRoute.POST(
            request({
              path:
                `/api/simulations/${simulationId}/submit`,

              method:
                "POST",

              token:
                userToken,

              body: {
                attemptToken,

                timeSpent:
                  1,

                answers: [
                  {
                    questionId:
                      question1Id,

                    selectedOption:
                      1,
                  },

                  {
                    questionId:
                      question2Id,

                    selectedOption:
                      0,
                  },
                ],
              },
            }),
            {
              params:
                Promise.resolve({
                  id:
                    String(
                      simulationId
                    ),
                }),
            }
          );


        assert.equal(
          timeResponse.status,
          400
        );
      }
    );


    test(
      "submit deve rejeitar questão que não pertence ao snapshot da tentativa",
      async () => {
        await setRelatedOrderStatus(
          "approved"
        );


        const attemptToken =
          await startAttemptToken();


        const response =
          await submitRoute.POST(
            request({
              path:
                `/api/simulations/${simulationId}/submit`,

              method:
                "POST",

              token:
                userToken,

              body: {
                attemptToken,

                answers: [
                  {
                    questionId:
                      question1Id,

                    selectedOption:
                      1,
                  },

                  {
                    questionId:
                      foreignQuestionId,

                    selectedOption:
                      0,
                  },
                ],
              },
            }),
            {
              params:
                Promise.resolve({
                  id:
                    String(
                      simulationId
                    ),
                }),
            }
          );


        assert.equal(
          response.status,
          400
        );
      }
    );


    test(
      "submit deve calcular score pelo snapshot e persistir attempt_id",
      async () => {
        await setRelatedOrderStatus(
          "approved"
        );


        const attemptToken =
          await startAttemptToken();


        const response =
          await submitRoute.POST(
            request({
              path:
                `/api/simulations/${simulationId}/submit`,

              method:
                "POST",

              token:
                userToken,

              body: {
                attemptToken,

                answers: [
                  {
                    questionId:
                      question1Id,

                    selectedOption:
                      1,
                  },

                  {
                    questionId:
                      question2Id,

                    selectedOption:
                      null,
                  },
                ],
              },
            }),
            {
              params:
                Promise.resolve({
                  id:
                    String(
                      simulationId
                    ),
                }),
            }
          );


        assert.equal(
          response.status,
          200
        );


        const data =
          await response.json();


        assert.equal(
          data.score,
          1
        );


        assert.equal(
          data.totalQuestions,
          2
        );


        assert.equal(
          data.percentage,
          50
        );


        assert.ok(
          Number.isInteger(
            data.timeSpent
          )
        );


        const results =
          await db
            .select()
            .from(
              schema.simulationResults
            )
            .where(
              eq(
                schema.simulationResults.userId,
                userId
              )
            )
            .all();


        assert.equal(
          results.length,
          1
        );


        assert.ok(
          results[0].attemptId
        );


        assert.ok(
          results[0].snapshot
        );


        const snapshot =
          JSON.parse(
            results[0].snapshot
          );


        assert.equal(
          snapshot.version,
          2
        );


        assert.equal(
          snapshot.attempt.id,
          results[0].attemptId
        );


        assert.equal(
          snapshot.questions.length,
          2
        );


        assert.equal(
          snapshot.questions[0].questionId,
          question1Id
        );


        assert.equal(
          snapshot.questions[0].correctAnswer,
          1
        );
      }
    );


    test(
      "refund deve revogar detalhe e tentativa aberta no submit",
      async () => {
        await setRelatedOrderStatus(
          "approved"
        );


        const attemptToken =
          await startAttemptToken();


        await setRelatedOrderStatus(
          "refunded"
        );


        const detailResponse =
          await detailRoute.GET(
            request({
              path:
                `/api/simulations/${simulationId}`,

              token:
                userToken,
            }),
            {
              params:
                Promise.resolve({
                  id:
                    String(
                      simulationId
                    ),
                }),
            }
          );


        assert.equal(
          detailResponse.status,
          403
        );


        const submitResponse =
          await submitRoute.POST(
            request({
              path:
                `/api/simulations/${simulationId}/submit`,

              method:
                "POST",

              token:
                userToken,

              body: {
                attemptToken,

                answers: [
                  {
                    questionId:
                      question1Id,

                    selectedOption:
                      1,
                  },

                  {
                    questionId:
                      question2Id,

                    selectedOption:
                      0,
                  },
                ],
              },
            }),
            {
              params:
                Promise.resolve({
                  id:
                    String(
                      simulationId
                    ),
                }),
            }
          );


        assert.equal(
          submitResponse.status,
          403
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