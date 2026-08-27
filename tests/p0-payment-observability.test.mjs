import assert from "node:assert/strict";

import {
  readFileSync,
} from "node:fs";

import {
  join,
} from "node:path";

import {
  describe,
  test,
} from "node:test";

import Database
  from "better-sqlite3";

import {
  buildPaymentWebhookLedgerLogRecord,
  collectPaymentDiagnostics,
  formatPaymentDiagnostics,
  logPaymentWebhookLedgerEvent,
  PaymentDiagnosticsError,
} from "../lib/payment-observability.ts";


function createDiagnosticsDatabase() {
  const sqlite =
    new Database(
      ":memory:"
    );


  sqlite.exec(`
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY,
      status TEXT NOT NULL,
      external_reference TEXT,
      mp_payment_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE payment_webhook_events (
      id INTEGER PRIMARY KEY,
      payment_id TEXT NOT NULL,
      external_reference TEXT,
      mp_status TEXT NOT NULL,
      outcome TEXT NOT NULL,
      error_code TEXT,
      request_id TEXT NOT NULL,
      occurrence_count INTEGER NOT NULL,
      last_received_at TEXT NOT NULL,
      processed_at TEXT NOT NULL
    );
  `);


  return sqlite;
}


function populateDiagnosticsDatabase(
  sqlite
) {
  const insertOrder =
    sqlite.prepare(`
      INSERT INTO orders (
        id,
        status,
        external_reference,
        mp_payment_id,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);


  insertOrder.run(
    1,
    "approved",
    "REF-APPROVED",
    "PAYMENT-APPROVED",
    "2026-08-25T10:00:00.000Z",
    "2026-08-25T10:01:00.000Z"
  );


  insertOrder.run(
    2,
    "approved",
    "REF-APPROVED-NO-PAYMENT",
    null,
    "2026-08-24T10:00:00.000Z",
    "2026-08-24T10:01:00.000Z"
  );


  insertOrder.run(
    3,
    "pending",
    "REF-PENDING-OLD",
    null,
    "2026-08-20T10:00:00.000Z",
    "2026-08-20T10:00:00.000Z"
  );


  insertOrder.run(
    4,
    "refunded",
    "REF-REFUNDED",
    "PAYMENT-REFUNDED",
    "2026-08-20T10:00:00.000Z",
    "2026-08-26T10:00:00.000Z"
  );


  insertOrder.run(
    5,
    "charged_back",
    "REF-CHARGEBACK",
    "PAYMENT-CHARGEBACK",
    "2026-08-20T10:00:00.000Z",
    "2026-08-27T09:00:00.000Z"
  );


  const insertEvent =
    sqlite.prepare(`
      INSERT INTO payment_webhook_events (
        id,
        payment_id,
        external_reference,
        mp_status,
        outcome,
        error_code,
        request_id,
        occurrence_count,
        last_received_at,
        processed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);


  insertEvent.run(
    1,
    "PAYMENT-APPROVED",
    "REF-APPROVED",
    "approved",
    "processed",
    null,
    "REQUEST-001",
    1,
    "2026-08-25T10:02:00.000Z",
    "2026-08-25T10:02:00.000Z"
  );


  insertEvent.run(
    2,
    "PAYMENT-APPROVED",
    "REF-APPROVED",
    "approved",
    "processed",
    null,
    "REQUEST-002",
    3,
    "2026-08-26T10:00:00.000Z",
    "2026-08-25T10:02:00.000Z"
  );


  insertEvent.run(
    3,
    "PAYMENT-NO-ORDER",
    "REF-NO-ORDER",
    "approved",
    "quarantined",
    "MERCADO_PAGO_WEBHOOK_CORRELATION_ERROR",
    "REQUEST-003",
    1,
    "2026-08-27T10:00:00.000Z",
    "2026-08-27T10:00:00.000Z"
  );


  insertEvent.run(
    4,
    "PAYMENT-CONFLICT",
    "REF-APPROVED",
    "approved",
    "quarantined",
    "PAYMENT_ORDER_STATE_ERROR",
    "REQUEST-004",
    1,
    "2026-08-27T11:00:00.000Z",
    "2026-08-27T11:00:00.000Z"
  );
}


describe(
  "P0 - observabilidade financeira",
  () => {
    test(
      "log estruturado contém somente campos operacionais permitidos",
      () => {
        const record =
          buildPaymentWebhookLedgerLogRecord(
            {
              requestId:
                "REQUEST-001",

              paymentId:
                "PAYMENT-001",

              outcome:
                "processed",

              errorCode:
                null,

              duplicate:
                false,

              occurrenceCount:
                1,

              now:
                new Date(
                  "2026-08-27T12:00:00.000Z"
                ),

              /**
               * Campos extras são deliberadamente
               * ignorados pela implementação.
               */
              externalReference:
                "SECRET-REFERENCE",

              accessToken:
                "ACCESS-TOKEN-SECRET",

              webhookSecret:
                "WEBHOOK-SECRET",

              cpf:
                "12345678900",

              email:
                "user@example.com",
            }
          );


        assert.deepEqual(
          Object.keys(
            record
          ),
          [
            "timestamp",
            "event",
            "topic",
            "level",
            "request_id",
            "payment_id",
            "outcome",
            "error_code",
            "duplicate",
            "occurrence_count",
            "http_status",
          ]
        );


        const serialized =
          JSON.stringify(
            record
          );


        for (
          const forbidden
          of [
            "ACCESS-TOKEN-SECRET",
            "WEBHOOK-SECRET",
            "SECRET-REFERENCE",
            "12345678900",
            "user@example.com",
          ]
        ) {
          assert.doesNotMatch(
            serialized,
            new RegExp(
              forbidden
                .replace(
                  /[.*+?^${}()|[\]\\]/g,
                  "\\$&"
                )
            )
          );
        }
      }
    );


    test(
      "quarantine gera nível warn",
      () => {
        const record =
          buildPaymentWebhookLedgerLogRecord(
            {
              requestId:
                "REQUEST-Q",

              paymentId:
                "PAYMENT-Q",

              outcome:
                "quarantined",

              errorCode:
                "PAYMENT_ORDER_STATE_ERROR",

              duplicate:
                false,

              occurrenceCount:
                1,

              now:
                new Date(
                  "2026-08-27T12:00:00.000Z"
                ),
            }
          );


        assert.equal(
          record.level,
          "warn"
        );


        assert.equal(
          record.http_status,
          200
        );
      }
    );


    test(
      "logger nunca interfere no fluxo financeiro",
      () => {
        assert.doesNotThrow(
          () => {
            logPaymentWebhookLedgerEvent(
              {
                requestId:
                  "REQUEST-LOGGER",

                paymentId:
                  "PAYMENT-LOGGER",

                outcome:
                  "processed",

                duplicate:
                  false,

                occurrenceCount:
                  1,
              },
              {
                info() {
                  throw new Error(
                    "logger indisponível"
                  );
                },

                warn() {
                  throw new Error(
                    "logger indisponível"
                  );
                },
              }
            );
          }
        );
      }
    );


    test(
      "diagnóstico detecta anomalias financeiras sem alterar banco",
      () => {
        const sqlite =
          createDiagnosticsDatabase();


        try {
          populateDiagnosticsDatabase(
            sqlite
          );


          const before =
            sqlite
              .prepare(`
                SELECT
                  COUNT(*) AS count
                FROM orders
              `)
              .get()
              .count;


          const report =
            collectPaymentDiagnostics(
              sqlite,
              {
                now:
                  new Date(
                    "2026-08-27T12:00:00.000Z"
                  ),

                pendingOlderThanHours:
                  24,

                recentLimit:
                  20,
              }
            );


          const after =
            sqlite
              .prepare(`
                SELECT
                  COUNT(*) AS count
                FROM orders
              `)
              .get()
              .count;


          assert.equal(
            before,
            after
          );


          assert.equal(
            report.health.status,
            "attention"
          );


          assert.equal(
            report.ledger.totalEvents,
            4
          );


          assert.equal(
            report.ledger.totalDeliveries,
            6
          );


          assert.equal(
            report.ledger.quarantined.length,
            2
          );


          assert.equal(
            report.ledger.duplicates.length,
            1
          );


          assert.equal(
            report.ledger
              .duplicates[0]
              .occurrenceCount,
            3
          );


          assert.equal(
            report.orders
              .approvedWithoutPaymentId
              .length,
            1
          );


          assert.equal(
            report.orders
              .stalePending
              .length,
            1
          );


          assert.equal(
            report.orders
              .revoked
              .length,
            2
          );


          assert.equal(
            report.correlation
              .unmatchedExternalReferences
              .length,
            1
          );


          assert.equal(
            report.correlation
              .paymentIdentityConflicts
              .length,
            1
          );
        } finally {
          sqlite.close();
        }
      }
    );


    test(
      "diagnóstico saudável retorna ok",
      () => {
        const sqlite =
          createDiagnosticsDatabase();


        try {
          sqlite
            .prepare(`
              INSERT INTO orders (
                id,
                status,
                external_reference,
                mp_payment_id,
                created_at,
                updated_at
              )
              VALUES (?, ?, ?, ?, ?, ?)
            `)
            .run(
              1,
              "approved",
              "REF-OK",
              "PAYMENT-OK",
              "2026-08-27T10:00:00.000Z",
              "2026-08-27T10:01:00.000Z"
            );


          sqlite
            .prepare(`
              INSERT INTO payment_webhook_events (
                id,
                payment_id,
                external_reference,
                mp_status,
                outcome,
                error_code,
                request_id,
                occurrence_count,
                last_received_at,
                processed_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .run(
              1,
              "PAYMENT-OK",
              "REF-OK",
              "approved",
              "processed",
              null,
              "REQUEST-OK",
              1,
              "2026-08-27T10:02:00.000Z",
              "2026-08-27T10:02:00.000Z"
            );


          const report =
            collectPaymentDiagnostics(
              sqlite,
              {
                now:
                  new Date(
                    "2026-08-27T12:00:00.000Z"
                  ),
              }
            );


          assert.equal(
            report.health.status,
            "ok"
          );


          assert.deepEqual(
            report.health.reasons,
            []
          );
        } finally {
          sqlite.close();
        }
      }
    );


    test(
      "schema ausente falha fechado",
      () => {
        const sqlite =
          new Database(
            ":memory:"
          );


        try {
          assert.throws(
            () =>
              collectPaymentDiagnostics(
                sqlite
              ),
            PaymentDiagnosticsError
          );
        } finally {
          sqlite.close();
        }
      }
    );


    test(
      "relatório humano não lê secrets do ambiente",
      () => {
        const sqlite =
          createDiagnosticsDatabase();


        const previousAccessToken =
          process.env
            .MERCADO_PAGO_ACCESS_TOKEN;


        const previousWebhookSecret =
          process.env
            .MERCADO_PAGO_WEBHOOK_SECRET;


        process.env
          .MERCADO_PAGO_ACCESS_TOKEN =
            "SUPER-SECRET-ACCESS-TOKEN";


        process.env
          .MERCADO_PAGO_WEBHOOK_SECRET =
            "SUPER-SECRET-WEBHOOK";


        try {
          const report =
            collectPaymentDiagnostics(
              sqlite,
              {
                now:
                  new Date(
                    "2026-08-27T12:00:00.000Z"
                  ),
              }
            );


          const output =
            formatPaymentDiagnostics(
              report
            );


          assert.doesNotMatch(
            output,
            /SUPER-SECRET-ACCESS-TOKEN/
          );


          assert.doesNotMatch(
            output,
            /SUPER-SECRET-WEBHOOK/
          );
        } finally {
          if (
            previousAccessToken ===
            undefined
          ) {
            delete process.env
              .MERCADO_PAGO_ACCESS_TOKEN;
          } else {
            process.env
              .MERCADO_PAGO_ACCESS_TOKEN =
                previousAccessToken;
          }


          if (
            previousWebhookSecret ===
            undefined
          ) {
            delete process.env
              .MERCADO_PAGO_WEBHOOK_SECRET;
          } else {
            process.env
              .MERCADO_PAGO_WEBHOOK_SECRET =
                previousWebhookSecret;
          }


          sqlite.close();
        }
      }
    );


    test(
      "CLI é estritamente read-only e não executa migrations",
      () => {
        const source =
          readFileSync(
            join(
              process.cwd(),
              "scripts",
              "payment-diagnostics.ts"
            ),
            "utf8"
          );


        assert.match(
          source,
          /readonly\s*:\s*true/
        );


        assert.match(
          source,
          /fileMustExist\s*:\s*true/
        );


        assert.match(
          source,
          /query_only = ON/
        );


        assert.doesNotMatch(
          source,
          /\binitDatabase\b/
        );


        assert.doesNotMatch(
          source,
          /\brunMigrations\b/
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
      "módulo de observabilidade não referencia credenciais nem PII no código executável",
      () => {
        const source =
          readFileSync(
            join(
              process.cwd(),
              "lib",
              "payment-observability.ts"
            ),
            "utf8"
          );


        /**
         * Comentários de segurança podem e devem
         * mencionar os nomes dos dados proibidos.
         *
         * O contrato relevante é que o código
         * EXECUTÁVEL não acesse nem serialize essas
         * informações.
         */
        const executableSource =
          source
            .replace(
              /\/\*[\s\S]*?\*\//g,
              ""
            )
            .replace(
              /^\s*\/\/.*$/gm,
              ""
            );


        for (
          const forbidden
          of [
            /process\.env/,
            /MERCADO_PAGO_ACCESS_TOKEN/,
            /MERCADO_PAGO_WEBHOOK_SECRET/,
            /x-signature/i,
            /transaction_amount/i,
            /\bcpf\b/i,
            /\bemail\b/i,
          ]
        ) {
          assert.doesNotMatch(
            executableSource,
            forbidden
          );
        }


        /**
         * Além da inspeção estrutural acima, o teste
         * anterior desta suíte valida o objeto real
         * serializado e garante que valores secretos
         * ou PII fornecidos como propriedades extras
         * não aparecem no log.
         */
        assert.match(
          executableSource,
          /buildPaymentWebhookLedgerLogRecord/
        );


        assert.match(
          executableSource,
          /JSON\.stringify/
        );
      }
    );


    test(
      "webhook integra logging estruturado somente após ledger",
      () => {
        const source =
          readFileSync(
            join(
              process.cwd(),
              "lib",
              "mercadopago-webhook-handler.ts"
            ),
            "utf8"
          );


        assert.match(
          source,
          /logPaymentWebhookLedgerEvent/
        );


        const recordIndex =
          source.indexOf(
            ".recordLedger("
          );


        const logIndex =
          source.indexOf(
            "logPaymentWebhookLedgerEvent("
          );


        assert.ok(
          recordIndex >=
            0
        );


        assert.ok(
          logIndex >
            recordIndex,
          "log estruturado só pode ocorrer após persistência do ledger"
        );


        assert.doesNotMatch(
          source,
          /Falha inesperada ao registrar ledger do webhook:",\s*error/
        );
      }
    );


    test(
      "README documenta diagnóstico financeiro read-only",
      () => {
        const source =
          readFileSync(
            join(
              process.cwd(),
              "README.md"
            ),
            "utf8"
          );


        assert.match(
          source,
          /payment:diagnostics/
        );


        assert.match(
          source,
          /somente leitura/i
        );


        assert.match(
          source,
          /--pending-hours/
        );


        assert.match(
          source,
          /--json/
        );
      }
    );


    test(
      "suite e CLI participam dos scripts oficiais",
      () => {
        const pkg =
          JSON.parse(
            readFileSync(
              join(
                process.cwd(),
                "package.json"
              ),
              "utf8"
            )
          );


        assert.equal(
          pkg.scripts[
            "payment:diagnostics"
          ],
          "NODE_NO_WARNINGS=1 tsx scripts/payment-diagnostics.ts"
        );


        assert.equal(
          pkg.scripts[
            "test:p0-payment-observability"
          ],
          "NODE_NO_WARNINGS=1 tsx --test --test-isolation=none --no-warnings tests/p0-payment-observability.test.mjs"
        );


        assert.match(
          pkg.scripts[
            "test:all"
          ],
          /\btest:p0-payment-observability\b/
        );
      }
    );
  }
);