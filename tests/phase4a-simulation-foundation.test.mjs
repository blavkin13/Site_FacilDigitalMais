import {
  after,
  before,
  describe,
  test,
} from "node:test";

import assert from "node:assert/strict";

import {
  createIsolatedDatabase,
} from "./helpers/isolated-database.mjs";


describe(
  "Fase 4A - Fundação segura de Simulados",
  () => {
    let isolated;
    let db;
    let sqlite;

    let userId;

    let relatedProductId;
    let unrelatedProductId;

    let simulationId;
    let inactiveSimulationId;
    let simulationWithoutProductId;

    let activeQuestionId;
    let inactiveQuestionId;

    let relatedOrderId;


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


        db =
          database.getDb();

        sqlite =
          database
            .getSqliteConnection();


        const user =
          await db
            .insert(
              schema.users
            )
            .values({
              email:
                "aluno-phase4a@teste.local",

              passwordHash:
                "hash-teste",

              name:
                "Aluno Phase 4A",

              role:
                "user",
            })
            .returning();


        userId =
          user[0].id;


        const productRows =
          await db
            .insert(
              schema.products
            )
            .values([
              {
                slug:
                  "produto-relacionado-phase4a",

                title:
                  "Produto Relacionado 4A",

                price:
                  79.9,

                active:
                  true,
              },

              {
                slug:
                  "produto-nao-relacionado-phase4a",

                title:
                  "Produto Não Relacionado 4A",

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
                  "Questão ativa de teste.",

                options:
                  JSON.stringify([
                    "A",
                    "B",
                  ]),

                correctAnswer:
                  0,

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
                  "Português",

                questionText:
                  "Questão arquivada de teste.",

                options:
                  JSON.stringify([
                    "A",
                    "B",
                  ]),

                correctAnswer:
                  1,

                difficulty:
                  "medium",

                active:
                  false,

                updatedAt:
                  new Date()
                    .toISOString(),
              },
            ])
            .returning();


        activeQuestionId =
          questionRows[0].id;

        inactiveQuestionId =
          questionRows[1].id;


        const simulationRows =
          await db
            .insert(
              schema.simulations
            )
            .values([
              {
                title:
                  "Simulado Relacionado 4A",

                bank:
                  "Cesgranrio",

                description:
                  "Simulado usado pelo teste de entitlement.",

                timeLimit:
                  60,

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
                  "Simulado Inativo 4A",

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

              {
                title:
                  "Simulado Sem Produto 4A",

                bank:
                  "Cesgranrio",

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
            ])
            .returning();


        simulationId =
          simulationRows[0].id;

        inactiveSimulationId =
          simulationRows[1].id;

        simulationWithoutProductId =
          simulationRows[2].id;


        await db
          .insert(
            schema.simulationProducts
          )
          .values([
            {
              simulationId,

              productId:
                relatedProductId,
            },

            {
              simulationId:
                inactiveSimulationId,

              productId:
                relatedProductId,
            },
          ]);


        await db
          .insert(
            schema.simulationQuestions
          )
          .values([
            {
              simulationId,

              questionId:
                activeQuestionId,

              position:
                1,
            },

            {
              simulationId,

              questionId:
                inactiveQuestionId,

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


        /**
         * O usuário possui também uma compra APROVADA,
         * porém de OUTRO produto.
         *
         * Isso é importante para provar que:
         *
         * "possui uma compra"
         *
         * não equivale mais a:
         *
         * "possui acesso ao simulado".
         */
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
      }
    );


    after(
      () => {
        isolated.cleanup();
      }
    );


    test(
      "migration 0003 deve estar registrada",
      () => {
        const row =
          sqlite
            .prepare(`
              SELECT
                id
              FROM schema_migrations
              WHERE id = ?
            `)
            .get(
              "0003_simulation_management"
            );


        assert.ok(
          row,
          "Migration 0003 deveria estar aplicada no banco isolado."
        );
      }
    );


    test(
      "schema deve possuir tabelas normalizadas de simulados",
      () => {
        const tables =
          sqlite
            .prepare(`
              SELECT name
              FROM sqlite_master
              WHERE
                type = 'table'
                AND name IN (
                  'simulation_products',
                  'simulation_questions'
                )
              ORDER BY name
            `)
            .all()
            .map(
              (
                row
              ) =>
                row.name
            );


        assert.deepEqual(
          tables,
          [
            "simulation_products",
            "simulation_questions",
          ]
        );
      }
    );


    test(
      "migration deve preservar question_ids legado e adicionar novos campos",
      () => {
        const simulationColumns =
          new Set(
            sqlite
              .prepare(`
                PRAGMA table_info(simulations)
              `)
              .all()
              .map(
                (
                  column
                ) =>
                  column.name
              )
          );


        assert.ok(
          simulationColumns.has(
            "question_ids"
          ),
          "question_ids deve permanecer temporariamente por compatibilidade."
        );


        assert.ok(
          simulationColumns.has(
            "updated_at"
          )
        );


        assert.ok(
          simulationColumns.has(
            "published_at"
          )
        );


        const questionColumns =
          new Set(
            sqlite
              .prepare(`
                PRAGMA table_info(questions)
              `)
              .all()
              .map(
                (
                  column
                ) =>
                  column.name
              )
          );


        assert.ok(
          questionColumns.has(
            "active"
          )
        );


        assert.ok(
          questionColumns.has(
            "updated_at"
          )
        );


        const resultColumns =
          new Set(
            sqlite
              .prepare(`
                PRAGMA table_info(simulation_results)
              `)
              .all()
              .map(
                (
                  column
                ) =>
                  column.name
              )
          );


        assert.ok(
          resultColumns.has(
            "snapshot"
          )
        );
      }
    );


    test(
      "relações não devem aceitar produto ou questão duplicados",
      () => {
        assert.throws(
          () => {
            sqlite
              .prepare(`
                INSERT INTO simulation_products (
                  simulation_id,
                  product_id
                )
                VALUES (?, ?)
              `)
              .run(
                simulationId,
                relatedProductId
              );
          },
          /UNIQUE constraint failed/
        );


        assert.throws(
          () => {
            sqlite
              .prepare(`
                INSERT INTO simulation_questions (
                  simulation_id,
                  question_id,
                  position
                )
                VALUES (?, ?, ?)
              `)
              .run(
                simulationId,
                activeQuestionId,
                3
              );
          },
          /UNIQUE constraint failed/
        );


        assert.throws(
          () => {
            sqlite
              .prepare(`
                INSERT INTO simulation_questions (
                  simulation_id,
                  question_id,
                  position
                )
                VALUES (?, ?, ?)
              `)
              .run(
                simulationId,
                inactiveQuestionId,
                1
              );
          },
          /UNIQUE constraint failed/
        );
      }
    );


    test(
      "compra aprovada de outro produto não deve liberar o simulado",
      async () => {
        const {
          resolveSimulationAccess,
        } =
          await import(
            "../lib/simulation-access.ts"
          );


        const decision =
          await resolveSimulationAccess(
            userId,
            simulationId
          );


        assert.equal(
          decision.allowed,
          false
        );


        assert.equal(
          decision.reason,
          "no_approved_purchase"
        );
      }
    );


    test(
      "pending, rejected e refunded não devem liberar o produto relacionado",
      async () => {
        const schema =
          await import(
            "../db/schema.ts"
          );


        const {
          eq,
        } =
          await import(
            "drizzle-orm"
          );


        const {
          resolveSimulationAccess,
        } =
          await import(
            "../lib/simulation-access.ts"
          );


        for (
          const status of [
            "pending",
            "rejected",
            "refunded",
          ]
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


          const decision =
            await resolveSimulationAccess(
              userId,
              simulationId
            );


          assert.equal(
            decision.allowed,
            false,
            `Pedido ${status} não deve liberar o simulado.`
          );


          assert.equal(
            decision.reason,
            "no_approved_purchase"
          );
        }
      }
    );


    test(
      "pedido approved do produto relacionado deve liberar o simulado",
      async () => {
        const schema =
          await import(
            "../db/schema.ts"
          );


        const {
          eq,
        } =
          await import(
            "drizzle-orm"
          );


        const {
          resolveSimulationAccess,
          getAccessibleSimulationIdsForUser,
        } =
          await import(
            "../lib/simulation-access.ts"
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
              relatedOrderId
            )
          );


        const decision =
          await resolveSimulationAccess(
            userId,
            simulationId
          );


        assert.equal(
          decision.allowed,
          true
        );


        assert.ok(
          decision
            .relatedProductIds
            .includes(
              relatedProductId
            )
        );


        const accessibleIds =
          await getAccessibleSimulationIdsForUser(
            userId
          );


        assert.ok(
          accessibleIds.includes(
            simulationId
          )
        );


        assert.equal(
          accessibleIds.includes(
            inactiveSimulationId
          ),
          false
        );
      }
    );


    test(
      "simulado sem produto e simulado inativo devem permanecer bloqueados",
      async () => {
        const {
          resolveSimulationAccess,
        } =
          await import(
            "../lib/simulation-access.ts"
          );


        const noProduct =
          await resolveSimulationAccess(
            userId,
            simulationWithoutProductId
          );


        assert.equal(
          noProduct.allowed,
          false
        );


        assert.equal(
          noProduct.reason,
          "no_related_product"
        );


        const inactive =
          await resolveSimulationAccess(
            userId,
            inactiveSimulationId
          );


        assert.equal(
          inactive.allowed,
          false
        );


        assert.equal(
          inactive.reason,
          "simulation_inactive"
        );
      }
    );


    test(
      "publicação deve exigir produto, questões existentes e questões ativas",
      async () => {
        const {
          getSimulationPublicationIssues,
          isSimulationReadyForPublication,
        } =
          await import(
            "../lib/simulation-publication.ts"
          );


        const baseSimulation = {
          title:
            "Simulado Publicável",

          bank:
            "Cesgranrio",

          timeLimit:
            60,
        };


        const withoutRelations =
          getSimulationPublicationIssues({
            simulation:
              baseSimulation,

            productIds:
              [],

            questionIds:
              [],

            questions:
              [],
          });


        assert.ok(
          withoutRelations.some(
            (
              issue
            ) =>
              issue.field ===
              "products"
          )
        );


        assert.ok(
          withoutRelations.some(
            (
              issue
            ) =>
              issue.field ===
              "questions"
          )
        );


        const missingQuestion =
          getSimulationPublicationIssues({
            simulation:
              baseSimulation,

            productIds: [
              relatedProductId,
            ],

            questionIds: [
              999999,
            ],

            questions:
              [],
          });


        assert.ok(
          missingQuestion.some(
            (
              issue
            ) =>
              issue.field ===
                "questions" &&
              issue.message.includes(
                "não existe"
              )
          )
        );


        const inactiveQuestion =
          getSimulationPublicationIssues({
            simulation:
              baseSimulation,

            productIds: [
              relatedProductId,
            ],

            questionIds: [
              inactiveQuestionId,
            ],

            questions: [
              {
                id:
                  inactiveQuestionId,

                active:
                  false,
              },
            ],
          });


        assert.ok(
          inactiveQuestion.some(
            (
              issue
            ) =>
              issue.field ===
                "questions" &&
              issue.message.includes(
                "arquivada"
              )
          )
        );


        assert.equal(
          isSimulationReadyForPublication({
            simulation:
              baseSimulation,

            productIds: [
              relatedProductId,
            ],

            questionIds: [
              activeQuestionId,
            ],

            questions: [
              {
                id:
                  activeQuestionId,

                active:
                  true,
              },
            ],
          }),
          true
        );
      }
    );
  }
);