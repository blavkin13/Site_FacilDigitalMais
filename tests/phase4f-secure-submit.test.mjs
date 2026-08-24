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
  "Fase 4.3B - Submit transacional e cronômetro seguro",
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

    let simulationId;
    let productId;
    let question1Id;
    let question2Id;
    let ownerOrderId;

    let startRoute;
    let submitRoute;


    function context() {
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


    async function setOwnerOrderStatus(
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
            ownerOrderId
          )
        );
    }


    async function start(
      token =
        ownerToken
    ) {
      const response =
        await startRoute.POST(
          request({
            path:
              `/api/simulations/${simulationId}/attempts`,

            method:
              "POST",

            token,
          }),
          context()
        );


      assert.ok(
        response.status ===
          200 ||
        response.status ===
          201
      );


      const data =
        await response.json();


      return data.attempt;
    }


    async function submit({
      session =
        ownerToken,
      attemptToken,
      answers,
      extra = {},
    }) {
      return submitRoute.POST(
        request({
          path:
            `/api/simulations/${simulationId}/submit`,

          method:
            "POST",

          token:
            session,

          body: {
            attemptToken,
            answers,
            ...extra,
          },
        }),
        context()
      );
    }


    function correctAnswers() {
      return [
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
      ];
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
            "owner-submit-43b@teste.local",
            "Senha123456",
            "Owner 43B"
          );


        otherUser =
          await auth.registerUser(
            "other-submit-43b@teste.local",
            "Senha123456",
            "Other 43B"
          );


        const ownerLogin =
          await auth.authenticateUser(
            "owner-submit-43b@teste.local",
            "Senha123456"
          );


        const otherLogin =
          await auth.authenticateUser(
            "other-submit-43b@teste.local",
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
                "produto-submit-43b",

              title:
                "Produto Submit 4.3B",

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
                  "Texto original congelado.",

                options:
                  JSON.stringify([
                    "A",
                    "B",
                    "C",
                  ]),

                correctAnswer:
                  1,

                explanation:
                  "B era a resposta no início.",

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
                  "Questão matemática original.",

                options:
                  JSON.stringify([
                    "A",
                    "B",
                  ]),

                correctAnswer:
                  0,

                explanation:
                  "A era a resposta.",

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
                "Simulado Submit 4.3B",

              bank:
                "Cesgranrio",

              description:
                "Teste transacional.",

              timeLimit:
                10,

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


        startRoute =
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
      "submit deve rejeitar timeSpent e score do navegador",
      async () => {
        const attempt =
          await start();


        const timeResponse =
          await submit({
            attemptToken:
              attempt.token,

            answers:
              correctAnswers(),

            extra: {
              timeSpent:
                1,
            },
          });


        assert.equal(
          timeResponse.status,
          400
        );


        const scoreResponse =
          await submit({
            attemptToken:
              attempt.token,

            answers:
              correctAnswers(),

            extra: {
              score:
                999,
            },
          });


        assert.equal(
          scoreResponse.status,
          400
        );


        const row =
          sqlite
            .prepare(`
              SELECT status
              FROM simulation_attempts
              WHERE token = ?
            `)
            .get(
              attempt.token
            );


        assert.equal(
          row.status,
          "in_progress"
        );
      }
    );


    test(
      "correção deve utilizar snapshot mesmo após alteração da questão",
      async () => {
        const attempt =
          await start();


        await db
          .update(
            schema.questions
          )
          .set({
            questionText:
              "Texto alterado depois do início.",

            correctAnswer:
              0,

            explanation:
              "Explicação alterada.",

            updatedAt:
              new Date()
                .toISOString(),
          })
          .where(
            eq(
              schema.questions.id,
              question1Id
            )
          );


        const response =
          await submit({
            attemptToken:
              attempt.token,

            answers:
              correctAnswers(),
          });


        assert.equal(
          response.status,
          200
        );


        const data =
          await response.json();


        assert.equal(
          data.score,
          2
        );


        assert.equal(
          data.detailedAnswers[0].questionText,
          "Texto original congelado."
        );


        assert.equal(
          data.detailedAnswers[0].correctAnswer,
          1
        );


        assert.equal(
          data.detailedAnswers[0].explanation,
          "B era a resposta no início."
        );


        const result =
          sqlite
            .prepare(`
              SELECT
                attempt_id,
                snapshot
              FROM simulation_results
              WHERE
                user_id = ?
                AND simulation_id = ?
              ORDER BY id DESC
              LIMIT 1
            `)
            .get(
              owner.id,
              simulationId
            );


        assert.equal(
          result.attempt_id,
          Number(
            sqlite
              .prepare(`
                SELECT id
                FROM simulation_attempts
                WHERE token = ?
              `)
              .get(
                attempt.token
              ).id
          )
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
          snapshot.questions[0].questionText,
          "Texto original congelado."
        );
      }
    );


    test(
      "mesma tentativa não pode gerar dois resultados",
      async () => {
        const completed =
          sqlite
            .prepare(`
              SELECT token
              FROM simulation_attempts
              WHERE
                user_id = ?
                AND simulation_id = ?
                AND status = 'completed'
              ORDER BY id DESC
              LIMIT 1
            `)
            .get(
              owner.id,
              simulationId
            );


        assert.ok(
          completed
        );


        const beforeCount =
          sqlite
            .prepare(`
              SELECT COUNT(*) AS total
              FROM simulation_results
              WHERE user_id = ?
            `)
            .get(
              owner.id
            ).total;


        const response =
          await submit({
            attemptToken:
              completed.token,

            answers:
              correctAnswers(),
          });


        assert.equal(
          response.status,
          409
        );


        const afterCount =
          sqlite
            .prepare(`
              SELECT COUNT(*) AS total
              FROM simulation_results
              WHERE user_id = ?
            `)
            .get(
              owner.id
            ).total;


        assert.equal(
          afterCount,
          beforeCount
        );
      }
    );


    test(
      "tentativa de outro usuário deve retornar 404",
      async () => {
        const otherAttempt =
          await start(
            otherToken
          );


        const response =
          await submit({
            session:
              ownerToken,

            attemptToken:
              otherAttempt.token,

            answers:
              correctAnswers(),
          });


        assert.equal(
          response.status,
          404
        );
      }
    );


    test(
      "refund durante a prova deve revogar o submit",
      async () => {
        const attempt =
          await start();


        await setOwnerOrderStatus(
          "refunded"
        );


        const response =
          await submit({
            attemptToken:
              attempt.token,

            answers:
              correctAnswers(),
          });


        assert.equal(
          response.status,
          403
        );


        const row =
          sqlite
            .prepare(`
              SELECT status
              FROM simulation_attempts
              WHERE token = ?
            `)
            .get(
              attempt.token
            );


        assert.equal(
          row.status,
          "revoked"
        );


        await setOwnerOrderStatus(
          "approved"
        );
      }
    );


    test(
      "submit após grace de expiração deve retornar 410",
      async () => {
        const attempt =
          await start();


        sqlite
          .prepare(`
            UPDATE simulation_attempts
            SET expires_at = ?
            WHERE token = ?
          `)
          .run(
            new Date(
              Date.now() -
                60_000
            ).toISOString(),

            attempt.token
          );


        const response =
          await submit({
            attemptToken:
              attempt.token,

            answers:
              correctAnswers(),
          });


        assert.equal(
          response.status,
          410
        );


        const row =
          sqlite
            .prepare(`
              SELECT status
              FROM simulation_attempts
              WHERE token = ?
            `)
            .get(
              attempt.token
            );


        assert.equal(
          row.status,
          "expired"
        );
      }
    );


    test(
      "timeSpent deve ser calculado pelo relógio do servidor",
      async () => {
        const attempt =
          await start();


        const now =
          Date.now();


        sqlite
          .prepare(`
            UPDATE simulation_attempts
            SET
              started_at = ?,
              expires_at = ?
            WHERE token = ?
          `)
          .run(
            new Date(
              now -
                125_000
            ).toISOString(),

            new Date(
              now +
                475_000
            ).toISOString(),

            attempt.token
          );


        const response =
          await submit({
            attemptToken:
              attempt.token,

            answers:
              correctAnswers(),
          });


        assert.equal(
          response.status,
          200
        );


        const data =
          await response.json();


        assert.ok(
          data.timeSpent >=
            124 &&
          data.timeSpent <=
            128,
          `Tempo server-side inesperado: ${data.timeSpent}`
        );
      }
    );


    test(
      "quiz deve usar attemptToken e contador monotônico",
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


        assert.match(
          source,
          /\/attempts/
        );


        assert.match(
          source,
          /attemptToken/
        );


        assert.match(
          source,
          /performance\.now\(\)/
        );


        assert.match(
          source,
          /sessionStorage/
        );


        assert.doesNotMatch(
          source,
          /JSON\.stringify\(\{\s*answers\s*,\s*timeSpent/
        );


        assert.doesNotMatch(
          source,
          /startTimeRef/
        );
      }
    );


    test(
      "submit seguro deve usar transação IMMEDIATE e attempt_id",
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


        assert.match(
          source,
          /transaction\.immediate\(\)/
        );


        assert.match(
          source,
          /attempt_id/
        );


        assert.match(
          source,
          /status = 'completed'/
        );


        assert.match(
          source,
          /SUBMISSION_GRACE_SECONDS/
        );


        assert.match(
          source,
          /parseSimulationAttemptSnapshot/
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