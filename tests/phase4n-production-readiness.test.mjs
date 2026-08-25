import {
  after,
  before,
  describe,
  test,
} from "node:test";

import assert from "node:assert/strict";

import {
  mkdtemp,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";

import {
  tmpdir,
} from "node:os";

import {
  join,
} from "node:path";

import Database from "better-sqlite3";

import {
  createIsolatedDatabase,
} from "./helpers/isolated-database.mjs";


describe(
  "Fase 4.4B.3B - Prontidão para produção",
  () => {
    let isolated;

    let sqlite;

    let backupDirectory;


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


        backupDirectory =
          await mkdtemp(
            join(
              tmpdir(),
              "facildigital-backups-"
            )
          );


        /**
         * Marcador conhecido para provar que o
         * conteúdo do banco chegou ao backup.
         */
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
            "backup-marker@teste.local",
            "test-only-hash",
            "Backup Marker"
          );
      }
    );


    test(
      "backup online deve produzir SQLite íntegro com os dados atuais",
      async () => {
        const {
          createDatabaseBackup,
        } =
          await import(
            "../lib/database-backup.ts"
          );


        const result =
          await createDatabaseBackup({
            backupDirectory,

            retentionCount:
              5,

            now:
              new Date(
                "2026-08-24T12:00:00.000Z"
              ),
          });


        assert.equal(
          result.integrity,
          "ok"
        );


        const backup =
          new Database(
            result.path,
            {
              readonly:
                true,

              fileMustExist:
                true,
            }
          );


        try {
          assert.equal(
            backup.pragma(
              "integrity_check",
              {
                simple:
                  true,
              }
            ),
            "ok"
          );


          const marker =
            backup
              .prepare(`
                SELECT
                  email
                FROM users
                WHERE email = ?
              `)
              .get(
                "backup-marker@teste.local"
              );


          assert.ok(
            marker
          );


          assert.equal(
            marker.email,
            "backup-marker@teste.local"
          );
        } finally {
          backup.close();
        }
      }
    );


    test(
      "retenção deve remover somente backups antigos da própria rotina",
      async () => {
        const {
          createDatabaseBackup,
        } =
          await import(
            "../lib/database-backup.ts"
          );


        await createDatabaseBackup({
          backupDirectory,

          retentionCount:
            2,

          now:
            new Date(
              "2026-08-24T13:00:00.000Z"
            ),
        });


        const last =
          await createDatabaseBackup({
            backupDirectory,

            retentionCount:
              2,

            now:
              new Date(
                "2026-08-24T14:00:00.000Z"
              ),
          });


        assert.ok(
          last.removedOldBackups >=
            1
        );


        const backups =
          (
            await readdir(
              backupDirectory
            )
          ).filter(
            (
              filename
            ) =>
              filename.startsWith(
                "facildigital-sqlite-"
              ) &&
              filename.endsWith(
                ".db"
              )
          );


        assert.equal(
          backups.length,
          2
        );
      }
    );


    test(
      "diretório de backup configurado deve ser absoluto",
      async () => {
        const {
          getDatabaseBackupDirectory,
        } =
          await import(
            "../lib/database-backup.ts"
          );


        assert.throws(
          () =>
            getDatabaseBackupDirectory(
              "backups/relativo"
            ),
          /caminho absoluto/i
        );


        assert.equal(
          getDatabaseBackupDirectory(
            "/tmp/facildigital-backups"
          ),
          "/tmp/facildigital-backups"
        );
      }
    );


    test(
      "backup deve utilizar API online e não cópia bruta do arquivo WAL",
      async () => {
        const source =
          await readFile(
            join(
              process.cwd(),
              "lib",
              "database-backup.ts"
            ),
            "utf8"
          );


        /**
         * O mecanismo obrigatório é a Online Backup
         * API exposta pelo better-sqlite3.
         */
        assert.match(
          source,
          /\.backup\(\s*destination\s*\)/
        );


        /**
         * O arquivo gerado só pode ser considerado
         * backup válido após integrity_check.
         */
        assert.match(
          source,
          /integrity_check/
        );


        /**
         * Verificamos especificamente o import de
         * node:fs/promises.
         *
         * A palavra "copyFile" pode aparecer em
         * comentários explicando justamente por que
         * NÃO utilizamos cópia bruta.
         */
        const fsPromisesImport =
          source.match(
            /import\s*\{([\s\S]*?)\}\s*from\s*["']node:fs\/promises["'];?/
          );


        assert.ok(
          fsPromisesImport,
          "Import de node:fs/promises deve existir"
        );


        assert.doesNotMatch(
          fsPromisesImport[1],
          /\bcopyFile\b/,
          "database-backup.ts não deve importar copyFile"
        );


        /**
         * Também impedimos uma chamada executável de
         * copyFile().
         *
         * Este padrão ignora menções dentro de
         * comentários de documentação.
         */
        assert.doesNotMatch(
          source,
          /(?:^|\n)\s*(?:await\s+)?copyFile\s*\(/m,
          "backup não deve executar copyFile()"
        );


        /**
         * Não deve existir manipulação manual dos
         * arquivos auxiliares do WAL.
         *
         * A Online Backup API deve cuidar da
         * consistência do snapshot.
         */
        assert.doesNotMatch(
          source,
          /["'`][^"'`]*-wal["'`]/
        );
      }
    );


    test(
      "PM2 deve usar uma única instância em fork mode",
      async () => {
        const source =
          await readFile(
            join(
              process.cwd(),
              "ecosystem.config.cjs"
            ),
            "utf8"
          );


        assert.match(
          source,
          /instances:\s*1/
        );


        assert.match(
          source,
          /exec_mode:\s*["']fork["']/
        );


        assert.match(
          source,
          /127\.0\.0\.1/
        );


        assert.doesNotMatch(
          source,
          /instances:\s*["']max["']/
        );


        /**
         * Segredos não pertencem ao ecosystem.
         */
        assert.doesNotMatch(
          source,
          /MERCADO_PAGO_ACCESS_TOKEN/
        );


        assert.doesNotMatch(
          source,
          /ADMIN_SEED_PASSWORD/
        );
      }
    );


    test(
      ".env.example deve documentar paths seguros de produção",
      async () => {
        const source =
          await readFile(
            join(
              process.cwd(),
              ".env.example"
            ),
            "utf8"
          );


        assert.match(
          source,
          /APP_BASE_URL=/
        );


        assert.match(
          source,
          /DATABASE_BACKUP_DIR=/
        );


        assert.match(
          source,
          /DATABASE_BACKUP_RETENTION=14/
        );


        assert.match(
          source,
          /PROTECTED_PDF_DIR=/
        );


        assert.doesNotMatch(
          source,
          /^PROTECTED_PDF_DIR=\.\/data\/protected$/m
        );


        assert.match(
          source,
          /ADMIN_SEED_PASSWORD=/
        );
      }
    );


    test(
      "package deve possuir backup e gate final da Fase 4.4",
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
            "db:backup"
          ]
        );


        assert.ok(
          packageJson.scripts[
            "test:phase4n-production"
          ]
        );


        assert.ok(
          packageJson.scripts[
            "test:phase4-production"
          ].includes(
            "test:phase4n-production"
          )
        );


        assert.ok(
          packageJson.scripts[
            "test:phase4-qa"
          ].includes(
            "test:phase4-production"
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
      async () => {
        isolated
          ?.cleanup();


        if (
          backupDirectory
        ) {
          await rm(
            backupDirectory,
            {
              recursive:
                true,

              force:
                true,
            }
          );
        }
      }
    );
  }
);