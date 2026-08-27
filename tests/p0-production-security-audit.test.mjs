import assert from "node:assert/strict";

import {
  readFileSync,
} from "node:fs";

import {
  join,
} from "node:path";

import {
  spawnSync,
} from "node:child_process";

import {
  describe,
  test,
} from "node:test";


function read(
  ...parts
) {
  return readFileSync(
    join(
      process.cwd(),
      ...parts
    ),
    "utf8"
  );
}


function stripComments(
  source
) {
  return source
    .replace(
      /\/\*[\s\S]*?\*\//g,
      ""
    )
    .replace(
      /^\s*\/\/.*$/gm,
      ""
    );
}


describe(
  "P0 - auditoria final de segurança pré-produção",
  () => {
    test(
      "security audit completo deve passar",
      () => {
        const result =
          spawnSync(
            process.execPath,
            [
              "scripts/production-security-audit.mjs",
              "--json",
            ],
            {
              cwd:
                process.cwd(),

              encoding:
                "utf8",
            }
          );


        assert.equal(
          result.status,
          0,
          result.stderr ||
            result.stdout
        );


        const report =
          JSON.parse(
            result.stdout
          );


        assert.equal(
          report.status,
          "passed"
        );


        assert.ok(
          report.totals
            .checks >=
            15,
          "Auditoria final deve cobrir múltiplas superfícies de produção"
        );


        assert.equal(
          report.totals
            .failed,
          0
        );


        assert.ok(
          report.checks.every(
            (
              check
            ) =>
              check.ok ===
              true
          )
        );
      }
    );


    test(
      "auditor de produção deve permanecer read-only",
      () => {
        const source =
          stripComments(
            read(
              "scripts",
              "production-security-audit.mjs"
            )
          );


        for (
          const forbidden
          of [
            /\bwriteFileSync\b/,
            /\bwriteFile\b/,
            /\bappendFileSync\b/,
            /\bappendFile\b/,
            /\bunlinkSync\b/,
            /\bunlink\b/,
            /\brmSync\b/,
            /\brm\b/,
            /\brenameSync\b/,
            /\brename\b/,
            /\bmkdirSync\b/,
            /\bmkdir\b/,
            /\binitDatabase\b/,
            /\brunMigrations\b/,
          ]
        ) {
          assert.doesNotMatch(
            source,
            forbidden
          );
        }
      }
    );


    test(
      "produção não pode usar NEXT_PUBLIC_BASE_URL como autoridade CSRF",
      () => {
        const source =
          stripComments(
            read(
              "lib",
              "request-security.ts"
            )
          );


        assert.match(
          source,
          /getAppBaseUrl/
        );


        assert.match(
          source,
          /PaymentConfigurationError/
        );


        assert.doesNotMatch(
          source,
          /NEXT_PUBLIC_BASE_URL/
        );
      }
    );


    test(
      "webhook deve autenticar antes de tocar banco ou provedor",
      () => {
        const source =
          stripComments(
            read(
              "lib",
              "mercadopago-webhook-handler.ts"
            )
          );


        const handler =
          source.slice(
            source.indexOf(
              "return async function mercadoPagoWebhookPost"
            )
          );


        const validateIndex =
          handler.indexOf(
            ".validateSignature("
          );


        const parseIndex =
          handler.indexOf(
            ".parseNotification("
          );


        const databaseIndex =
          handler.indexOf(
            ".initializeDatabase("
          );


        const providerIndex =
          handler.indexOf(
            ".getPayment("
          );


        assert.ok(
          validateIndex >=
            0
        );


        assert.ok(
          parseIndex >
            validateIndex
        );


        assert.ok(
          databaseIndex >
            validateIndex
        );


        assert.ok(
          providerIndex >
            validateIndex
        );
      }
    );


    test(
      "webhook deve preservar fluxos oficiais de payment e chargeback",
      () => {
        const source =
          read(
            "lib",
            "mercadopago-webhook-handler.ts"
          );


        assert.match(
          source,
          /topic_chargebacks_wh/
        );


        assert.match(
          source,
          /getMercadoPagoChargebackPaymentId/
        );


        assert.match(
          source,
          /getPaymentStatus/
        );


        assert.doesNotMatch(
          source,
          /modo demo|simula aprova|DEMO-/i
        );
      }
    );


    test(
      "quarentena não deve mais logar external_reference",
      () => {
        const source =
          stripComments(
            read(
              "lib",
              "mercadopago-webhook-handler.ts"
            )
          );


        assert.doesNotMatch(
          source,
          /console\.(?:warn|log|error)\s*\([\s\S]{0,260}?external_reference\s*=\s*\$\{/i
        );


        assert.match(
          source,
          /logPaymentWebhookLedgerEvent/
        );
      }
    );


    test(
      "erro bruto do SDK não deve ser despejado na criação da preferência",
      () => {
        const source =
          stripComments(
            read(
              "lib",
              "mercadopago.ts"
            )
          );


        assert.doesNotMatch(
          source,
          /console\.error\s*\(\s*["']Erro ao criar preferência Mercado Pago:["']\s*,\s*error\s*\)/m
        );


        assert.match(
          source,
          /Falha do provedor ao criar preferência Mercado Pago\./
        );
      }
    );


    test(
      "admin de pedidos deve permanecer somente leitura",
      () => {
        const source =
          stripComments(
            read(
              "app",
              "api",
              "admin",
              "orders",
              "route.ts"
            )
          );


        assert.match(
          source,
          /export\s+async\s+function\s+GET\s*\(/
        );


        for (
          const method
          of [
            "POST",
            "PATCH",
            "PUT",
            "DELETE",
          ]
        ) {
          assert.doesNotMatch(
            source,
            new RegExp(
              `export\\s+(?:async\\s+)?function\\s+${method}\\s*\\(`
            )
          );
        }


        assert.doesNotMatch(
          source,
          /\.update\s*\(\s*orders\s*\)/
        );
      }
    );


    test(
      "status do checkout deve ser autenticado e read-only",
      () => {
        const source =
          stripComments(
            read(
              "app",
              "api",
              "checkout",
              "status",
              "route.ts"
            )
          );


        assert.match(
          source,
          /validateSession/
        );


        assert.match(
          source,
          /external_reference/
        );


        assert.doesNotMatch(
          source,
          /\.update\s*\(/
        );


        assert.doesNotMatch(
          source,
          /\.insert\s*\(/
        );


        assert.doesNotMatch(
          source,
          /\.delete\s*\(/
        );
      }
    );


    test(
      "success não pode transformar parâmetros do navegador em aprovação",
      () => {
        const source =
          stripComments(
            read(
              "components",
              "checkout-success.tsx"
            )
          );


        for (
          const forbidden
          of [
            "status",
            "collection_status",
            "payment_id",
            "collection_id",
            "demo",
          ]
        ) {
          assert.doesNotMatch(
            source,
            new RegExp(
              `searchParams\\.get\\(\\s*["']${forbidden}["']\\s*\\)`
            )
          );
        }


        assert.match(
          source,
          /searchParams\.get\(\s*["']external_reference["']\s*\)/
        );


        assert.match(
          source,
          /\/api\/checkout\/status/
        );


        assert.match(
          source,
          /status\s*===\s*["']approved["']/
        );


        assert.match(
          source,
          /entitlementActive\s*!==\s*true/
        );
      }
    );


    test(
      "ecosystem não deve carregar credenciais financeiras diretamente",
      () => {
        const source =
          read(
            "ecosystem.config.cjs"
          );


        assert.match(
          source,
          /--env-file=\/etc\/facil-digital-plus\/production\.env/
        );


        assert.doesNotMatch(
          source,
          /MERCADO_PAGO_ACCESS_TOKEN/
        );


        assert.doesNotMatch(
          source,
          /MERCADO_PAGO_WEBHOOK_SECRET/
        );


        assert.match(
          source,
          /127\.0\.0\.1/
        );


        assert.match(
          source,
          /instances\s*:\s*1/
        );


        assert.match(
          source,
          /exec_mode\s*:\s*["']fork["']/
        );
      }
    );


    test(
      "deploy deve manter backup antes de migration e PM2 persistido",
      () => {
        const source =
          read(
            "scripts",
            "deploy-hostinger.sh"
          );


        assert.match(
          source,
          /\/etc\/facil-digital-plus\/production\.env/
        );


        assert.match(
          source,
          /git\s+status\s+--porcelain/
        );


        assert.match(
          source,
          /--env-file/
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
            0
        );


        assert.ok(
          migrationIndex >
            backupIndex
        );


        assert.match(
          source,
          /pm2\s+save/
        );


        const executable =
          source.replace(
            /^\s*#.*$/gm,
            ""
          );


        assert.doesNotMatch(
          executable,
          /(?:^|\n)\s*(?:source|\.)\s+(?:"?\$ENV_FILE"?|\/etc\/facil-digital-plus\/production\.env)/m
        );


        assert.doesNotMatch(
          executable,
          /\bdb:seed\b|seed-orders|seed-simulations|db\/seed\.ts/
        );
      }
    );


    test(
      "Nginx deve canonicalizar www e preservar reverse proxy interno",
      () => {
        const source =
          read(
            "scripts",
            "nginx-config.conf"
          );


        const proxyMatches =
          source.match(
            /proxy_pass\s+http:\/\/127\.0\.0\.1:3000;/g
          ) ??
          [];


        assert.ok(
          proxyMatches.length >=
            2
        );


        assert.match(
          source,
          /server\s*\{[\s\S]*?listen\s+443\s+ssl\s+http2;[\s\S]*?server_name\s+www\.facildigitalmais\.com\s*;[\s\S]*?return\s+301\s+https:\/\/facildigitalmais\.com\$request_uri\s*;[\s\S]*?\}/
        );


        assert.match(
          source,
          /server\s*\{[\s\S]*?listen\s+443\s+ssl\s+http2;[\s\S]*?server_name\s+facildigitalmais\.com\s*;/
        );


        assert.doesNotMatch(
          source,
          /location\s+~\*[^\n]*(?:css|js|woff|png|jpg)/i
        );


        assert.doesNotMatch(
          source,
          /proxy_pass\s+http:\/\/localhost/i
        );


        assert.doesNotMatch(
          source,
          /(?:root|alias)\s+\/(?:var\/lib\/facil-digital-plus|var\/backups\/facil-digital-plus)/
        );
      }
    );


    test(
      ".env.example mantém credenciais Mercado Pago vazias",
      () => {
        const source =
          read(
            ".env.example"
          );


        assert.match(
          source,
          /^MERCADO_PAGO_ACCESS_TOKEN=\s*$/m
        );


        assert.match(
          source,
          /^MERCADO_PAGO_WEBHOOK_SECRET=\s*$/m
        );
      }
    );


    test(
      "suite final deve participar do test:all",
      () => {
        const pkg =
          JSON.parse(
            read(
              "package.json"
            )
          );


        assert.equal(
          pkg.scripts[
            "security:audit"
          ],
          "node scripts/production-security-audit.mjs"
        );


        assert.equal(
          pkg.scripts[
            "test:p0-production-security-audit"
          ],
          "NODE_NO_WARNINGS=1 tsx --test --test-isolation=none --no-warnings tests/p0-production-security-audit.test.mjs"
        );


        assert.match(
          pkg.scripts[
            "test:all"
          ],
          /\btest:p0-production-security-audit\b/
        );
      }
    );


    test(
      "README deve ser Markdown válido e documentar o gate de segurança",
      () => {
        const source =
          read(
            "README.md"
          );


        assert.match(
          source,
          /npm run security:audit/
        );


        assert.match(
          source,
          /auditoria final de seguranca/i
        );


        assert.match(
          source,
          /production\.env/
        );


        const trimmed =
          source.trim();


        assert.doesNotMatch(
          trimmed,
          /^```markdown/
        );


        assert.ok(
          !(
            trimmed.startsWith(
              "```"
            ) &&
            trimmed.endsWith(
              "```"
            )
          ),
          "README inteiro não pode estar envolvido por uma code fence"
        );


        assert.match(
          trimmed,
          /^# Facil Digital\+ - Plataforma de Apostilas para Concursos/
        );
      }
    );
  }
);