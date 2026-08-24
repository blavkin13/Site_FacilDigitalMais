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
      "GET do simulado deve retornar somente metadados antes do início",
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


        assert.ok(
          data.simulation
        );


        assert.equal(
          data.simulation.id,
          simulationId
        );


        assert.equal(
          data.simulation.totalQuestions,
          2
        );


        /**
         * As questões somente podem sair do servidor
         * depois que uma attempt inicia o cronômetro.
         */
        assert.equal(
          Object.hasOwn(
            data,
            "questions"
          ),
          false
        );


        assert.equal(
          Object.hasOwn(
            data,
            "userHistory"
          ),
          false
        );


        const serialized =
          JSON.stringify(
            data
          );


        assert.equal(
          serialized.includes(
            "Questão oficial 1."
          ),
          false
        );


        assert.equal(
          serialized.includes(
            "correctAnswer"
          ),
          false
        );


        assert.equal(
          serialized.includes(
            "explanation"
          ),
          false
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


        /**
         * Desde a 4.4B.2B o POST /submit possui
         * resposta mínima.
         *
         * Score, tempo e revisão ficam disponíveis
         * somente através do resultado persistente
         * owner-only.
         */
        assert.equal(
          data.success,
          true
        );


        assert.deepEqual(
          Object.keys(
            data
          ).sort(),
          [
            "result",
            "success",
          ]
        );


        assert.deepEqual(
          Object.keys(
            data.result
          ),
          [
            "id",
          ]
        );


        assert.ok(
          Number.isInteger(
            data.result.id
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


        const result =
          results[0];


        /**
         * O ID retornado pelo submit deve apontar
         * exatamente para o resultado persistido.
         */
        assert.equal(
          result.id,
          data.result.id
        );


        /**
         * Questão 1:
         * selectedOption = 1
         * correctAnswer  = 1
         *
         * Questão 2:
         * não respondida.
         *
         * Resultado oficial: 1/2 = 50%.
         */
        assert.equal(
          result.score,
          1
        );


        assert.equal(
          result.totalQuestions,
          2
        );


        assert.equal(
          Math.round(
            (
              result.score /
              result.totalQuestions
            ) *
              100
          ),
          50
        );


        /**
         * timeSpent continua sendo produzido e
         * persistido pelo servidor, apenas deixou de
         * ser duplicado na resposta HTTP do submit.
         */
        assert.ok(
          Number.isInteger(
            result.timeSpent
          )
        );


        assert.ok(
          result.timeSpent >=
            0
        );


        /**
         * O resultado moderno precisa estar ligado
         * à tentativa server-side.
         */
        assert.ok(
          result.attemptId
        );


        assert.ok(
          result.snapshot
        );


        const snapshot =
          JSON.parse(
            result.snapshot
          );


        assert.equal(
          snapshot.version,
          2
        );


        assert.equal(
          snapshot.attempt.id,
          result.attemptId
        );


        assert.equal(
          snapshot.questions.length,
          2
        );


        assert.equal(
          snapshot.questions[0].questionId,
          question1Id
        );


        /**
         * Confirma que a correção persistida continua
         * baseada no snapshot congelado da tentativa.
         *
         * Esse dado existe no banco após conclusão;
         * ele não volta a ser enviado pelo POST.
         */
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