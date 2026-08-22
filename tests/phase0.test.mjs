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

import {
  tmpdir,
} from "node:os";

import {
  join,
} from "node:path";


let temporaryDirectory;

let databasePath;

let previousDatabasePath;


/**
 * Fase 0
 *
 * Valida a infraestrutura fundamental da aplicação:
 *
 * - SQLite isolado;
 * - migrations;
 * - integridade do banco;
 * - WAL;
 * - foreign keys;
 * - busy timeout;
 * - ausência do runtime Cloudflare;
 * - deploy sem seeds automáticos;
 * - scripts oficiais;
 * - Next.js nativo.
 */
describe(
  "Fase 0 - Infraestrutura SQLite e migrations",
  () => {
    before(
      () => {
        previousDatabasePath =
          process.env
            .DATABASE_PATH;


        temporaryDirectory =
          mkdtempSync(
            join(
              tmpdir(),
              "facildigital-phase0-"
            )
          );


        databasePath =
          join(
            temporaryDirectory,
            "phase0-test.db"
          );


        /**
         * Nunca utilizamos data/dev.db.
         *
         * O caminho é configurado antes de qualquer
         * import do runtime do banco.
         */
        process.env
          .DATABASE_PATH =
          databasePath;
      }
    );


    after(
      async () => {
        try {
          /**
           * O import acontece somente depois de
           * DATABASE_PATH ter sido configurado.
           */
          const {
            closeDatabase,
          } =
            await import(
              "../db/index.ts"
            );


          closeDatabase();
        } finally {
          if (
            previousDatabasePath ===
            undefined
          ) {
            delete process.env
              .DATABASE_PATH;
          } else {
            process.env
              .DATABASE_PATH =
              previousDatabasePath;
          }


          if (
            temporaryDirectory &&
            existsSync(
              temporaryDirectory
            )
          ) {
            rmSync(
              temporaryDirectory,
              {
                recursive:
                  true,

                force:
                  true,
              }
            );
          }
        }
      }
    );


    test(
      "deve inicializar SQLite e registrar migrations sem duplicação",
      async () => {
        const {
          initDatabase,
        } =
          await import(
            "../db/init.ts"
          );


        const {
          getSqliteConnection,
        } =
          await import(
            "../db/index.ts"
          );


        /**
         * Simula vários consumidores tentando
         * inicializar o banco simultaneamente.
         *
         * A inicialização precisa ser segura dentro
         * do mesmo processo e nenhuma migration pode
         * ser registrada mais de uma vez.
         */
        await Promise.all([
          initDatabase(),
          initDatabase(),
          initDatabase(),
          initDatabase(),
        ]);


        assert.ok(
          existsSync(
            databasePath
          ),
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


        assert.ok(
          migrationRows.length >
            0,
          "O banco deve possuir migrations registradas"
        );


        const migrationIds =
          migrationRows.map(
            (
              migration
            ) =>
              migration.id
          );


        const uniqueMigrationIds =
          new Set(
            migrationIds
          );


        /**
         * Não exigimos mais exatamente uma migration.
         *
         * O sistema precisa poder evoluir para:
         *
         * 0001
         * 0002
         * 0003
         * ...
         *
         * sem que o teste histórico quebre.
         */
        assert.equal(
          uniqueMigrationIds.size,
          migrationRows.length,
          "Cada migration deve ser registrada apenas uma vez"
        );


        /**
         * Migrations fundamentais conhecidas
         * atualmente.
         */
        assert.ok(
          migrationIds.includes(
            "0001_initial_schema"
          ),
          "Migration inicial deve estar registrada"
        );


        assert.ok(
          migrationIds.includes(
            "0002_product_editorial_metadata"
          ),
          "Migration editorial deve estar registrada"
        );


        /**
         * Todo registro precisa possuir checksum
         * SHA-256.
         */
        for (
          const migration of
            migrationRows
        ) {
          assert.equal(
            typeof migration
              .checksum,
            "string",
            `Migration ${migration.id} deve possuir checksum`
          );


          assert.equal(
            migration
              .checksum
              .length,
            64,
            `Checksum da migration ${migration.id} deve possuir 64 caracteres`
          );


          assert.match(
            migration
              .checksum,
            /^[a-f0-9]{64}$/i,
            `Checksum da migration ${migration.id} deve ser SHA-256 hexadecimal`
          );
        }


        /**
         * Uma segunda chamada depois da inicialização
         * também não pode criar novos registros.
         */
        const migrationCountBefore =
          migrationRows.length;


        await initDatabase();


        const migrationCountAfter =
          sqlite
            .prepare(`
              SELECT COUNT(*) AS total
              FROM schema_migrations
            `)
            .get()
            .total;


        assert.equal(
          migrationCountAfter,
          migrationCountBefore,
          "Reinicializar no mesmo processo não pode reaplicar migrations"
        );
      }
    );


    test(
      "deve criar todas as tabelas essenciais da aplicação",
      async () => {
        const {
          getSqliteConnection,
        } =
          await import(
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


        const tables =
          new Set(
            rows.map(
              (
                row
              ) =>
                row.name
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
          const table of
            requiredTables
        ) {
          assert.ok(
            tables.has(
              table
            ),
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
        } =
          await import(
            "../db/index.ts"
          );


        const sqlite =
          getSqliteConnection();


        const foreignKeys =
          sqlite.pragma(
            "foreign_keys",
            {
              simple:
                true,
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
        } =
          await import(
            "../db/index.ts"
          );


        const sqlite =
          getSqliteConnection();


        const journalMode =
          sqlite.pragma(
            "journal_mode",
            {
              simple:
                true,
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
        } =
          await import(
            "../db/index.ts"
          );


        const sqlite =
          getSqliteConnection();


        const busyTimeout =
          Number(
            sqlite.pragma(
              "busy_timeout",
              {
                simple:
                  true,
              }
            )
          );


        assert.ok(
          busyTimeout >=
            5000,
          "busy_timeout deve ser de pelo menos 5000 ms"
        );
      }
    );


    test(
      "banco criado deve passar no integrity_check",
      async () => {
        const {
          getSqliteConnection,
        } =
          await import(
            "../db/index.ts"
          );


        const sqlite =
          getSqliteConnection();


        const integrity =
          sqlite.pragma(
            "integrity_check",
            {
              simple:
                true,
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
          const file of
            files
        ) {
          assert.ok(
            existsSync(
              file
            ),
            `Arquivo esperado não encontrado: ${file}`
          );


          const content =
            readFileSync(
              file,
              "utf8"
            );


          for (
            const pattern of
              forbiddenPatterns
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
        const deployPath =
          join(
            process.cwd(),
            "scripts",
            "deploy-hostinger.sh"
          );


        assert.ok(
          existsSync(
            deployPath
          ),
          "Script de deploy da Hostinger deve existir"
        );


        const deployContent =
          readFileSync(
            deployPath,
            "utf8"
          );


        /**
         * Comentários são removidos antes da análise.
         *
         * Assim o script pode documentar comandos
         * proibidos sem gerar falso positivo.
         */
        const executableLines =
          deployContent
            .split(
              "\n"
            )
            .filter(
              (
                line
              ) =>
                !line
                  .trim()
                  .startsWith(
                    "#"
                  )
            )
            .join(
              "\n"
            );


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
        const packagePath =
          join(
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
         * O tsx é uma dependência local do projeto.
         *
         * Não usamos npx tsx para evitar resolução
         * ou download implícito de outra versão.
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
        const packagePath =
          join(
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
            .scripts
            .dev,
          /^next dev/,
          "Servidor de desenvolvimento deve utilizar Next.js"
        );


        assert.equal(
          packageJson
            .scripts
            .build,
          "next build"
        );


        assert.equal(
          packageJson
            .scripts
            .start,
          "next start"
        );
      }
    );
  }
);