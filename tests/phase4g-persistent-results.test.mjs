import {
  after,
  before,
  describe,
  test,
} from "node:test";

import assert from "node:assert/strict";

import {
  readFile,
} from "node:fs/promises";

import {
  join,
} from "node:path";

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
  "Fase 4.3C - Resultado persistente, histórico e ranking",
  () => {
    let isolated;
    let db;
    let sqlite;
    let schema;
    let eq;

    let owner;
    let ownerToken;

    let otherUser;
    let otherToken;

    let rankingUser;

    let simulationId;
    let productId;

    let question1Id;
    let question2Id;

    let ownerOrderId;

    let ownerResultId;
    let otherResultId;

    let resultRoute;
    let latestRoute;
    let historyRoute;


    function simulationContext() {
      return {
        params:
          Promise.resolve({
            id:
              String(
                simulationId
              ),
          }),
      };
    }


    function resultContext(
      resultId
    ) {
      return {
        params:
          Promise.resolve({
            id:
              String(
                simulationId
              ),

            resultId:
              String(
                resultId
              ),
          }),
      };
    }


    async function startAndSubmit({
      sessionToken,
      answers,
    }) {
      const startRoute =
        await import(
          "../app/api/simulations/[id]/attempts/route.ts"
        );


      const submitRoute =
        await import(
          "../app/api/simulations/[id]/submit/route.ts"
        );


      const startResponse =
        await startRoute.POST(
          request({
            path:
              `/api/simulations/${simulationId}/attempts`,

            method:
              "POST",

            token:
              sessionToken,
          }),
          simulationContext()
        );


      assert.ok(
        startResponse.status ===
          200 ||
        startResponse.status ===
          201
      );


      const startData =
        await startResponse.json();


      const submitResponse =
        await submitRoute.POST(
          request({
            path:
              `/api/simulations/${simulationId}/submit`,

            method:
              "POST",

            token:
              sessionToken,

            body: {
              attemptToken:
                startData
                  .attempt
                  .token,

              answers,
            },
          }),
          simulationContext()
        );


      assert.equal(
        submitResponse.status,
        200
      );


      return submitResponse.json();
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

        sqlite =
          database.getSqliteConnection();


        owner =
          await auth.registerUser(
            "owner-result-43c@teste.local",
            "Senha123456",
            "Owner Resultado"
          );


        otherUser =
          await auth.registerUser(
            "other-result-43c@teste.local",
            "Senha123456",
            "Outro Aluno"
          );


        rankingUser =
          await auth.registerUser(
            "ranking-result-43c@teste.local",
            "Senha123456",
            "Aluno Legado"
          );


        const ownerLogin =
          await auth.authenticateUser(
            "owner-result-43c@teste.local",
            "Senha123456"
          );


        const otherLogin =
          await auth.authenticateUser(
            "other-result-43c@teste.local",
            "Senha123456"
          );


        assert.ok(
          ownerLogin
        );

        assert.ok(
          otherLogin
        );


        ownerToken =
          ownerLogin.session.token;

        otherToken =
          otherLogin.session.token;


        const products =
          await db
            .insert(
              schema.products
            )
            .values({
              slug:
                "produto-result-43c",

              title:
                "Produto Resultado 4.3C",

              price:
                99.9,

              active:
                true,
            })
            .returning();


        productId =
          products[0].id;


        const questions =
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
                  "Questão persistente 1.",

                options:
                  JSON.stringify([
                    "A",
                    "B",
                  ]),

                correctAnswer:
                  1,

                explanation:
                  "B correta.",

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
                  "Questão persistente 2.",

                options:
                  JSON.stringify([
                    "A",
                    "B",
                  ]),

                correctAnswer:
                  0,

                explanation:
                  "A correta.",

                difficulty:
                  "medium",

                active:
                  true,

                updatedAt:
                  new Date()
                    .toISOString(),
              },
            ])
            .returning();


        question1Id =
          questions[0].id;

        question2Id =
          questions[1].id;


        const simulations =
          await db
            .insert(
              schema.simulations
            )
            .values({
              title:
                "Simulado Resultado Persistente",

              bank:
                "Cesgranrio",

              description:
                "Teste 4.3C",

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
          simulations[0].id;


        await db
          .insert(
            schema.simulationProducts
          )
          .values({
            simulationId,
            productId,
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


        const ownerOrder =
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
                99.9,

              total:
                99.9,
            })
            .returning();


        ownerOrderId =
          ownerOrder[0].id;


        await db
          .insert(
            schema.orderItems
          )
          .values({
            orderId:
              ownerOrderId,

            productId,

            quantity:
              1,

            unitPrice:
              99.9,
          });


        const otherOrder =
          await db
            .insert(
              schema.orders
            )
            .values({
              userId:
                otherUser.id,

              status:
                "approved",

              subtotal:
                99.9,

              total:
                99.9,
            })
            .returning();


        await db
          .insert(
            schema.orderItems
          )
          .values({
            orderId:
              otherOrder[0].id,

            productId,

            quantity:
              1,

            unitPrice:
              99.9,
          });


        const ownerResult =
          await startAndSubmit({
            sessionToken:
              ownerToken,

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
          });


        ownerResultId =
          ownerResult.result.id;


        const otherResult =
          await startAndSubmit({
            sessionToken:
              otherToken,

            answers: [
              {
                questionId:
                  question1Id,

                selectedOption:
                  0,
              },

              {
                questionId:
                  question2Id,

                selectedOption:
                  0,
              },
            ],
          });


        otherResultId =
          otherResult.result.id;


        /**
         * Resultado legado com score absoluto maior:
         *
         * 3/4 = 75%
         *
         * Owner:
         * 2/2 = 100%
         *
         * O ranking definitivo deve manter o
         * resultado 2/2 acima de 3/4.
         */
        await db
          .insert(
            schema.simulationResults
          )
          .values({
            userId:
              rankingUser.id,

            simulationId,

            score:
              3,

            totalQuestions:
              4,

            timeSpent:
              50,

            answers:
              "[]",

            snapshot:
              null,

            completedAt:
              new Date(
                Date.now() -
                  60_000
              ).toISOString(),
          });


        resultRoute =
          await import(
            "../app/api/simulations/[id]/results/[resultId]/route.ts"
          );


        latestRoute =
          await import(
            "../app/api/simulations/[id]/results/latest/route.ts"
          );


        historyRoute =
          await import(
            "../app/api/simulations/results/route.ts"
          );
      }
    );


    test(
      "dono deve recuperar resultado persistido com revisão e ranking",
      async () => {
        const response =
          await resultRoute.GET(
            request({
              path:
                `/api/simulations/${simulationId}/results/${ownerResultId}`,

              token:
                ownerToken,
            }),
            resultContext(
              ownerResultId
            )
          );


        assert.equal(
          response.status,
          200
        );


        const data =
          await response.json();


        assert.equal(
          data.result.id,
          ownerResultId
        );


        assert.equal(
          data.result.score,
          2
        );


        assert.equal(
          data.result.totalQuestions,
          2
        );


        assert.equal(
          data.result.percentage,
          100
        );


        assert.equal(
          data.result.authoritativeTime,
          true
        );


        assert.equal(
          data.result.reviewAvailable,
          true
        );


        assert.equal(
          data.result.detailedAnswers.length,
          2
        );


        assert.equal(
          data.result.detailedAnswers[0].correctAnswer,
          1
        );


        assert.equal(
          Object.hasOwn(
            data.result,
            "snapshot"
          ),
          false
        );


        assert.equal(
          Object.hasOwn(
            data.result,
            "answers"
          ),
          false
        );


        assert.equal(
          data.userPosition,
          1
        );


        assert.equal(
          data.totalParticipants,
          3
        );


        assert.equal(
          data.ranking[0].score,
          2
        );


        assert.equal(
          data.ranking[0].totalQuestions,
          2
        );
      }
    );


    test(
      "resultado de outro usuário deve ser indistinguível de inexistente",
      async () => {
        const response =
          await resultRoute.GET(
            request({
              path:
                `/api/simulations/${simulationId}/results/${otherResultId}`,

              token:
                ownerToken,
            }),
            resultContext(
              otherResultId
            )
          );


        assert.equal(
          response.status,
          404
        );
      }
    );


    test(
      "rota latest deve retornar somente o último resultado do próprio usuário",
      async () => {
        const response =
          await latestRoute.GET(
            request({
              path:
                `/api/simulations/${simulationId}/results/latest`,

              token:
                ownerToken,
            }),
            simulationContext()
          );


        assert.equal(
          response.status,
          200
        );


        const data =
          await response.json();


        assert.equal(
          data.result.id,
          ownerResultId
        );


        assert.equal(
          data.result.simulationId,
          simulationId
        );
      }
    );


    test(
      "histórico deve conter apenas resultados do usuário autenticado",
      async () => {
        const response =
          await historyRoute.GET(
            request({
              path:
                "/api/simulations/results",

              token:
                ownerToken,
            })
          );


        assert.equal(
          response.status,
          200
        );


        const data =
          await response.json();


        assert.equal(
          data.total,
          1
        );


        assert.equal(
          data.results[0].id,
          ownerResultId
        );


        assert.equal(
          data.results.some(
            (
              result
            ) =>
              result.id ===
              otherResultId
          ),
          false
        );
      }
    );


    test(
      "refund e despublicação não devem apagar acesso ao resultado histórico",
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
              ownerOrderId
            )
          );


        await db
          .update(
            schema.simulations
          )
          .set({
            active:
              false,
          })
          .where(
            eq(
              schema.simulations.id,
              simulationId
            )
          );


        const resultResponse =
          await resultRoute.GET(
            request({
              path:
                `/api/simulations/${simulationId}/results/${ownerResultId}`,

              token:
                ownerToken,
            }),
            resultContext(
              ownerResultId
            )
          );


        assert.equal(
          resultResponse.status,
          200
        );


        const historyResponse =
          await historyRoute.GET(
            request({
              path:
                "/api/simulations/results",

              token:
                ownerToken,
            })
          );


        assert.equal(
          historyResponse.status,
          200
        );


        const history =
          await historyResponse.json();


        assert.equal(
          history.results[0].id,
          ownerResultId
        );
      }
    );


    test(
      "resultado visual não deve depender de sessionStorage",
      async () => {
        const source =
          await readFile(
            join(
              process.cwd(),
              "components",
              "simulation-results.tsx"
            ),
            "utf8"
          );


        assert.doesNotMatch(
          source,
          /sessionStorage/
        );


        assert.match(
          source,
          /\/results\/latest/
        );


        assert.match(
          source,
          /detailedAnswers/
        );


        assert.match(
          source,
          /correctAnswer/
        );


        assert.match(
          source,
          /explanation/
        );


        assert.match(
          source,
          /totalParticipants/
        );
      }
    );


    test(
      "quiz deve redirecionar para URL persistente do resultado",
      async () => {
        const source =
          await readFile(
            join(
              process.cwd(),
              "components",
              "simulation-quiz.tsx"
            ),
            "utf8"
          );


        assert.doesNotMatch(
          source,
          /sim_result_\$\{simulation\.id\}/
        );


        assert.match(
          source,
          /data\s*\?\.\s*result\s*\?\.\s*id/
        );


        assert.match(
          source,
          /resultado\/\$\{resultId\}/
        );


        assert.match(
          source,
          /router\.replace/
        );
      }
    );


    test(
      "histórico deve apontar para resultados permanentes",
      async () => {
        const source =
          await readFile(
            join(
              process.cwd(),
              "components",
              "simulation-history.tsx"
            ),
            "utf8"
          );


        assert.match(
          source,
          /\/api\/simulations\/results/
        );


        assert.match(
          source,
          /resultado\/\$\{result\.id\}/
        );


        assert.match(
          source,
          /MELHOR RESULTADO/
        );
      }
    );


    test(
      "página permanente de resultado deve existir",
      async () => {
        const source =
          await readFile(
            join(
              process.cwd(),
              "app",
              "simulados",
              "[id]",
              "resultado",
              "[resultId]",
              "page.tsx"
            ),
            "utf8"
          );


        assert.match(
          source,
          /SimulationResults/
        );


        assert.match(
          source,
          /resultId/
        );
      }
    );


    test(
      "ranking deve usar percentual e não expor identidade dos participantes",
      async () => {
        const service =
          await import(
            "../lib/simulation-attempt-submit.ts"
          );


        const ranking =
          await service.getSimulationRanking(
            simulationId,
            owner.id
          );


        assert.equal(
          ranking.userPosition,
          1
        );


        const first =
          ranking.ranking[0];


        assert.equal(
          first.score,
          2
        );


        assert.equal(
          first.totalQuestions,
          2
        );


        assert.equal(
          first.percentage,
          100
        );


        assert.equal(
          first.name,
          "Você"
        );


        assert.equal(
          first.isCurrentUser,
          true
        );


        /**
         * Resultado legado:
         *
         * 3/4 = 75%
         *
         * Continua abaixo de:
         *
         * 2/2 = 100%
         */
        const legacy =
          ranking.ranking.find(
            (
              entry
            ) =>
              entry.score ===
                3 &&
              entry.totalQuestions ===
                4
          );


        assert.ok(
          legacy
        );


        assert.equal(
          legacy.percentage,
          75
        );


        assert.ok(
          legacy.position >
            1
        );


        /**
         * Nome real não é devolvido.
         */
        assert.match(
          legacy.name,
          /^Aluno \d+$/
        );


        assert.notEqual(
          legacy.name,
          "Aluno Legado"
        );


        /**
         * Tempo legado não é autoritativo e não
         * deve ser exibido no ranking.
         */
        assert.equal(
          legacy.authoritativeTime,
          false
        );


        assert.equal(
          legacy.timeSpent,
          null
        );


        /**
         * completedAt continua sendo critério interno
         * de desempate, mas não é metadata pública.
         */
        assert.equal(
          Object.hasOwn(
            legacy,
            "completedAt"
          ),
          false
        );


        assert.equal(
          Object.hasOwn(
            legacy,
            "userId"
          ),
          false
        );
      }
    );


    test(
      "package deve incluir a regressão da Fase 4.3C",
      async () => {
        const packageJson =
          JSON.parse(
            await readFile(
              join(
                process.cwd(),
                "package.json"
              ),
              "utf8"
            )
          );


        assert.ok(
          packageJson.scripts[
            "test:phase4g-results"
          ]
        );


        assert.ok(
          packageJson.scripts[
            "test:phase4-student-security"
          ].includes(
            "test:phase4g-results"
          )
        );


        assert.ok(
          packageJson.scripts[
            "test:all"
          ].includes(
            "test:phase4-student-security"
          )
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