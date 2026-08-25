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


function assertNoForbiddenKeys(
  value,
  forbidden,
  path =
    "root"
) {
  if (
    Array.isArray(
      value
    )
  ) {
    value.forEach(
      (
        item,
        index
      ) => {
        assertNoForbiddenKeys(
          item,
          forbidden,
          `${path}[${index}]`
        );
      }
    );


    return;
  }


  if (
    typeof value !==
      "object" ||
    value ===
      null
  ) {
    return;
  }


  for (
    const [
      key,
      child,
    ] of Object.entries(
      value
    )
  ) {
    assert.equal(
      forbidden.has(
        key
      ),
      false,
      `Campo privado "${key}" encontrado em ${path}`
    );


    assertNoForbiddenKeys(
      child,
      forbidden,
      `${path}.${key}`
    );
  }
}


describe(
  "Fase 4.4B.2B - Privacidade das APIs de simulados",
  () => {
    let isolated;

    let db;
    let schema;

    let owner;
    let ownerToken;

    let other;
    let otherToken;

    let simulationId;
    let questionId;

    let ownerStartData;
    let ownerSubmitData;

    let ownerResultId;
    let otherResultId;

    let detailBeforeStart;

    let detailRoute;
    let startRoute;
    let submitRoute;
    let resultRoute;
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


    async function createApprovedOrder(
      userId,
      productId
    ) {
      const orders =
        await db
          .insert(
            schema.orders
          )
          .values({
            userId,

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
            orders[0].id,

          productId,

          quantity:
            1,

          unitPrice:
            99.9,
        });
    }


    async function startAndSubmit({
      token,
      selectedOption,
    }) {
      const startResponse =
        await startRoute.POST(
          request({
            path:
              `/api/simulations/${simulationId}/attempts`,

            method:
              "POST",

            token,
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

            token,

            body: {
              attemptToken:
                startData
                  .attempt
                  .token,

              answers: [
                {
                  questionId,

                  selectedOption,
                },
              ],
            },
          }),
          simulationContext()
        );


      assert.equal(
        submitResponse.status,
        200
      );


      const submitData =
        await submitResponse.json();


      return {
        startData,
        submitData,
      };
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


        const auth =
          await import(
            "../lib/auth.ts"
          );


        db =
          database.getDb();


        owner =
          await auth.registerUser(
            "joao-owner-privacy@teste.local",
            "SenhaPrivacy123!",
            "João Proprietário Silva",
            "11122233344",
            "(11) 99999-1111"
          );


        other =
          await auth.registerUser(
            "maria-other-privacy@teste.local",
            "SenhaPrivacy123!",
            "Maria Outra Participante",
            "55566677788",
            "(11) 99999-2222"
          );


        assert.ok(
          owner
        );


        assert.ok(
          other
        );


        const ownerLogin =
          await auth.authenticateUser(
            owner.email,
            "SenhaPrivacy123!"
          );


        const otherLogin =
          await auth.authenticateUser(
            other.email,
            "SenhaPrivacy123!"
          );


        assert.ok(
          ownerLogin
        );


        assert.ok(
          otherLogin
        );


        ownerToken =
          ownerLogin
            .session
            .token;


        otherToken =
          otherLogin
            .session
            .token;


        const products =
          await db
            .insert(
              schema.products
            )
            .values({
              slug:
                "produto-privacy-44b2b",

              title:
                "Produto Privacy 4.4B.2B",

              price:
                99.9,

              active:
                true,
            })
            .returning();


        const productId =
          products[0].id;


        const questions =
          await db
            .insert(
              schema.questions
            )
            .values({
              bank:
                "Cesgranrio",

              subject:
                "Português",

              questionText:
                "ENUNCIADO_PRIVADO_44B2B",

              options:
                JSON.stringify([
                  "Alternativa A",
                  "Alternativa B",
                ]),

              correctAnswer:
                1,

              explanation:
                "EXPLICACAO_PRIVADA_44B2B",

              difficulty:
                "easy",

              active:
                true,

              updatedAt:
                new Date()
                  .toISOString(),
            })
            .returning();


        questionId =
          questions[0].id;


        const simulations =
          await db
            .insert(
              schema.simulations
            )
            .values({
              title:
                "Simulado Privacy 4.4B.2B",

              bank:
                "Cesgranrio",

              description:
                "Auditoria de privacidade.",

              timeLimit:
                20,

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
          .values({
            simulationId,

            questionId,

            position:
              1,
          });


        await createApprovedOrder(
          owner.id,
          productId
        );


        await createApprovedOrder(
          other.id,
          productId
        );


        detailRoute =
          await import(
            "../app/api/simulations/[id]/route.ts"
          );


        startRoute =
          await import(
            "../app/api/simulations/[id]/attempts/route.ts"
          );


        submitRoute =
          await import(
            "../app/api/simulations/[id]/submit/route.ts"
          );


        resultRoute =
          await import(
            "../app/api/simulations/[id]/results/[resultId]/route.ts"
          );


        historyRoute =
          await import(
            "../app/api/simulations/results/route.ts"
          );


        /**
         * Capturamos o detalhe ANTES de iniciar
         * qualquer tentativa.
         */
        const detailResponse =
          await detailRoute.GET(
            request({
              path:
                `/api/simulations/${simulationId}`,

              token:
                ownerToken,
            }),
            simulationContext()
          );


        assert.equal(
          detailResponse.status,
          200
        );


        detailBeforeStart =
          await detailResponse.json();


        const ownerFlow =
          await startAndSubmit({
            token:
              ownerToken,

            selectedOption:
              1,
          });


        ownerStartData =
          ownerFlow.startData;


        ownerSubmitData =
          ownerFlow.submitData;


        ownerResultId =
          ownerSubmitData
            .result
            .id;


        const otherFlow =
          await startAndSubmit({
            token:
              otherToken,

            selectedOption:
              0,
          });


        otherResultId =
          otherFlow
            .submitData
            .result
            .id;
      }
    );


    test(
      "detalhe pré-prova deve retornar somente metadados",
      () => {
        assert.ok(
          detailBeforeStart
            .simulation
        );


        assert.equal(
          detailBeforeStart
            .simulation
            .totalQuestions,
          1
        );


        assert.equal(
          Object.hasOwn(
            detailBeforeStart,
            "questions"
          ),
          false
        );


        assert.equal(
          Object.hasOwn(
            detailBeforeStart,
            "userHistory"
          ),
          false
        );


        const serialized =
          JSON.stringify(
            detailBeforeStart
          );


        assert.equal(
          serialized.includes(
            "ENUNCIADO_PRIVADO_44B2B"
          ),
          false
        );


        assert.equal(
          serialized.includes(
            "Alternativa A"
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
            "EXPLICACAO_PRIVADA_44B2B"
          ),
          false
        );
      }
    );


    test(
      "questões devem aparecer somente depois que attempt inicia",
      () => {
        assert.equal(
          ownerStartData
            .attempt
            .questions
            .length,
          1
        );


        assert.equal(
          ownerStartData
            .attempt
            .questions[0]
            .questionText,
          "ENUNCIADO_PRIVADO_44B2B"
        );


        const forbidden =
          new Set([
            "correctAnswer",
            "explanation",
            "questionSnapshot",
            "question_snapshot",
            "passwordHash",
            "cpf",
            "phone",
            "email",
            "userId",
          ]);


        assertNoForbiddenKeys(
          ownerStartData,
          forbidden
        );


        const serialized =
          JSON.stringify(
            ownerStartData
          );


        assert.equal(
          serialized.includes(
            "EXPLICACAO_PRIVADA_44B2B"
          ),
          false
        );
      }
    );


    test(
      "submit deve retornar somente o ID persistente",
      () => {
        assert.deepEqual(
          Object.keys(
            ownerSubmitData
          ).sort(),
          [
            "result",
            "success",
          ]
        );


        assert.deepEqual(
          Object.keys(
            ownerSubmitData
              .result
          ),
          [
            "id",
          ]
        );


        assert.equal(
          ownerSubmitData
            .success,
          true
        );


        assert.equal(
          Number.isInteger(
            ownerResultId
          ),
          true
        );


        const serialized =
          JSON.stringify(
            ownerSubmitData
          );


        const forbiddenStrings = [
          "correctAnswer",
          "explanation",
          "detailedAnswers",
          "ranking",
          "snapshot",
          "score",
          "timeSpent",
          "userPosition",
          "totalParticipants",
        ];


        for (
          const forbidden of
            forbiddenStrings
        ) {
          assert.equal(
            serialized.includes(
              forbidden
            ),
            false,
            `${forbidden} não deve sair no POST /submit`
          );
        }
      }
    );


    test(
      "resultado owner-only pode liberar revisão sem dados privados brutos",
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
          data.result
            .detailedAnswers[0]
            .correctAnswer,
          1
        );


        assert.equal(
          data.result
            .detailedAnswers[0]
            .explanation,
          "EXPLICACAO_PRIVADA_44B2B"
        );


        /**
         * correctAnswer e explanation são
         * deliberadamente permitidos aqui,
         * pois a tentativa pertence ao usuário
         * e já foi concluída.
         */
        const forbidden =
          new Set([
            "passwordHash",
            "email",
            "cpf",
            "phone",
            "userId",
            "attemptId",
            "snapshot",
            "answers",
            "token",
            "questionSnapshot",
            "question_snapshot",
          ]);


        assertNoForbiddenKeys(
          data,
          forbidden
        );
      }
    );


    test(
      "ranking não deve expor identidade nem metadata desnecessária",
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


        const data =
          await response.json();


        assert.equal(
          data.ranking.length,
          2
        );


        assert.equal(
          data.ranking[0].name,
          "Você"
        );


        assert.equal(
          data.ranking[1].name,
          "Aluno 2"
        );


        for (
          const entry of
            data.ranking
        ) {
          assert.equal(
            Object.hasOwn(
              entry,
              "userId"
            ),
            false
          );


          assert.equal(
            Object.hasOwn(
              entry,
              "completedAt"
            ),
            false
          );


          assert.equal(
            Object.hasOwn(
              entry,
              "email"
            ),
            false
          );


          assert.equal(
            Object.hasOwn(
              entry,
              "cpf"
            ),
            false
          );


          assert.equal(
            Object.hasOwn(
              entry,
              "phone"
            ),
            false
          );


          assert.equal(
            typeof entry.percentage,
            "number"
          );


          assert.equal(
            typeof entry.authoritativeTime,
            "boolean"
          );
        }


        const serialized =
          JSON.stringify(
            data.ranking
          );


        assert.equal(
          serialized.includes(
            owner.name
          ),
          false
        );


        assert.equal(
          serialized.includes(
            other.name
          ),
          false
        );


        assert.equal(
          serialized.includes(
            owner.email
          ),
          false
        );


        assert.equal(
          serialized.includes(
            other.email
          ),
          false
        );
      }
    );


    test(
      "resultado de outro aluno continua indistinguível de inexistente",
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


        const data =
          await response.json();


        assert.equal(
          data.error,
          "Resultado não encontrado."
        );
      }
    );


    test(
      "histórico deve conter apenas dados do próprio usuário",
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
          data.results.length,
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


        const forbidden =
          new Set([
            "passwordHash",
            "email",
            "cpf",
            "phone",
            "userId",
            "attemptId",
            "snapshot",
            "answers",
            "token",
            "detailedAnswers",
            "correctAnswer",
            "explanation",
          ]);


        assertNoForbiddenKeys(
          data,
          forbidden
        );
      }
    );


    test(
      "ranking não deve consultar tabela users",
      async () => {
        const source =
          await readFile(
            join(
              process.cwd(),
              "lib",
              "simulation-attempt-submit.ts"
            ),
            "utf8"
          );


        const rankingStart =
          source.indexOf(
            "export async function getSimulationRanking"
          );


        assert.ok(
          rankingStart >=
            0
        );


        const rankingSource =
          source.slice(
            rankingStart
          );


        assert.doesNotMatch(
          rankingSource,
          /JOIN\s+users/i
        );


        assert.doesNotMatch(
          rankingSource,
          /u\.name/
        );


        assert.doesNotMatch(
          rankingSource,
          /userName/
        );


        assert.match(
          rankingSource,
          /Aluno \$\{position\}/
        );
      }
    );


    test(
      "submit HTTP não deve duplicar revisão ou ranking",
      async () => {
        const source =
          await readFile(
            join(
              process.cwd(),
              "app",
              "api",
              "simulations",
              "[id]",
              "submit",
              "route.ts"
            ),
            "utf8"
          );


        assert.match(
          source,
          /finalizeSimulationAttempt/
        );


        assert.doesNotMatch(
          source,
          /getSimulationRanking/
        );


        assert.doesNotMatch(
          source,
          /detailedAnswers/
        );


        assert.doesNotMatch(
          source,
          /correctAnswer/
        );


        assert.doesNotMatch(
          source,
          /userPosition/
        );


        assert.doesNotMatch(
          source,
          /totalParticipants/
        );
      }
    );


    test(
      "UI não deve exibir data individual de terceiros no ranking",
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
          /entry\.completedAt/
        );


        assert.match(
          source,
          /entry\.percentage/
        );


        assert.match(
          source,
          /entry\.timeSpent\s*===/
        );
      }
    );


    test(
      "package deve incluir gate de privacidade",
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
            "test:phase4l-api-privacy"
          ]
        );


        assert.ok(
          packageJson.scripts[
            "test:phase4-api-privacy"
          ].includes(
            "test:phase4l-api-privacy"
          )
        );


        assert.ok(
          packageJson.scripts[
            "test:phase4-qa"
          ].includes(
            "test:phase4-api-privacy"
          )
        );


        assert.ok(
          packageJson.scripts[
            "test:all"
          ].includes(
            "test:phase4-qa"
          )
        );
      }
    );


    after(
      () => {
        isolated
          ?.cleanup();
      }
    );
  }
);