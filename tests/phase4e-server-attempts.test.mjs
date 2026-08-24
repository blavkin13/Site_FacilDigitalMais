import {
  after,
  before,
  describe,
  test,
} from "node:test";

import assert from "node:assert/strict";

import {
  randomBytes,
} from "node:crypto";

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

  return new NextRequest(
    `http://localhost${path}`,
    {
      method,
      headers,
    }
  );
}


describe(
  "Fase 4.3A - Tentativas server-side de Simulados",
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

    let outsiderToken;

    let simulationId;
    let inactiveSimulationId;
    let questionId;
    let productId;
    let ownerOrderId;

    let startRoute;
    let attemptRoute;


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


    function startContext(
      id =
        simulationId
    ) {
      return {
        params:
          Promise.resolve({
            id:
              String(
                id
              ),
          }),
      };
    }


    function attemptContext(
      token,
      id =
        simulationId
    ) {
      return {
        params:
          Promise.resolve({
            id:
              String(
                id
              ),

            token,
          }),
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
            "owner-attempt@teste.local",
            "Senha123456",
            "Aluno Owner"
          );

        otherUser =
          await auth.registerUser(
            "other-attempt@teste.local",
            "Senha123456",
            "Aluno Other"
          );

        await auth.registerUser(
          "outsider-attempt@teste.local",
          "Senha123456",
          "Aluno Outsider"
        );


        const ownerLogin =
          await auth.authenticateUser(
            "owner-attempt@teste.local",
            "Senha123456"
          );

        const otherLogin =
          await auth.authenticateUser(
            "other-attempt@teste.local",
            "Senha123456"
          );

        const outsiderLogin =
          await auth.authenticateUser(
            "outsider-attempt@teste.local",
            "Senha123456"
          );


        assert.ok(
          ownerLogin
        );

        assert.ok(
          otherLogin
        );

        assert.ok(
          outsiderLogin
        );


        ownerToken =
          ownerLogin.session.token;

        otherToken =
          otherLogin.session.token;

        outsiderToken =
          outsiderLogin.session.token;


        const productRows =
          await db
            .insert(
              schema.products
            )
            .values({
              slug:
                "produto-attempt-43a",

              title:
                "Produto Attempts 4.3A",

              price:
                99.9,

              active:
                true,
            })
            .returning();


        productId =
          productRows[0].id;


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
                "Questão congelada da tentativa.",

              options:
                JSON.stringify([
                  "Alternativa A",
                  "Alternativa B",
                  "Alternativa C",
                ]),

              correctAnswer:
                1,

              explanation:
                "A alternativa B é a correta.",

              difficulty:
                "medium",

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
            .values([
              {
                title:
                  "Simulado Attempts 4.3A",

                bank:
                  "Cesgranrio",

                description:
                  "Teste de tentativa server-side.",

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
              },

              {
                title:
                  "Simulado Inativo Attempts",

                bank:
                  "Cesgranrio",

                timeLimit:
                  30,

                questionIds:
                  "[]",

                active:
                  false,

                updatedAt:
                  new Date()
                    .toISOString(),
              },
            ])
            .returning();


        simulationId =
          simulations[0].id;

        inactiveSimulationId =
          simulations[1].id;


        await db
          .insert(
            schema.simulationProducts
          )
          .values([
            {
              simulationId,

              productId,
            },

            {
              simulationId:
                inactiveSimulationId,

              productId,
            },
          ]);


        await db
          .insert(
            schema.simulationQuestions
          )
          .values([
            {
              simulationId,

              questionId,

              position:
                1,
            },

            {
              simulationId:
                inactiveSimulationId,

              questionId,

              position:
                1,
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

        attemptRoute =
          await import(
            "../app/api/simulations/[id]/attempts/[token]/route.ts"
          );
      }
    );


    test(
      "migration 0004 deve criar simulation_attempts e attempt_id",
      () => {
        const tables =
          sqlite
            .prepare(`
              SELECT name
              FROM sqlite_master
              WHERE type = 'table'
            `)
            .all()
            .map(
              (
                row
              ) =>
                row.name
            );


        assert.ok(
          tables.includes(
            "simulation_attempts"
          )
        );


        const resultColumns =
          sqlite
            .prepare(`
              PRAGMA table_info(simulation_results)
            `)
            .all()
            .map(
              (
                row
              ) =>
                row.name
            );


        assert.ok(
          resultColumns.includes(
            "attempt_id"
          )
        );


        const migration =
          sqlite
            .prepare(`
              SELECT id
              FROM schema_migrations
              WHERE id = ?
            `)
            .get(
              "0004_simulation_attempts"
            );


        assert.ok(
          migration
        );
      }
    );


    test(
      "usuário sem entitlement não deve iniciar tentativa",
      async () => {
        const response =
          await startRoute.POST(
            request({
              path:
                `/api/simulations/${simulationId}/attempts`,

              method:
                "POST",

              token:
                outsiderToken,
            }),
            startContext()
          );


        assert.equal(
          response.status,
          403
        );
      }
    );


    test(
      "simulado inativo não deve iniciar tentativa",
      async () => {
        const response =
          await startRoute.POST(
            request({
              path:
                `/api/simulations/${inactiveSimulationId}/attempts`,

              method:
                "POST",

              token:
                ownerToken,
            }),
            startContext(
              inactiveSimulationId
            )
          );


        assert.equal(
          response.status,
          404
        );
      }
    );


    test(
      "início deve gerar token forte, tempo server-side e snapshot privado",
      async () => {
        const response =
          await startRoute.POST(
            request({
              path:
                `/api/simulations/${simulationId}/attempts`,

              method:
                "POST",

              token:
                ownerToken,
            }),
            startContext()
          );


        assert.equal(
          response.status,
          201
        );


        const data =
          await response.json();


        assert.equal(
          data.resumed,
          false
        );


        assert.match(
          data.attempt.token,
          /^[a-f0-9]{64}$/
        );


        assert.equal(
          data.attempt.status,
          "in_progress"
        );


        assert.ok(
          data.attempt.startedAt
        );

        assert.ok(
          data.attempt.expiresAt
        );

        assert.ok(
          data.attempt.serverNow
        );

        assert.ok(
          data.attempt.secondsRemaining >
            0
        );


        assert.equal(
          data.attempt.questions.length,
          1
        );


        const publicQuestion =
          data.attempt.questions[0];


        assert.equal(
          Object.hasOwn(
            publicQuestion,
            "correctAnswer"
          ),
          false
        );

        assert.equal(
          Object.hasOwn(
            publicQuestion,
            "explanation"
          ),
          false
        );


        const stored =
          sqlite
            .prepare(`
              SELECT question_snapshot
              FROM simulation_attempts
              WHERE token = ?
            `)
            .get(
              data.attempt.token
            );


        assert.ok(
          stored
        );


        const snapshot =
          JSON.parse(
            stored.question_snapshot
          );


        assert.equal(
          snapshot.version,
          1
        );

        assert.equal(
          snapshot.questions[0].id,
          questionId
        );

        assert.equal(
          snapshot.questions[0].correctAnswer,
          1
        );

        assert.equal(
          snapshot.questions[0].explanation,
          "A alternativa B é a correta."
        );
      }
    );


    test(
      "segunda inicialização deve retomar a mesma tentativa",
      async () => {
        const first =
          await startRoute.POST(
            request({
              path:
                `/api/simulations/${simulationId}/attempts`,

              method:
                "POST",

              token:
                ownerToken,
            }),
            startContext()
          );


        assert.equal(
          first.status,
          200
        );


        const firstData =
          await first.json();


        assert.equal(
          firstData.resumed,
          true
        );


        const second =
          await startRoute.POST(
            request({
              path:
                `/api/simulations/${simulationId}/attempts`,

              method:
                "POST",

              token:
                ownerToken,
            }),
            startContext()
          );


        const secondData =
          await second.json();


        assert.equal(
          second.status,
          200
        );

        assert.equal(
          secondData.resumed,
          true
        );

        assert.equal(
          secondData.attempt.token,
          firstData.attempt.token
        );


        const count =
          sqlite
            .prepare(`
              SELECT COUNT(*) AS total
              FROM simulation_attempts
              WHERE
                user_id = ?
                AND simulation_id = ?
                AND status = 'in_progress'
            `)
            .get(
              owner.id,
              simulationId
            );


        assert.equal(
          count.total,
          1
        );
      }
    );


    test(
      "outro usuário não deve consultar tentativa alheia",
      async () => {
        const ownerAttempt =
          sqlite
            .prepare(`
              SELECT token
              FROM simulation_attempts
              WHERE
                user_id = ?
                AND simulation_id = ?
                AND status = 'in_progress'
              LIMIT 1
            `)
            .get(
              owner.id,
              simulationId
            );


        assert.ok(
          ownerAttempt
        );


        const response =
          await attemptRoute.GET(
            request({
              path:
                `/api/simulations/${simulationId}/attempts/${ownerAttempt.token}`,

              token:
                otherToken,
            }),
            attemptContext(
              ownerAttempt.token
            )
          );


        /**
         * 404 proposital:
         * não revelamos a existência da tentativa
         * de outro usuário.
         */
        assert.equal(
          response.status,
          404
        );
      }
    );


    test(
      "refund deve revogar tentativa aberta imediatamente",
      async () => {
        const attempt =
          sqlite
            .prepare(`
              SELECT token
              FROM simulation_attempts
              WHERE
                user_id = ?
                AND simulation_id = ?
                AND status = 'in_progress'
              LIMIT 1
            `)
            .get(
              owner.id,
              simulationId
            );


        assert.ok(
          attempt
        );


        await setOwnerOrderStatus(
          "refunded"
        );


        const response =
          await attemptRoute.GET(
            request({
              path:
                `/api/simulations/${simulationId}/attempts/${attempt.token}`,

              token:
                ownerToken,
            }),
            attemptContext(
              attempt.token
            )
          );


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


        const newAttempt =
          await startRoute.POST(
            request({
              path:
                `/api/simulations/${simulationId}/attempts`,

              method:
                "POST",

              token:
                ownerToken,
            }),
            startContext()
          );


        assert.equal(
          newAttempt.status,
          403
        );


        await setOwnerOrderStatus(
          "approved"
        );
      }
    );


    test(
      "tentativa expirada deve retornar 410 e permitir uma nova tentativa",
      async () => {
        const start =
          await startRoute.POST(
            request({
              path:
                `/api/simulations/${simulationId}/attempts`,

              method:
                "POST",

              token:
                ownerToken,
            }),
            startContext()
          );


        assert.equal(
          start.status,
          201
        );


        const startData =
          await start.json();


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

            startData.attempt.token
          );


        const expired =
          await attemptRoute.GET(
            request({
              path:
                `/api/simulations/${simulationId}/attempts/${startData.attempt.token}`,

              token:
                ownerToken,
            }),
            attemptContext(
              startData.attempt.token
            )
          );


        assert.equal(
          expired.status,
          410
        );


        const expiredRow =
          sqlite
            .prepare(`
              SELECT status
              FROM simulation_attempts
              WHERE token = ?
            `)
            .get(
              startData.attempt.token
            );


        assert.equal(
          expiredRow.status,
          "expired"
        );


        const replacement =
          await startRoute.POST(
            request({
              path:
                `/api/simulations/${simulationId}/attempts`,

              method:
                "POST",

              token:
                ownerToken,
            }),
            startContext()
          );


        assert.equal(
          replacement.status,
          201
        );


        const replacementData =
          await replacement.json();


        assert.notEqual(
          replacementData.attempt.token,
          startData.attempt.token
        );
      }
    );


    test(
      "SQLite deve impedir duas tentativas abertas do mesmo usuário e simulado",
      () => {
        const active =
          sqlite
            .prepare(`
              SELECT
                started_at,
                expires_at,
                question_snapshot
              FROM simulation_attempts
              WHERE
                user_id = ?
                AND simulation_id = ?
                AND status = 'in_progress'
              LIMIT 1
            `)
            .get(
              owner.id,
              simulationId
            );


        assert.ok(
          active
        );


        assert.throws(
          () => {
            sqlite
              .prepare(`
                INSERT INTO simulation_attempts (
                  token,
                  user_id,
                  simulation_id,
                  status,
                  started_at,
                  expires_at,
                  question_snapshot,
                  updated_at
                )
                VALUES (
                  ?,
                  ?,
                  ?,
                  'in_progress',
                  ?,
                  ?,
                  ?,
                  ?
                )
              `)
              .run(
                randomBytes(
                  32
                ).toString(
                  "hex"
                ),

                owner.id,
                simulationId,
                active.started_at,
                active.expires_at,
                active.question_snapshot,
                new Date()
                  .toISOString()
              );
          },
          /UNIQUE constraint failed/
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
