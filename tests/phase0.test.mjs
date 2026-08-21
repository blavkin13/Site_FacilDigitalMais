import {
  after,
  before,
  describe,
  test,
} from "node:test";

import assert from "node:assert/strict";

import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";

import { tmpdir } from "node:os";
import { join } from "node:path";

let temporaryDirectory;
let databasePath;

describe(
  "Fase 0 - Infraestrutura SQLite e migrations",
  () => {
    before(() => {
      temporaryDirectory = mkdtempSync(
        join(
          tmpdir(),
          "facildigital-phase0-"
        )
      );

      databasePath = join(
        temporaryDirectory,
        "phase0-test.db"
      );

      /**
       * Os testes da Fase 0 nunca utilizam
       * data/dev.db.
       *
       * Um banco completamente isolado é criado
       * no diretório temporário do sistema
       * operacional.
       */
      process.env.DATABASE_PATH =
        databasePath;
    });

    after(async () => {
      try {
        const {
          closeDatabase,
        } = await import(
          "../db/index.ts"
        );

        closeDatabase();
      } finally {
        delete process.env.DATABASE_PATH;

        if (
          temporaryDirectory &&
          existsSync(temporaryDirectory)
        ) {
          rmSync(
            temporaryDirectory,
            {
              recursive: true,
              force: true,
            }
          );
        }
      }
    });

    test(
      "deve inicializar SQLite e migrations apenas uma vez por processo",
      async () => {
        const {
          initDatabase,
        } = await import(
          "../db/init.ts"
        );

        const {
          getSqliteConnection,
        } = await import(
          "../db/index.ts"
        );

        /**
         * Simula requests simultâneas
         * tentando inicializar o banco.
         *
         * Todas devem compartilhar a mesma
         * Promise de inicialização.
         */
        await Promise.all([
          initDatabase(),
          initDatabase(),
          initDatabase(),
          initDatabase(),
        ]);

        assert.ok(
          existsSync(databasePath),
          "O banco temporário deveria ter sido criado"
        );

        const sqlite =
          getSqliteConnection();

        const migrationRows =
          sqlite
            .prepare(`
              SELECT
                id,
                description,
                checksum
              FROM schema_migrations
              ORDER BY id
            `)
            .all();

        assert.equal(
          migrationRows.length,
          1,
          "A migration inicial deve ser registrada apenas uma vez"
        );

        assert.equal(
          migrationRows[0].id,
          "0001_initial_schema"
        );

        assert.ok(
          migrationRows[0].checksum,
          "A migration deve possuir checksum"
        );

        assert.equal(
          migrationRows[0].checksum.length,
          64,
          "O checksum SHA-256 deve possuir 64 caracteres"
        );
      }
    );

    test(
      "deve criar todas as tabelas essenciais da aplicação",
      async () => {
        const {
          getSqliteConnection,
        } = await import(
          "../db/index.ts"
        );

        const sqlite =
          getSqliteConnection();

        const rows =
          sqlite
            .prepare(`
              SELECT name
              FROM sqlite_master
              WHERE type = 'table'
              ORDER BY name
            `)
            .all();

        const tables = new Set(
          rows.map(
            (row) => row.name
          )
        );

        const requiredTables = [
          "users",
          "products",
          "orders",
          "order_items",
          "questions",
          "simulations",
          "simulation_results",
          "sessions",
          "protected_downloads",
          "schema_migrations",
        ];

        for (
          const table of requiredTables
        ) {
          assert.ok(
            tables.has(table),
            `Tabela obrigatória ausente: ${table}`
          );
        }
      }
    );

    test(
      "deve manter foreign keys habilitadas",
      async () => {
        const {
          getSqliteConnection,
        } = await import(
          "../db/index.ts"
        );

        const sqlite =
          getSqliteConnection();

        const foreignKeys =
          sqlite.pragma(
            "foreign_keys",
            {
              simple: true,
            }
          );

        assert.equal(
          foreignKeys,
          1,
          "PRAGMA foreign_keys deve permanecer habilitado"
        );
      }
    );

    test(
      "deve utilizar journal_mode WAL",
      async () => {
        const {
          getSqliteConnection,
        } = await import(
          "../db/index.ts"
        );

        const sqlite =
          getSqliteConnection();

        const journalMode =
          sqlite.pragma(
            "journal_mode",
            {
              simple: true,
            }
          );

        assert.equal(
          String(
            journalMode
          ).toLowerCase(),
          "wal",
          "SQLite deve trabalhar em journal_mode WAL"
        );
      }
    );

    test(
      "deve configurar busy_timeout para reduzir SQLITE_BUSY",
      async () => {
        const {
          getSqliteConnection,
        } = await import(
          "../db/index.ts"
        );

        const sqlite =
          getSqliteConnection();

        const busyTimeout =
          Number(
            sqlite.pragma(
              "busy_timeout",
              {
                simple: true,
              }
            )
          );

        assert.ok(
          busyTimeout >= 5000,
          "busy_timeout deve ser de pelo menos 5000 ms"
        );
      }
    );

    test(
      "banco criado deve passar no integrity_check",
      async () => {
        const {
          getSqliteConnection,
        } = await import(
          "../db/index.ts"
        );

        const sqlite =
          getSqliteConnection();

        const integrity =
          sqlite.pragma(
            "integrity_check",
            {
              simple: true,
            }
          );

        assert.equal(
          integrity,
          "ok",
          "SQLite integrity_check deveria retornar ok"
        );
      }
    );

    test(
      "runtime principal não deve conter dependências Cloudflare",
      () => {
        const files = [
          join(
            process.cwd(),
            "db",
            "index.ts"
          ),
          join(
            process.cwd(),
            "db",
            "init.ts"
          ),
          join(
            process.cwd(),
            "package.json"
          ),
          join(
            process.cwd(),
            "scripts",
            "deploy-hostinger.sh"
          ),
        ];

        const forbiddenPatterns = [
          /cloudflare/i,
          /wrangler/i,
          /vinext/i,
          /miniflare/i,
          /workerd/i,
          /drizzle-orm\/d1/i,
        ];

        for (
          const file of files
        ) {
          const content =
            readFileSync(
              file,
              "utf8"
            );

          for (
            const pattern
              of forbiddenPatterns
          ) {
            assert.doesNotMatch(
              content,
              pattern,
              `Dependência antiga encontrada em ${file}: ${pattern}`
            );
          }
        }
      }
    );

    test(
      "deploy de produção não deve executar seeds automaticamente",
      () => {
        const deployPath = join(
          process.cwd(),
          "scripts",
          "deploy-hostinger.sh"
        );

        const deployContent =
          readFileSync(
            deployPath,
            "utf8"
          );

        /**
         * Remove comentários antes da
         * verificação.
         *
         * Isso permite documentar os comandos
         * proibidos dentro do próprio script sem
         * gerar falso positivo.
         */
        const executableLines =
          deployContent
            .split("\n")
            .filter(
              (line) =>
                !line
                  .trim()
                  .startsWith("#")
            )
            .join("\n");

        assert.doesNotMatch(
          executableLines,
          /npm\s+run\s+db:seed(?:\s|$)/,
          "Deploy não deve executar db:seed automaticamente"
        );

        assert.doesNotMatch(
          executableLines,
          /npm\s+run\s+db:seed-orders(?:\s|$)/,
          "Deploy não deve criar pedidos de teste"
        );

        assert.doesNotMatch(
          executableLines,
          /npm\s+run\s+db:seed-simulations(?:\s|$)/,
          "Deploy não deve criar simulados de teste"
        );
      }
    );

    test(
      "package.json deve incluir a Fase 0 no test:all",
      () => {
        const packagePath = join(
          process.cwd(),
          "package.json"
        );

        const packageJson =
          JSON.parse(
            readFileSync(
              packagePath,
              "utf8"
            )
          );

        assert.ok(
          packageJson
            .scripts[
              "test:phase0"
            ],
          "package.json deve possuir test:phase0"
        );

        assert.ok(
          packageJson
            .scripts[
              "test:all"
            ]
            .includes(
              "test:phase0"
            ),
          "test:all deve executar a Fase 0"
        );

        /**
         * O tsx é uma dependência local do
         * projeto.
         *
         * Não usamos mais "npx tsx", evitando
         * resolução/download implícito de versão.
         */
        assert.equal(
          packageJson
            .scripts[
              "db:migrate"
            ],
          "tsx db/init.ts",
          "db:migrate deve executar o sistema oficial de migrations usando o tsx local"
        );

        assert.equal(
          packageJson
            .scripts[
              "db:init"
            ],
          "tsx db/init.ts",
          "db:init deve utilizar o mesmo inicializador oficial"
        );

        assert.ok(
          packageJson
            .devDependencies
            ?.tsx,
          "tsx deve estar declarado explicitamente em devDependencies"
        );
      }
    );

    test(
      "desenvolvimento deve utilizar Next.js nativo",
      () => {
        const packagePath = join(
          process.cwd(),
          "package.json"
        );

        const packageJson =
          JSON.parse(
            readFileSync(
              packagePath,
              "utf8"
            )
          );

        assert.match(
          packageJson
            .scripts.dev,
          /^next dev/,
          "Servidor de desenvolvimento deve utilizar Next.js"
        );

        assert.equal(
          packageJson
            .scripts.build,
          "next build"
        );

        assert.equal(
          packageJson
            .scripts.start,
          "next start"
        );
      }
    );
  }
);