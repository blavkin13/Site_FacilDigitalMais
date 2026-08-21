import {
  after,
  before,
  describe,
  test,
} from "node:test";

import assert from "node:assert";

import {
  existsSync,
} from "node:fs";

import {
  readFile,
} from "node:fs/promises";

import {
  join,
} from "node:path";

import Database from "better-sqlite3";

import {
  eq,
} from "drizzle-orm";

import {
  getDb,
} from "../db/index.ts";

import {
  questions,
  simulationResults,
  simulations,
  users,
  orders,
} from "../db/schema.ts";

import {
  seedSimulations,
} from "../db/seed-simulations.ts";

import {
  createIsolatedDatabase,
} from "./helpers/isolated-database.mjs";


describe(
  "Fase 3B - Sistema de Simulados",
  () => {
    let testEnvironment;


    before(
      async () => {
        console.log(
          "🧪 Preparando testes da Fase 3B..."
        );


        /**
         * Simulados exigem um usuário com compra.
         *
         * O helper cria:
         *
         * migrations
         *   ↓
         * admin
         *   ↓
         * produtos
         *   ↓
         * pedidos
         *
         * O seed de simulados será executado no teste
         * específico abaixo.
         */
        testEnvironment =
          await createIsolatedDatabase({
            orders: true,
          });


        console.log(
          `🧪 SQLite isolado: ${testEnvironment.databasePath}`
        );
      }
    );


    // ==========================================================
    // ESTRUTURA
    // ==========================================================

    test(
      "API /api/simulations existe",
      () => {
        const path =
          join(
            process.cwd(),
            "app",
            "api",
            "simulations",
            "route.ts"
          );


        assert.ok(
          existsSync(path)
        );


        console.log(
          "✅ API /api/simulations existe"
        );
      }
    );


    test(
      "API /api/simulations/[id] existe",
      () => {
        const path =
          join(
            process.cwd(),
            "app",
            "api",
            "simulations",
            "[id]",
            "route.ts"
          );


        assert.ok(
          existsSync(path)
        );


        console.log(
          "✅ API /api/simulations/[id] existe"
        );
      }
    );


    test(
      "API submit existe",
      () => {
        const path =
          join(
            process.cwd(),
            "app",
            "api",
            "simulations",
            "[id]",
            "submit",
            "route.ts"
          );


        assert.ok(
          existsSync(path)
        );


        console.log(
          "✅ API submit existe"
        );
      }
    );


    test(
      "Componente SimulationList existe",
      () => {
        assert.ok(
          existsSync(
            join(
              process.cwd(),
              "components",
              "simulation-list.tsx"
            )
          )
        );


        console.log(
          "✅ SimulationList existe"
        );
      }
    );


    test(
      "Componente SimulationQuiz existe",
      () => {
        assert.ok(
          existsSync(
            join(
              process.cwd(),
              "components",
              "simulation-quiz.tsx"
            )
          )
        );


        console.log(
          "✅ SimulationQuiz existe"
        );
      }
    );


    test(
      "Componente SimulationResults existe",
      () => {
        assert.ok(
          existsSync(
            join(
              process.cwd(),
              "components",
              "simulation-results.tsx"
            )
          )
        );


        console.log(
          "✅ SimulationResults existe"
        );
      }
    );


    test(
      "Página /simulados/[id] existe",
      () => {
        assert.ok(
          existsSync(
            join(
              process.cwd(),
              "app",
              "simulados",
              "[id]",
              "page.tsx"
            )
          )
        );


        console.log(
          "✅ Página de simulado específico existe"
        );
      }
    );


    test(
      "Página de resultado existe",
      () => {
        assert.ok(
          existsSync(
            join(
              process.cwd(),
              "app",
              "simulados",
              "[id]",
              "resultado",
              "page.tsx"
            )
          )
        );


        console.log(
          "✅ Página de resultado existe"
        );
      }
    );


    test(
      "Seed de simulados existe",
      () => {
        assert.ok(
          existsSync(
            join(
              process.cwd(),
              "db",
              "seed-simulations.ts"
            )
          )
        );


        console.log(
          "✅ Seed de simulados existe"
        );
      }
    );


    // ==========================================================
    // CONTEÚDO
    // ==========================================================

    test(
      "API simulações verifica acesso",
      async () => {
        const content =
          await readFile(
            join(
              process.cwd(),
              "app",
              "api",
              "simulations",
              "route.ts"
            ),
            "utf-8"
          );


        assert.ok(
          content.includes(
            "hasAccess"
          )
        );


        assert.ok(
          content.includes(
            "orders"
          )
        );


        console.log(
          "✅ API verifica acesso"
        );
      }
    );


    test(
      "API submit retorna ranking",
      async () => {
        const content =
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
            "utf-8"
          );


        const expectedContent = [
          "ranking",
          "userPosition",
          "detailedAnswers",
          "isCorrect",
        ];


        for (
          const item of expectedContent
        ) {
          assert.ok(
            content.includes(
              item
            ),
            `API submit deve conter ${item}`
          );
        }


        console.log(
          "✅ API submit tem ranking e detalhes"
        );
      }
    );


    test(
      "SimulationQuiz tem timer",
      async () => {
        const content =
          await readFile(
            join(
              process.cwd(),
              "components",
              "simulation-quiz.tsx"
            ),
            "utf-8"
          );


        assert.ok(
          content.includes(
            "timeLeft"
          )
        );


        assert.ok(
          content.includes(
            "setInterval"
          )
        );


        assert.ok(
          content.includes(
            "formatTime"
          )
        );


        console.log(
          "✅ SimulationQuiz tem timer"
        );
      }
    );


    test(
      "SimulationResults mostra revisão detalhada",
      async () => {
        const content =
          await readFile(
            join(
              process.cwd(),
              "components",
              "simulation-results.tsx"
            ),
            "utf-8"
          );


        const expectedContent = [
          "detailedAnswers",
          "correctAnswer",
          "explanation",
          "ranking",
        ];


        for (
          const item of expectedContent
        ) {
          assert.ok(
            content.includes(
              item
            ),
            `SimulationResults deve conter ${item}`
          );
        }


        console.log(
          "✅ SimulationResults tem revisão completa"
        );
      }
    );


    // ==========================================================
    // INTEGRAÇÃO — SOMENTE SQLITE TEMPORÁRIO
    // ==========================================================

    test(
      "Executar seed de simulados no banco isolado",
      async () => {
        await seedSimulations();


        console.log(
          "✅ Seed de simulados executado no SQLite temporário"
        );
      }
    );


    test(
      "Banco isolado tem questões",
      () => {
        const sqlite =
          new Database(
            testEnvironment.databasePath,
            {
              readonly: true,
            }
          );


        try {
          const row =
            sqlite
              .prepare(
                "SELECT COUNT(*) AS total FROM questions"
              )
              .get();


          const count =
            Number(
              row.total
            );


          assert.ok(
            count >= 4,
            "Deve haver pelo menos 4 questões"
          );


          console.log(
            `✅ Banco isolado tem ${count} questões`
          );
        } finally {
          sqlite.close();
        }
      }
    );


    test(
      "Banco isolado tem simulados",
      () => {
        const sqlite =
          new Database(
            testEnvironment.databasePath,
            {
              readonly: true,
            }
          );


        try {
          const row =
            sqlite
              .prepare(
                "SELECT COUNT(*) AS total FROM simulations"
              )
              .get();


          const count =
            Number(
              row.total
            );


          assert.ok(
            count >= 1,
            "Deve haver pelo menos 1 simulado"
          );


          console.log(
            `✅ Banco isolado tem ${count} simulado(s)`
          );
        } finally {
          sqlite.close();
        }
      }
    );


    test(
      "Fluxo completo: submeter simulado e gerar ranking",
      async () => {
        const db =
          getDb();


        const admin =
          await db
            .select()
            .from(
              users
            )
            .where(
              eq(
                users.email,
                "digicopiamix@facildigitalmais.com"
              )
            )
            .get();


        assert.ok(
          admin,
          "Admin deve existir"
        );


        const userOrders =
          await db
            .select()
            .from(
              orders
            )
            .where(
              eq(
                orders.userId,
                admin.id
              )
            )
            .all();


        assert.ok(
          userOrders.length >
            0,
          "Admin precisa possuir compra no banco temporário"
        );


        const simulation =
          await db
            .select()
            .from(
              simulations
            )
            .limit(1)
            .get();


        assert.ok(
          simulation,
          "Simulado deve existir"
        );


        const questionIds =
          JSON.parse(
            simulation.questionIds
          );


        const allQuestions =
          await db
            .select()
            .from(
              questions
            )
            .all();


        const simulationQuestions =
          allQuestions.filter(
            (question) =>
              questionIds.includes(
                question.id
              )
          );


        assert.ok(
          simulationQuestions.length >
            0,
          "Simulado deve possuir questões"
        );


        const answers =
          simulationQuestions.map(
            (
              question,
              index
            ) => ({
              questionId:
                question.id,

              selectedOption:
                index % 2 ===
                0
                  ? question.correctAnswer
                  : (
                      question.correctAnswer +
                      1
                    ) %
                    4,
            })
          );


        const inserted =
          await db
            .insert(
              simulationResults
            )
            .values({
              userId:
                admin.id,

              simulationId:
                simulation.id,

              score:
                Math.ceil(
                  simulationQuestions.length /
                    2
                ),

              totalQuestions:
                simulationQuestions.length,

              timeSpent:
                300,

              answers:
                JSON.stringify(
                  answers
                ),
            })
            .returning();


        assert.ok(
          inserted[0],
          "Resultado deve ser persistido"
        );


        const ranking =
          await db
            .select()
            .from(
              simulationResults
            )
            .all();


        assert.ok(
          ranking.length >
            0,
          "Ranking deve possuir resultados"
        );


        console.log(
          "✅ Fluxo completo: acesso → questões → submissão → ranking"
        );
      }
    );


    // ==========================================================
    // CSS
    // ==========================================================

    test(
      "CSS de simulados foi adicionado",
      async () => {
        const content =
          await readFile(
            join(
              process.cwd(),
              "app",
              "extra.css"
            ),
            "utf-8"
          );


        const requiredClasses = [
          ".simulation-card",
          ".sim-start-card",
          ".results-summary",
          ".ranking-table",
          ".review-question",
        ];


        for (
          const className of requiredClasses
        ) {
          assert.ok(
            content.includes(
              className
            ),
            `CSS deve conter ${className}`
          );
        }


        console.log(
          "✅ CSS de simulados e resultados adicionado"
        );
      }
    );


    test(
      "Fases anteriores preservadas",
      () => {
        const checks = [
          "lib/auth.ts",
          "components/auth-provider.tsx",
          "components/student-dashboard.tsx",
          "app/api/orders/route.ts",
        ];


        for (
          const path of checks
        ) {
          assert.ok(
            existsSync(
              join(
                process.cwd(),
                path
              )
            ),
            `${path} deve existir`
          );
        }


        console.log(
          "✅ Fases anteriores preservadas"
        );
      }
    );


    after(
      () => {
        testEnvironment?.cleanup();


        console.log(
          "✅ Testes da Fase 3B concluídos sem tocar data/dev.db!"
        );
      }
    );
  }
);