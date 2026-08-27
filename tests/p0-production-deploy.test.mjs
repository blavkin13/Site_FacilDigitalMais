import {
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



async function readProjectFile(
  ...parts
) {
  return readFile(
    join(
      process.cwd(),
      ...parts
    ),
    "utf8"
  );
}



describe(
  "P0 - hardening do deploy de produção",
  () => {
    test(
      "backup do SQLite deve ser pre-migration",
      async () => {
        const source =
          await readProjectFile(
            "lib",
            "database-backup.ts"
          );


        /**
         * A verificação procura a dependência real,
         * e não a palavra "initDatabase" em comentários.
         *
         * O módulo de backup não pode importar db/init,
         * pois esse módulo executa migrations.
         */
        assert.doesNotMatch(
          source,
          /from\s+["']\.\.\/db\/init["']/,
          "Backup não pode importar db/init porque initDatabase executa migrations"
        );


        assert.match(
          source,
          /\bgetDatabasePath\b/,
          "Backup deve resolver explicitamente o DATABASE_PATH"
        );


        assert.match(
          source,
          /\bexistsSync\b/,
          "Backup deve verificar se o banco de origem existe"
        );


        assert.match(
          source,
          /\.backup\s*\(/,
          "Backup deve continuar utilizando a Online Backup API"
        );


        assert.match(
          source,
          /integrity_check/,
          "Backup deve continuar verificando integridade"
        );
      }
    );


    test(
      "PM2 deve carregar apenas o caminho do ambiente protegido",
      async () => {
        const source =
          await readProjectFile(
            "ecosystem.config.cjs"
          );


        assert.match(
          source,
          /node_args\s*:\s*["']--env-file=\/etc\/facil-digital-plus\/production\.env["']/,
          "PM2 deve carregar o arquivo protegido através de --env-file"
        );


        assert.doesNotMatch(
          source,
          /MERCADO_PAGO_ACCESS_TOKEN/,
          "Access token não pode ser persistido no ecosystem"
        );


        assert.doesNotMatch(
          source,
          /MERCADO_PAGO_WEBHOOK_SECRET/,
          "Webhook secret não pode ser persistido no ecosystem"
        );


        assert.match(
          source,
          /instances\s*:\s*1/,
          "SQLite exige uma única instância da aplicação"
        );


        assert.match(
          source,
          /exec_mode\s*:\s*["']fork["']/,
          "PM2 deve permanecer em fork mode"
        );


        assert.match(
          source,
          /start -H 127\.0\.0\.1 -p 3000/,
          "Next.js deve continuar restrito ao bind interno"
        );
      }
    );


    test(
      "deploy deve exigir main e worktree limpa",
      async () => {
        const source =
          await readProjectFile(
            "scripts",
            "deploy-hostinger.sh"
          );


        assert.match(
          source,
          /CURRENT_BRANCH/,
          "Deploy deve verificar a branch atual"
        );


        assert.match(
          source,
          /\$CURRENT_BRANCH["']?\s*!=\s*["']main["']/,
          "Deploy deve aceitar produção somente pela main"
        );


        assert.doesNotMatch(
          source,
          /read\s+-r\s+-p/,
          "Deploy não pode oferecer bypass interativo para branch incorreta"
        );


        assert.match(
          source,
          /git status --porcelain/,
          "Deploy deve exigir worktree limpa"
        );
      }
    );


    test(
      "deploy deve usar arquivo de ambiente externo protegido",
      async () => {
        const source =
          await readProjectFile(
            "scripts",
            "deploy-hostinger.sh"
          );


        assert.match(
          source,
          /ENV_FILE=["']\/etc\/facil-digital-plus\/production\.env["']/,
          "Deploy deve utilizar o caminho oficial do ambiente protegido"
        );


        assert.match(
          source,
          /stat -c ["']%a["']/,
          "Deploy deve verificar permissões do arquivo de ambiente"
        );


        assert.match(
          source,
          /--env-file=["']?\$ENV_FILE["']?/,
          "Comandos Node devem carregar o ambiente protegido"
        );


        assert.doesNotMatch(
          source,
          /\bsource\s+["']?\$ENV_FILE/,
          "Deploy não deve exportar secrets para o shell através de source"
        );
      }
    );


    test(
      "deploy deve criar backup antes da migration",
      async () => {
        const source =
          await readProjectFile(
            "scripts",
            "deploy-hostinger.sh"
          );


        const backupIndex =
          source.indexOf(
            "scripts/backup-database.ts"
          );


        const migrationIndex =
          source.indexOf(
            "db/init.ts"
          );


        assert.ok(
          backupIndex >=
            0,
          "Deploy deve executar backup"
        );


        assert.ok(
          migrationIndex >=
            0,
          "Deploy deve executar migration"
        );


        assert.ok(
          backupIndex <
            migrationIndex,
          "Backup deve ocorrer antes da migration"
        );


        assert.match(
          source,
          /BACKUP PRÉ-MIGRATION/,
          "Deploy deve documentar explicitamente o backup pré-migration"
        );
      }
    );


    test(
      "deploy não deve executar seeds automaticamente",
      async () => {
        const source =
          await readProjectFile(
            "scripts",
            "deploy-hostinger.sh"
          );


        const executableLines =
          source
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
          /npm\s+run\s+db:seed(?:\s|$)/
        );


        assert.doesNotMatch(
          executableLines,
          /npm\s+run\s+db:seed-orders/
        );


        assert.doesNotMatch(
          executableLines,
          /npm\s+run\s+db:seed-simulations/
        );
      }
    );


    test(
      "deploy deve persistir configuração PM2 após restart",
      async () => {
        const source =
          await readProjectFile(
            "scripts",
            "deploy-hostinger.sh"
          );


        assert.match(
          source,
          /pm2 describe/,
          "Deploy deve verificar se o processo já existe"
        );


        assert.match(
          source,
          /pm2 restart/,
          "Deploy deve reiniciar processo existente"
        );


        assert.match(
          source,
          /pm2 start/,
          "Deploy deve iniciar processo ainda inexistente"
        );


        assert.match(
          source,
          /pm2 save/,
          "Deploy deve persistir configuração para reinicialização da VPS"
        );
      }
    );


    test(
      "Nginx deve canonicalizar domínio e encaminhar apenas para o bind interno",
      async () => {
        const source =
          await readProjectFile(
            "scripts",
            "nginx-config.conf"
          );


        const internalTargets =
          source.match(
            /proxy_pass\s+http:\/\/127\.0\.0\.1:3000;/g
          ) ??
          [];


        assert.ok(
          internalTargets.length >=
            2,
          "Proxy principal e webhook devem usar 127.0.0.1:3000"
        );


        assert.doesNotMatch(
          source,
          /proxy_pass\s+http:\/\/localhost:3000;/,
          "Configuração oficial não deve depender da resolução de localhost"
        );


        assert.match(
          source,
          /server\s*\{[\s\S]*?listen\s+443\s+ssl\s+http2;[\s\S]*?server_name\s+www\.facildigitalmais\.com\s*;[\s\S]*?return\s+301\s+https:\/\/facildigitalmais\.com\$request_uri\s*;[\s\S]*?\}/,
          "HTTPS www deve convergir para a origem canônica"
        );


        assert.match(
          source,
          /server\s*\{[\s\S]*?listen\s+443\s+ssl\s+http2;[\s\S]*?server_name\s+facildigitalmais\.com\s*;/,
          "Aplicação deve responder somente pela origem HTTPS canônica"
        );


        assert.doesNotMatch(
          source,
          /location\s+~\*[^\n]*(?:css|js|woff|png|jpg)/i,
          "Assets do Next.js não podem ser interceptados por location regex sem proxy"
        );
      }
    );


    test(
      "Nginx deve preservar headers de reverse proxy também para webhooks",
      async () => {
        const source =
          await readProjectFile(
            "scripts",
            "nginx-config.conf"
          );


        for (
          const header
          of [
            "Host",
            "X-Forwarded-Host",
            "X-Real-IP",
            "X-Forwarded-For",
            "X-Forwarded-Proto",
          ]
        ) {
          const matches =
            source.match(
              new RegExp(
                `proxy_set_header\\s+${header.replace(
                  /-/g,
                  "\\-"
                )}\\b`,
                "g"
              )
            ) ??
            [];


          assert.ok(
            matches.length >=
              2,
            `${header} deve ser preservado no proxy principal e no webhook`
          );
        }
      }
    );


    test(
      "README deve documentar ambiente externo, backup e rollback",
      async () => {
        const source =
          await readProjectFile(
            "README.md"
          );


        assert.match(
          source,
          /\/etc\/facil-digital-plus\/production\.env/,
          "README deve documentar o arquivo externo de produção"
        );


        assert.match(
          source,
          /chmod 600/,
          "README deve documentar permissão restrita do arquivo de ambiente"
        );


        assert.match(
          source,
          /backup PRE-MIGRATION/i,
          "README deve documentar backup antes da migration"
        );


        assert.match(
          source,
          /Rollback de producao/i,
          "README deve possuir procedimento de rollback"
        );


        assert.match(
          source,
          /pm2 stop facil-digital-mais/,
          "Rollback deve parar a aplicação antes de restaurar SQLite"
        );


        assert.match(
          source,
          /DATABASE_PATH.*failed/s,
          "Rollback deve preservar o banco que apresentou falha"
        );


        assert.match(
          source,
          /-wal/,
          "Rollback deve tratar WAL residual com a aplicação parada"
        );


        assert.match(
          source,
          /-shm/,
          "Rollback deve tratar SHM residual com a aplicação parada"
        );
      }
    );


    test(
      "nova suite deve participar do gate completo",
      async () => {
        const source =
          await readProjectFile(
            "package.json"
          );


        const pkg =
          JSON.parse(
            source
          );


        assert.equal(
          pkg.scripts[
            "test:p0-production-deploy"
          ],
          "NODE_NO_WARNINGS=1 tsx --test --test-isolation=none --no-warnings tests/p0-production-deploy.test.mjs"
        );


        assert.match(
          pkg.scripts[
            "test:all"
          ],
          /\btest:p0-production-deploy\b/,
          "test:all deve executar o hardening de deploy"
        );
      }
    );
  }
);