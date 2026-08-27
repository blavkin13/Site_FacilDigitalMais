import assert from "node:assert/strict";

import {
  mkdtempSync,
  rmSync,
} from "node:fs";

import {
  tmpdir,
} from "node:os";

import {
  join,
} from "node:path";

import {
  describe,
  test,
} from "node:test";

import Database from "better-sqlite3";

import {
  drizzle,
} from "drizzle-orm/better-sqlite3";

import * as schema
  from "../db/schema.ts";

import {
  runMigrations,
} from "../db/migrations.ts";

import {
  buildPaymentWebhookEventFingerprint,
  PaymentWebhookLedgerError,
  recordPaymentWebhookEvent,
} from "../lib/payment-webhook-ledger.ts";


function createContext() {
  const directory =
    mkdtempSync(
      join(
        tmpdir(),
        "facildigital-webhook-ledger-runtime-"
      )
    );


  const sqlite =
    new Database(
      join(
        directory,
        "test.db"
      )
    );


  sqlite.pragma(
    "foreign_keys = ON"
  );


  runMigrations(
    sqlite
  );


  const db =
    drizzle(
      sqlite,
      {
        schema,
      }
    );


  function cleanup() {
    sqlite.close();


    rmSync(
      directory,
      {
        recursive:
          true,

        force:
          true,
      }
    );
  }


  return {
    sqlite,
    db,
    cleanup,
  };
}


function baseEvent(
  overrides =
    {}
) {
  return {
    paymentId:
      "PAYMENT-123",

    externalReference:
      "FD-ORDER-123",

    mpStatus:
      "approved",

    mpStatusDetail:
      "accredited",

    transactionAmount:
      39.9,

    transactionAmountRefunded:
      0,

    currencyId:
      "BRL",

    outcome:
      "processed",

    errorCode:
      null,

    requestId:
      "REQUEST-001",

    ...overrides,
  };
}


