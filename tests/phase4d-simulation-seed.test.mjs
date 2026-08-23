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
  "Fase 4D - Compatibilidade do seed de Simulados",
  () => {
    let isolated;
    let db;
    let schema;


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

        db =
          database.getDb();


        const {
          seedSimulations,
        } =
          await import(
            "../db/seed-simulations.ts"
          );


        await seedSimulations();
      }
    );


    test(
      "seed deve criar questões ativas",
      async () => {
        const rows =
          await db
            .select()
            .from(
              schema.questions
            )
            .all();


        assert.ok(
          rows.length >
          0
        );


        assert.equal(
          rows.every(
            (
              question
            ) =>
              question.active ===
              true
          ),
          true
        );


        assert.equal(
          rows.every(
            (
              question
            ) =>
              typeof question.updatedAt ===
                "string" &&
              question.updatedAt.length >
                0
          ),
          true
        );
      }
    );


    test(
      "seed deve criar simulados somente como rascunho",
      async () => {
        const rows =
          await db
            .select()
            .from(
              schema.simulations
            )
            .all();


        assert.ok(
          rows.length >
          0
        );


        for (
          const simulation of
            rows
        ) {
          assert.equal(
            simulation.active,
            false
          );


          assert.equal(
            simulation.publishedAt,
            null
          );


          assert.equal(
            simulation.questionIds,
            "[]"
          );


          assert.ok(
            simulation.updatedAt
          );
        }
      }
    );


    test(
      "seed deve usar simulation_questions como fonte de composição",
      async () => {
        const simulations =
          await db
            .select()
            .from(
              schema.simulations
            )
            .all();


        const relations =
          await db
            .select()
            .from(
              schema.simulationQuestions
            )
            .all();


        assert.ok(
          relations.length >
          0
        );


        for (
          const simulation of
            simulations
        ) {
          const simulationRelations =
            relations
              .filter(
                (
                  relation
                ) =>
                  relation.simulationId ===
                  simulation.id
              )
              .sort(
                (
                  a,
                  b
                ) =>
                  a.position -
                  b.position
              );


          assert.ok(
            simulationRelations.length >
            0,
            `Simulado ${simulation.id} deve possuir questões normalizadas.`
          );


          assert.deepEqual(
            simulationRelations.map(
              (
                relation
              ) =>
                relation.position
            ),
            Array.from(
              {
                length:
                  simulationRelations.length,
              },
              (
                _,
                index
              ) =>
                index +
                1
            )
          );
        }
      }
    );


    test(
      "seed não deve conceder produtos automaticamente",
      async () => {
        const relations =
          await db
            .select()
            .from(
              schema.simulationProducts
            )
            .all();


        assert.deepEqual(
          relations,
          []
        );
      }
    );


    test(
      "segunda execução deve permanecer idempotente",
      async () => {
        const simulationsBefore =
          await db
            .select()
            .from(
              schema.simulations
            )
            .all();


        const questionsBefore =
          await db
            .select()
            .from(
              schema.questions
            )
            .all();


        const relationsBefore =
          await db
            .select()
            .from(
              schema.simulationQuestions
            )
            .all();


        const {
          seedSimulations,
        } =
          await import(
            "../db/seed-simulations.ts"
          );


        await seedSimulations();


        const simulationsAfter =
          await db
            .select()
            .from(
              schema.simulations
            )
            .all();


        const questionsAfter =
          await db
            .select()
            .from(
              schema.questions
            )
            .all();


        const relationsAfter =
          await db
            .select()
            .from(
              schema.simulationQuestions
            )
            .all();


        assert.equal(
          simulationsAfter.length,
          simulationsBefore.length
        );


        assert.equal(
          questionsAfter.length,
          questionsBefore.length
        );


        assert.equal(
          relationsAfter.length,
          relationsBefore.length
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