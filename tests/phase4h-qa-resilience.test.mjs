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
  "Fase 4.4A - Resiliência e acessibilidade dos simulados",
  () => {
    let isolated;

    let db;
    let sqlite;
    let schema;
    let eq;

    let owner;
    let ownerToken;

    let outsiderToken;

    let simulationId;
    let productId;
    let questionId;
    let ownerOrderId;

    let startRoute;
    let activeRoute;


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
            "owner-qa-44a@teste.local",
            "Senha123456",
            "Owner QA"
          );


        await auth.registerUser(
          "outsider-qa-44a@teste.local",
          "Senha123456",
          "Outsider QA"
        );


        const ownerLogin =
          await auth.authenticateUser(
            "owner-qa-44a@teste.local",
            "Senha123456"
          );


        const outsiderLogin =
          await auth.authenticateUser(
            "outsider-qa-44a@teste.local",
            "Senha123456"
          );


        assert.ok(
          ownerLogin
        );

        assert.ok(
          outsiderLogin
        );


        ownerToken =
          ownerLogin.session.token;

        outsiderToken =
          outsiderLogin.session.token;


        const products =
          await db
            .insert(
              schema.products
            )
            .values({
              slug:
                "produto-qa-44a",

              title:
                "Produto QA 4.4A",

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
            .values({
              bank:
                "Cesgranrio",

              subject:
                "Português",

              questionText:
                "Questão de QA.",

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
                "Simulado QA 4.4A",

              bank:
                "Cesgranrio",

              description:
                "Teste de resiliência.",

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
          .values({
            simulationId,

            questionId,

            position:
              1,
          });


        const orders =
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
          orders[0].id;


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


        startRoute =
          await import(
            "../app/api/simulations/[id]/attempts/route.ts"
          );


        activeRoute =
          await import(
            "../app/api/simulations/[id]/attempts/active/route.ts"
          );
      }
    );


    test(
      "servidor deve descobrir tentativa aberta sem token do navegador",
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
            context()
          );


        assert.equal(
          start.status,
          201
        );


        const started =
          await start.json();


        const active =
          await activeRoute.GET(
            request({
              path:
                `/api/simulations/${simulationId}/attempts/active`,

              token:
                ownerToken,
            }),
            context()
          );


        assert.equal(
          active.status,
          200
        );


        const data =
          await active.json();


        assert.equal(
          data.attempt.token,
          started.attempt.token
        );


        assert.equal(
          data.attempt.status,
          "in_progress"
        );


        assert.equal(
          Object.hasOwn(
            data.attempt.questions[0],
            "correctAnswer"
          ),
          false
        );
      }
    );


    test(
      "outro usuário não deve descobrir tentativa do owner",
      async () => {
        const response =
          await activeRoute.GET(
            request({
              path:
                `/api/simulations/${simulationId}/attempts/active`,

              token:
                outsiderToken,
            }),
            context()
          );


        assert.equal(
          response.status,
          404
        );
      }
    );


    test(
      "refund deve revogar tentativa descoberta pelo servidor",
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


        const response =
          await activeRoute.GET(
            request({
              path:
                `/api/simulations/${simulationId}/attempts/active`,

              token:
                ownerToken,
            }),
            context()
          );


        assert.equal(
          response.status,
          403
        );


        const attempt =
          sqlite
            .prepare(`
              SELECT status
              FROM simulation_attempts
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
          attempt.status,
          "revoked"
        );


        await db
          .update(
            schema.orders
          )
          .set({
            status:
              "approved",
          })
          .where(
            eq(
              schema.orders.id,
              ownerOrderId
            )
          );
      }
    );


    test(
      "tentativa vencida deve ser limpa da descoberta ativa",
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
            context()
          );


        assert.equal(
          start.status,
          201
        );


        const data =
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

            data.attempt.token
          );


        const active =
          await activeRoute.GET(
            request({
              path:
                `/api/simulations/${simulationId}/attempts/active`,

              token:
                ownerToken,
            }),
            context()
          );


        assert.equal(
          active.status,
          404
        );


        const row =
          sqlite
            .prepare(`
              SELECT status
              FROM simulation_attempts
              WHERE token = ?
            `)
            .get(
              data.attempt.token
            );


        assert.equal(
          row.status,
          "expired"
        );
      }
    );


    test(
      "quiz deve possuir recuperação server-side e storage tolerante a falhas",
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
          /\/attempts\/active/
        );


        assert.match(
          source,
          /safeSessionGet/
        );


        assert.match(
          source,
          /safeSessionSet/
        );


        assert.match(
          source,
          /safeSessionRemove/
        );


        assert.doesNotMatch(
          source,
          /sessionStorage\.getItem/
        );


        assert.doesNotMatch(
          source,
          /sessionStorage\.setItem/
        );


        assert.doesNotMatch(
          source,
          /sessionStorage\.removeItem/
        );
      }
    );


    test(
      "quiz deve ressincronizar ao retornar para a aba",
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
          /visibilitychange/
        );


        assert.match(
          source,
          /document\.visibilityState/
        );


        assert.match(
          source,
          /window\.addEventListener\(\s*["']focus["']/
        );


        assert.match(
          source,
          /performance\.now\(\)/
        );
      }
    );


    test(
      "quiz deve proteger fechamento acidental",
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
          /beforeunload/
        );


        assert.match(
          source,
          /BeforeUnloadEvent/
        );
      }
    );


    test(
      "quiz deve possuir semântica básica de acessibilidade",
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
          /role="progressbar"/
        );


        assert.match(
          source,
          /aria-valuenow/
        );


        assert.match(
          source,
          /role="timer"/
        );


        assert.match(
          source,
          /aria-current/
        );


        assert.match(
          source,
          /aria-pressed/
        );


        assert.match(
          source,
          /role="alert"/
        );
      }
    );


    test(
      "package deve incluir gate da Fase 4.4A",
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
            "test:phase4h-qa"
          ]
        );


        assert.ok(
          packageJson.scripts[
            "test:phase4-qa"
          ].includes(
            "test:phase4h-qa"
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
        isolated?.cleanup();
      }
    );
  }
);