describe(
  "P0.12-B/C - ledger financeiro do webhook",
  () => {
    test(
      "fingerprint deve ser determinístico e ignorar request_id",
      () => {
        const first =
          buildPaymentWebhookEventFingerprint(
            baseEvent()
          );


        const second =
          buildPaymentWebhookEventFingerprint(
            baseEvent(
              {
                requestId:
                  "REQUEST-DIFERENTE",

                currencyId:
                  "brl",

                mpStatusDetail:
                  "  ACCREDITED  ",

                externalReference:
                  "  FD-ORDER-123  ",
              }
            )
          );


        assert.equal(
          first,
          second
        );


        assert.match(
          first,
          /^[a-f0-9]{64}$/
        );
      }
    );


    test(
      "mudança de status deve gerar outro fingerprint",
      () => {
        const approved =
          buildPaymentWebhookEventFingerprint(
            baseEvent()
          );


        const chargedBack =
          buildPaymentWebhookEventFingerprint(
            baseEvent(
              {
                mpStatus:
                  "charged_back",

                mpStatusDetail:
                  "in_process",
              }
            )
          );


        assert.notEqual(
          approved,
          chargedBack
        );
      }
    );


    test(
      "mudança de um centavo deve gerar outro fingerprint",
      () => {
        const original =
          buildPaymentWebhookEventFingerprint(
            baseEvent()
          );


        const changed =
          buildPaymentWebhookEventFingerprint(
            baseEvent(
              {
                transactionAmount:
                  39.91,
              }
            )
          );


        assert.notEqual(
          original,
          changed
        );
      }
    );


    test(
      "mudança no total reembolsado deve gerar nova fotografia financeira",
      () => {
        const withoutRefund =
          buildPaymentWebhookEventFingerprint(
            baseEvent()
          );


        const partialRefund =
          buildPaymentWebhookEventFingerprint(
            baseEvent(
              {
                transactionAmountRefunded:
                  10,
              }
            )
          );


        assert.notEqual(
          withoutRefund,
          partialRefund
        );
      }
    );


    test(
      "primeira ocorrência deve criar uma única linha",
      () => {
        const context =
          createContext();


        try {
          const result =
            recordPaymentWebhookEvent(
              context.db,
              baseEvent()
            );


          assert.equal(
            result.occurrenceCount,
            1
          );


          assert.equal(
            result.duplicate,
            false
          );


          assert.equal(
            result.outcome,
            "processed"
          );


          const rows =
            context.sqlite
              .prepare(`
                SELECT *
                FROM payment_webhook_events
              `)
              .all();


          assert.equal(
            rows.length,
            1
          );


          assert.equal(
            rows[0].payment_id,
            "PAYMENT-123"
          );


          assert.equal(
            rows[0].external_reference,
            "FD-ORDER-123"
          );


          assert.equal(
            rows[0].mp_status,
            "approved"
          );


          assert.equal(
            rows[0].mp_status_detail,
            "accredited"
          );


          assert.equal(
            rows[0].transaction_amount,
            39.9
          );


          assert.equal(
            rows[0].currency_id,
            "BRL"
          );


          assert.equal(
            rows[0].outcome,
            "processed"
          );


          assert.equal(
            rows[0].error_code,
            null
          );


          assert.equal(
            rows[0].request_id,
            "REQUEST-001"
          );


          assert.equal(
            rows[0].occurrence_count,
            1
          );


          assert.equal(
            typeof rows[0].processed_at,
            "string"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "reentrega idêntica deve incrementar occurrence_count sem duplicar linha",
      () => {
        const context =
          createContext();


        try {
          const first =
            recordPaymentWebhookEvent(
              context.db,
              baseEvent()
            );


          const second =
            recordPaymentWebhookEvent(
              context.db,
              baseEvent(
                {
                  requestId:
                    "REQUEST-002",
                }
              )
            );


          assert.equal(
            first.eventFingerprint,
            second.eventFingerprint
          );


          assert.equal(
            second.occurrenceCount,
            2
          );


          assert.equal(
            second.duplicate,
            true
          );


          const rows =
            context.sqlite
              .prepare(`
                SELECT *
                FROM payment_webhook_events
              `)
              .all();


          assert.equal(
            rows.length,
            1
          );


          assert.equal(
            rows[0].occurrence_count,
            2
          );


          assert.equal(
            rows[0].request_id,
            "REQUEST-002"
          );


          /**
           * O instante inicial não pode ser perdido.
           */
          assert.equal(
            typeof rows[0].first_received_at,
            "string"
          );


          assert.equal(
            typeof rows[0].last_received_at,
            "string"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "mesmo payment_id em novo estado deve criar nova fotografia financeira",
      () => {
        const context =
          createContext();


        try {
          const approved =
            recordPaymentWebhookEvent(
              context.db,
              baseEvent()
            );


          const chargedBack =
            recordPaymentWebhookEvent(
              context.db,
              baseEvent(
                {
                  mpStatus:
                    "charged_back",

                  mpStatusDetail:
                    "in_process",

                  outcome:
                    "processed",

                  requestId:
                    "REQUEST-CHARGEBACK",
                }
              )
            );


          assert.notEqual(
            approved.eventFingerprint,
            chargedBack.eventFingerprint
          );


          const rows =
            context.sqlite
              .prepare(`
                SELECT
                  mp_status,
                  mp_status_detail,
                  occurrence_count
                FROM payment_webhook_events
                ORDER BY id
              `)
              .all();


          assert.equal(
            rows.length,
            2
          );


          assert.deepEqual(
            rows,
            [
              {
                mp_status:
                  "approved",

                mp_status_detail:
                  "accredited",

                occurrence_count:
                  1,
              },
              {
                mp_status:
                  "charged_back",

                mp_status_detail:
                  "in_process",

                occurrence_count:
                  1,
              },
            ]
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "evento quarantined deve exigir error_code",
      () => {
        const context =
          createContext();


        try {
          assert.throws(
            () => {
              recordPaymentWebhookEvent(
                context.db,
                baseEvent(
                  {
                    outcome:
                      "quarantined",

                    errorCode:
                      null,
                  }
                )
              );
            },
            PaymentWebhookLedgerError
          );


          const total =
            context.sqlite
              .prepare(`
                SELECT COUNT(*) AS total
                FROM payment_webhook_events
              `)
              .get()
              .total;


          assert.equal(
            total,
            0
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "evento quarantined deve persistir código estável do incidente",
      () => {
        const context =
          createContext();


        try {
          const result =
            recordPaymentWebhookEvent(
              context.db,
              baseEvent(
                {
                  outcome:
                    "quarantined",

                  errorCode:
                    "PAYMENT_AMOUNT_MISMATCH",
                }
              )
            );


          assert.equal(
            result.outcome,
            "quarantined"
          );


          const row =
            context.sqlite
              .prepare(`
                SELECT
                  outcome,
                  error_code
                FROM payment_webhook_events
              `)
              .get();


          assert.deepEqual(
            row,
            {
              outcome:
                "quarantined",

              error_code:
                "PAYMENT_AMOUNT_MISMATCH",
            }
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "evento processed ou ignored não pode carregar error_code",
      () => {
        const context =
          createContext();


        try {
          for (
            const outcome
            of [
              "processed",
              "ignored",
            ]
          ) {
            assert.throws(
              () => {
                recordPaymentWebhookEvent(
                  context.db,
                  baseEvent(
                    {
                      outcome,

                      errorCode:
                        "NAO-DEVERIA-EXISTIR",
                    }
                  )
                );
              },
              PaymentWebhookLedgerError
            );
          }


          assert.equal(
            context.sqlite
              .prepare(`
                SELECT COUNT(*) AS total
                FROM payment_webhook_events
              `)
              .get()
              .total,
            0
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "ledger não pode modificar orders nem conceder entitlement",
      () => {
        const context =
          createContext();


        try {
          context.sqlite
            .prepare(`
              INSERT INTO users (
                email,
                password_hash,
                name,
                role
              )
              VALUES (?, ?, ?, ?)
            `)
            .run(
              "ledger-order@example.com",
              "hash",
              "Ledger Order",
              "user"
            );


          context.sqlite
            .prepare(`
              INSERT INTO orders (
                user_id,
                status,
                payment_method,
                external_reference,
                subtotal,
                discount,
                total
              )
              VALUES (
                1,
                'pending',
                'pix',
                'FD-ORDER-123',
                39.9,
                0,
                39.9
              )
            `)
            .run();


          const before =
            context.sqlite
              .prepare(`
                SELECT
                  status,
                  mp_payment_id,
                  total
                FROM orders
                WHERE external_reference =
                  'FD-ORDER-123'
              `)
              .get();


          recordPaymentWebhookEvent(
            context.db,
            baseEvent()
          );


          const after =
            context.sqlite
              .prepare(`
                SELECT
                  status,
                  mp_payment_id,
                  total
                FROM orders
                WHERE external_reference =
                  'FD-ORDER-123'
              `)
              .get();


          assert.deepEqual(
            after,
            before
          );


          assert.equal(
            after.status,
            "pending"
          );


          assert.equal(
            after.mp_payment_id,
            null
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "falha de persistência deve subir como PaymentWebhookLedgerError",
      () => {
        const context =
          createContext();


        try {
          context.sqlite.exec(`
            CREATE TRIGGER
              force_payment_webhook_ledger_failure
            BEFORE INSERT
            ON payment_webhook_events
            BEGIN
              SELECT RAISE(
                ABORT,
                'forced ledger failure'
              );
            END;
          `);


          assert.throws(
            () => {
              recordPaymentWebhookEvent(
                context.db,
                baseEvent()
              );
            },
            PaymentWebhookLedgerError
          );


          assert.equal(
            context.sqlite
              .prepare(`
                SELECT COUNT(*) AS total
                FROM payment_webhook_events
              `)
              .get()
              .total,
            0
          );
        } finally {
          context.cleanup();
        }
      }
    );
  }
);