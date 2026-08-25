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
  createIsolatedDatabase,
} from "./helpers/isolated-database.mjs";


describe(
  "Fase 4.4B.3A - Performance SQLite e manutenção operacional",
  () => {
    let isolated;

    let sqlite;

    let userId;
    let simulationId;

    let expiredAttemptToken;
    let expiredSessionToken;


    before(
      async () => {
        isolated =
          await createIsolatedDatabase();


        const database =
          await import(
            "../db/index.ts"
          );


        sqlite =
          database
            .getSqliteConnection();


        const userInsert =
          sqlite
            .prepare(`
              INSERT INTO users (
                email,
                password_hash,
                name,
                role
              )
              VALUES (
                ?,
                ?,
                ?,
                'user'
              )
            `)
            .run(
              "runtime-maintenance@teste.local",
              "test-only-hash",
              "Runtime Maintenance"
            );


        userId =
          Number(
            userInsert
              .lastInsertRowid
          );


        const simulationInsert =
          sqlite
            .prepare(`
              INSERT INTO simulations (
                title,
                bank,
                description,
                time_limit,
                question_ids,
                active,
                published_at,
                updated_at
              )
              VALUES (
                ?,
                ?,
                ?,
                ?,
                '[]',
                1,
                ?,
                ?
              )
            `)
            .run(
              "Simulado manutenção",
              "Cesgranrio",
              "Teste operacional.",
              30,
              new Date()
                .toISOString(),
              new Date()
                .toISOString()
            );


        simulationId =
          Number(
            simulationInsert
              .lastInsertRowid
          );


        expiredAttemptToken =
          "a".repeat(
            64
          );


        expiredSessionToken =
          `sha256:${"b".repeat(
            64
          )}`;


        const now =
          Date.now();


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
            expiredAttemptToken,
            userId,
            simulationId,
            new Date(
              now -
                120_000
            ).toISOString(),
            new Date(
              now -
                60_000
            ).toISOString(),
            JSON.stringify({
              version:
                1,

              questions:
                [],
            }),
            new Date(
              now -
                120_000
            ).toISOString()
          );


        sqlite
          .prepare(`
            INSERT INTO sessions (
              user_id,
              token,
              expires_at
            )
            VALUES (
              ?,
              ?,
              ?
            )
          `)
          .run(
            userId,
            expiredSessionToken,
            new Date(
              now -
                60_000
            ).toISOString()
          );
      }
    );


    test(
      "migration 0005 deve estar aplicada",
      () => {
        const migration =
          sqlite
            .prepare(`
              SELECT id
              FROM schema_migrations
              WHERE id = ?
            `)
            .get(
              "0005_runtime_performance_indexes"
            );


        assert.ok(
          migration
        );
      }
    );


    test(
      "índices operacionais devem existir",
      () => {
        const expected = [
          "idx_sessions_expires_at",
          "idx_sessions_user_id",
          "idx_simulation_results_simulation_id",
          "idx_simulation_results_user_completed_at",
          "idx_order_items_order_product",
          "idx_protected_downloads_expires_at",
        ];


        const indexes =
          new Set(
            sqlite
              .prepare(`
                SELECT name
                FROM sqlite_master
                WHERE type = 'index'
              `)
              .all()
              .map(
                (
                  row
                ) =>
                  row.name
              )
          );


        for (
          const indexName of
            expected
        ) {
          assert.equal(
            indexes.has(
              indexName
            ),
            true,
            `Índice ausente: ${indexName}`
          );
        }
      }
    );


    test(
      "índice de ranking deve iniciar por simulation_id",
      () => {
        const columns =
          sqlite
            .prepare(`
              PRAGMA index_info(
                'idx_simulation_results_simulation_id'
              )
            `)
            .all();


        assert.equal(
          columns[0]
            .name,
          "simulation_id"
        );
      }
    );


    test(
      "índice do histórico deve seguir user_id e completed_at",
      () => {
        const columns =
          sqlite
            .prepare(`
              PRAGMA index_info(
                'idx_simulation_results_user_completed_at'
              )
            `)
            .all();


        assert.deepEqual(
          columns.map(
            (
              column
            ) =>
              column.name
          ),
          [
            "user_id",
            "completed_at",
          ]
        );
      }
    );


    test(
      "dry-run deve detectar sem alterar banco",
      async () => {
        const {
          runRuntimeMaintenance,
        } =
          await import(
            "../lib/runtime-maintenance.ts"
          );


        const report =
          await runRuntimeMaintenance({
            apply:
              false,

            now:
              new Date(),
          });


        assert.ok(
          report.staleAttempts >=
            1
        );


        assert.ok(
          report.staleSessions >=
            1
        );


        assert.equal(
          report.expiredAttempts,
          0
        );


        assert.equal(
          report.removedSessions,
          0
        );


        assert.equal(
          report.optimizeExecuted,
          false
        );


        const attempt =
          sqlite
            .prepare(`
              SELECT status
              FROM simulation_attempts
              WHERE token = ?
            `)
            .get(
              expiredAttemptToken
            );


        assert.equal(
          attempt.status,
          "in_progress"
        );


        const session =
          sqlite
            .prepare(`
              SELECT id
              FROM sessions
              WHERE token = ?
            `)
            .get(
              expiredSessionToken
            );


        assert.ok(
          session
        );
      }
    );


    test(
      "apply deve expirar tentativa e remover sessão",
      async () => {
        const {
          runRuntimeMaintenance,
        } =
          await import(
            "../lib/runtime-maintenance.ts"
          );


        const report =
          await runRuntimeMaintenance({
            apply:
              true,

            now:
              new Date(),
          });


        assert.ok(
          report.expiredAttempts >=
            1
        );


        assert.ok(
          report.removedSessions >=
            1
        );


        assert.equal(
          report.optimizeExecuted,
          true
        );


        const attempt =
          sqlite
            .prepare(`
              SELECT status
              FROM simulation_attempts
              WHERE token = ?
            `)
            .get(
              expiredAttemptToken
            );


        /**
         * Registro permanece para auditoria.
         */
        assert.ok(
          attempt
        );


        assert.equal(
          attempt.status,
          "expired"
        );


        const session =
          sqlite
            .prepare(`
              SELECT id
              FROM sessions
              WHERE token = ?
            `)
            .get(
              expiredSessionToken
            );


        assert.equal(
          session,
          undefined
        );
      }
    );


    test(
      "manutenção deve ser idempotente",
      async () => {
        const {
          runRuntimeMaintenance,
        } =
          await import(
            "../lib/runtime-maintenance.ts"
          );


        const second =
          await runRuntimeMaintenance({
            apply:
              true,

            now:
              new Date(),
          });


        assert.equal(
          second.expiredAttempts,
          0
        );


        assert.equal(
          second.removedSessions,
          0
        );
      }
    );


    test(
      "PROTECTED_PDF_DIR configurado deve exigir caminho absoluto",
      async () => {
        const previous =
          process.env
            .PROTECTED_PDF_DIR;


        try {
          process.env
            .PROTECTED_PDF_DIR =
            "data/protected";


          const {
            getProtectedPdfDirectory,
          } =
            await import(
              "../lib/pdf-protection.ts"
            );


          assert.throws(
            () =>
              getProtectedPdfDirectory(),
            /caminho absoluto/i
          );


          process.env
            .PROTECTED_PDF_DIR =
            "/tmp/facildigital-protected";


          assert.equal(
            getProtectedPdfDirectory(),
            "/tmp/facildigital-protected"
          );
        } finally {
          if (
            previous ===
            undefined
          ) {
            delete process
              .env
              .PROTECTED_PDF_DIR;
          } else {
            process.env
              .PROTECTED_PDF_DIR =
              previous;
          }
        }
      }
    );


    test(
      "pdf-protection não deve resolver configuração relativa contra process.cwd",
      async () => {
        const source =
          await readFile(
            join(
              process.cwd(),
              "lib",
              "pdf-protection.ts"
            ),
            "utf8"
          );


        /**
         * Primeiro validamos especificamente o import
         * de node:path.
         *
         * Isso evita falso positivo causado por
         * comentários ou documentação.
         */
        const pathImport =
          source.match(
            /import\s*\{([\s\S]*?)\}\s*from\s*["']node:path["'];?/
          );


        assert.ok(
          pathImport,
          "Import de node:path deve existir"
        );


        assert.doesNotMatch(
          pathImport[1],
          /\bresolve\b/,
          "pdf-protection.ts não deve importar resolve de node:path"
        );


        /**
         * Agora procuramos somente uso executável do
         * padrão antigo.
         *
         * Comentários contendo palavras como
         * 'resolve' não devem fazer o teste falhar.
         */
        assert.doesNotMatch(
          source,
          /return\s+resolve\(\s*process\.cwd\(\)\s*,\s*configuredPath\s*\)/,
          "PROTECTED_PDF_DIR não deve ser resolvido relativamente ao cwd"
        );


        assert.match(
          source,
          /isAbsolute\(\s*configuredPath\s*\)/
        );


        assert.match(
          source,
          /PROTECTED_PDF_DIR deve ser um caminho absoluto/
        );
      }
    );


    test(
      "package deve possuir comandos de manutenção e gate 4.4B.3",
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
            "maintenance:runtime"
          ]
        );


        assert.ok(
          packageJson.scripts[
            "maintenance:runtime:apply"
          ]
        );


        assert.ok(
          packageJson.scripts[
            "test:phase4m-runtime"
          ]
        );


        assert.ok(
          packageJson.scripts[
            "test:phase4-operations"
          ].includes(
            "test:phase4m-runtime"
          )
        );


        assert.ok(
          packageJson.scripts[
            "test:phase4-qa"
          ].includes(
            "test:phase4-operations"
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