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
  simulationQuestions,
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


        /**
         * A rota pública continua retornando o estado
         * hasAccess utilizado pela interface.
         */
        assert.ok(
          content.includes(
            "hasAccess"
          ),
          "API deve continuar retornando hasAccess"
        );


        /**
         * Desde a Fase 4, a autorização comercial não
         * deve mais ser implementada diretamente nesta
         * rota através da tabela orders.
         *
         * A regra central vive em simulation-access.ts,
         * evitando implementações diferentes entre:
         *
         * - listagem;
         * - detalhe;
         * - submit.
         */
        assert.ok(
          content.includes(
            "getAccessibleSimulationIdsForUser"
          ),
          "API deve utilizar a regra central de entitlement dos simulados"
        );


        assert.ok(
          content.includes(
            "lib/simulation-access"
          ),
          "API deve importar a camada central de acesso aos simulados"
        );


        console.log(
          "✅ API verifica acesso através do entitlement central"
        );
      }
    );


    test(
      "API submit retorna ranking",
      async () => {
        const routeSource =
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


        const submitServiceSource =
          await readFile(
            join(
              process.cwd(),
              "lib",
              "simulation-attempt-submit.ts"
            ),
            "utf8"
          );


        /**
         * A partir da Fase 4.3B, a rota ficou fina:
         *
         * - autentica;
         * - chama o serviço transacional;
         * - calcula ranking após o commit;
         * - devolve o resultado.
         *
         * A correção das questões não deve mais
         * viver diretamente dentro da route.
         */
        assert.ok(
          routeSource.includes(
            "finalizeSimulationAttempt"
          ),
          "API submit deve usar o finalizador server-side da tentativa"
        );


        assert.ok(
          routeSource.includes(
            "getSimulationRanking"
          ),
          "API submit deve calcular ranking"
        );


        assert.ok(
          routeSource.includes(
            "ranking:"
          ),
          "API submit deve retornar ranking"
        );


        assert.ok(
          routeSource.includes(
            "userPosition"
          ),
          "API submit deve retornar posição do usuário"
        );


        assert.ok(
          routeSource.includes(
            "totalParticipants"
          ),
          "API submit deve retornar total de participantes"
        );


        assert.ok(
          routeSource.includes(
            "detailedAnswers"
          ),
          "API submit deve retornar revisão detalhada após a conclusão"
        );


        /**
         * isCorrect agora pertence ao domínio da
         * correção transacional, não à camada HTTP.
         */
        assert.ok(
          submitServiceSource.includes(
            "isCorrect"
          ),
          "Serviço de finalização deve calcular isCorrect"
        );


        assert.ok(
          submitServiceSource.includes(
            "correctAnswer"
          ),
          "Serviço de finalização deve usar o gabarito oficial do snapshot"
        );


        assert.ok(
          submitServiceSource.includes(
            "detailedAnswers"
          ),
          "Serviço de finalização deve produzir revisão detalhada"
        );


        /**
         * Proteção contra regressão:
         * score e tempo não podem voltar a ser
         * confiados ao navegador.
         */
        assert.ok(
          submitServiceSource.includes(
            '"attemptToken"'
          ),
          "Submit deve exigir attemptToken"
        );


        assert.ok(
          submitServiceSource.includes(
            '"answers"'
          ),
          "Submit deve aceitar respostas do aluno"
        );


        assert.ok(
          submitServiceSource.includes(
            "calculateServerTimeSpent"
          ),
          "Tempo deve ser calculado server-side"
        );


        console.log(
          "✅ API submit usa correção transacional e retorna ranking"
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
            .limit(
              1
            )
            .get();


        assert.ok(
          simulation,
          "Simulado deve existir"
        );


        /**
         * A partir da Fase 4, simulations.questionIds
         * é apenas uma coluna legada.
         *
         * A fonte oficial da composição do simulado é
         * simulation_questions.
         */
        const relationRows =
          await db
            .select({
              questionId:
                simulationQuestions.questionId,

              position:
                simulationQuestions.position,
            })
            .from(
              simulationQuestions
            )
            .where(
              eq(
                simulationQuestions.simulationId,
                simulation.id
              )
            )
            .all();


        relationRows.sort(
          (
            a,
            b
          ) =>
            a.position -
            b.position
        );


        assert.ok(
          relationRows.length >
            0,
          "Simulado deve possuir questões em simulation_questions"
        );


        /**
         * Confirma também que o campo legado não voltou
         * acidentalmente a ser a fonte de verdade.
         */
        assert.equal(
          simulation.questionIds,
          "[]",
          "Simulado criado pelo seed deve manter questionIds apenas como legado"
        );


        const allQuestions =
          await db
            .select()
            .from(
              questions
            )
            .all();


        const questionsById =
          new Map(
            allQuestions.map(
              (
                question
              ) => [
                question.id,
                question,
              ]
            )
          );


        const simulationQuestionRows =
          relationRows.map(
            (
              relation
            ) =>
              questionsById.get(
                relation.questionId
              )
          );


        assert.ok(
          simulationQuestionRows.every(
            Boolean
          ),
          "Todas as relações do simulado devem apontar para questões existentes"
        );


        const normalizedQuestions =
          simulationQuestionRows.filter(
            (
              question
            ) =>
              question !==
              undefined
          );


        assert.equal(
          normalizedQuestions.length,
          relationRows.length,
          "Simulado deve possuir todas as questões normalizadas"
        );


        const answers =
          normalizedQuestions.map(
            (
              question,
              index
            ) => {
              const options =
                JSON.parse(
                  question.options
                );


              assert.ok(
                Array.isArray(
                  options
                ),
                "Alternativas da questão devem ser JSON válido"
              );


              assert.ok(
                options.length >=
                  2,
                "Questão deve possuir pelo menos duas alternativas"
              );


              /**
               * Metade das respostas é correta e metade
               * propositalmente incorreta.
               *
               * Usamos o tamanho real do array em vez do
               * antigo módulo 4, porque agora questões
               * podem possuir entre 2 e 5 alternativas.
               */
              const selectedOption =
                index % 2 ===
                0
                  ? question.correctAnswer
                  : (
                      question.correctAnswer +
                      1
                    ) %
                    options.length;


              return {
                questionId:
                  question.id,

                selectedOption,
              };
            }
          );


        const expectedScore =
          normalizedQuestions.filter(
            (
              _question,
              index
            ) =>
              index % 2 ===
              0
          ).length;


        const snapshot =
          {
            version:
              1,

            simulation: {
              id:
                simulation.id,

              title:
                simulation.title,

              bank:
                simulation.bank,

              timeLimit:
                simulation.timeLimit,
            },

            questions:
              normalizedQuestions.map(
                (
                  question,
                  index
                ) => ({
                  questionId:
                    question.id,

                  questionText:
                    question.questionText,

                  options:
                    JSON.parse(
                      question.options
                    ),

                  selectedOption:
                    answers[index]
                      .selectedOption,

                  correctAnswer:
                    question.correctAnswer,

                  explanation:
                    question.explanation,

                  subject:
                    question.subject,
                })
              ),
          };


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
                expectedScore,

              totalQuestions:
                normalizedQuestions.length,

              timeSpent:
                300,

              answers:
                JSON.stringify(
                  answers
                ),

              /**
               * Fase 4 preserva o estado histórico da
               * tentativa através de snapshot.
               */
              snapshot:
                JSON.stringify(
                  snapshot
                ),
            })
            .returning();


        assert.ok(
          inserted[0],
          "Resultado deve ser persistido"
        );


        assert.ok(
          inserted[0].snapshot,
          "Resultado deve possuir snapshot histórico"
        );


        const persistedSnapshot =
          JSON.parse(
            inserted[0].snapshot
          );


        assert.equal(
          persistedSnapshot.version,
          1
        );


        assert.equal(
          persistedSnapshot.questions.length,
          normalizedQuestions.length
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
          "✅ Fluxo completo: simulation_questions → submissão → snapshot → ranking"
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