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
  applyMercadoPagoPaymentState,
  PaymentOrderStateError,
} from "../lib/payment-order-state.ts";


function createContext(
  initialStatus =
    "approved"
) {
  const directory =
    mkdtempSync(
      join(
        tmpdir(),
        "facildigital-refund-chargeback-"
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


  sqlite
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
      `${Date.now()}@refund.test`,
      "hash",
      "Refund Test",
      "user"
    );


  sqlite
    .prepare(`
      INSERT INTO orders (
        user_id,
        status,
        payment_method,
        external_reference,
        mp_payment_id,
        subtotal,
        discount,
        total
      )
      VALUES (
        1,
        ?,
        'pix',
        'FD-REFUND-ORDER',
        'PAYMENT-CANONICAL',
        39.9,
        0,
        39.9
      )
    `)
    .run(
      initialStatus
    );


  const db =
    drizzle(
      sqlite,
      {
        schema,
      }
    );


  function getOrder() {
    return sqlite
      .prepare(`
        SELECT
          status,
          mp_payment_id,
          total
        FROM orders
        WHERE external_reference =
          'FD-REFUND-ORDER'
      `)
      .get();
  }


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
    db,
    getOrder,
    cleanup,
  };
}


function payment(
  overrides =
    {}
) {
  return {
    paymentId:
      "PAYMENT-CANONICAL",

    externalReference:
      "FD-REFUND-ORDER",

    paymentStatus:
      "approved",

    statusDetail:
      "accredited",

    transactionAmount:
      39.9,

    transactionAmountRefunded:
      0,

    currencyId:
      "BRL",

    ...overrides,
  };
}


describe(
  "P0.13 - refund, chargeback e entitlement",
  () => {
    test(
      "refund integral deve revogar pedido aprovado",
      () => {
        const context =
          createContext();


        try {
          const result =
            applyMercadoPagoPaymentState(
              context.db,
              payment(
                {
                  paymentStatus:
                    "refunded",

                  statusDetail:
                    "refunded",

                  transactionAmountRefunded:
                    39.9,
                }
              )
            );


          assert.equal(
            result.outcome,
            "refunded"
          );


          assert.equal(
            context.getOrder().status,
            "refunded"
          );


          assert.equal(
            context.getOrder().mp_payment_id,
            "PAYMENT-CANONICAL"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "refund parcial deve revogar o pedido inteiro nesta fase",
      () => {
        const context =
          createContext();


        try {
          const result =
            applyMercadoPagoPaymentState(
              context.db,
              payment(
                {
                  transactionAmountRefunded:
                    10,
                }
              )
            );


          assert.equal(
            result.outcome,
            "refunded"
          );


          assert.equal(
            context.getOrder().status,
            "refunded"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "refund repetido deve ser idempotente",
      () => {
        const context =
          createContext();


        try {
          applyMercadoPagoPaymentState(
            context.db,
            payment(
              {
                paymentStatus:
                  "refunded",

                transactionAmountRefunded:
                  39.9,
              }
            )
          );


          const repeated =
            applyMercadoPagoPaymentState(
              context.db,
              payment(
                {
                  paymentStatus:
                    "refunded",

                  transactionAmountRefunded:
                    39.9,
                }
              )
            );


          assert.equal(
            repeated.outcome,
            "already_refunded"
          );


          assert.equal(
            context.getOrder().status,
            "refunded"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "chargeback in_process deve suspender entitlement",
      () => {
        const context =
          createContext();


        try {
          const result =
            applyMercadoPagoPaymentState(
              context.db,
              payment(
                {
                  paymentStatus:
                    "charged_back",

                  statusDetail:
                    "in_process",
                }
              )
            );


          assert.equal(
            result.outcome,
            "charged_back"
          );


          assert.equal(
            context.getOrder().status,
            "charged_back"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "chargeback settled deve permanecer revogado",
      () => {
        const context =
          createContext(
            "charged_back"
          );


        try {
          const result =
            applyMercadoPagoPaymentState(
              context.db,
              payment(
                {
                  paymentStatus:
                    "charged_back",

                  statusDetail:
                    "settled",
                }
              )
            );


          assert.equal(
            result.outcome,
            "already_charged_back"
          );


          assert.equal(
            context.getOrder().status,
            "charged_back"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "chargeback reimbursed deve restaurar pedido suspenso",
      () => {
        const context =
          createContext(
            "charged_back"
          );


        try {
          const result =
            applyMercadoPagoPaymentState(
              context.db,
              payment(
                {
                  paymentStatus:
                    "charged_back",

                  statusDetail:
                    "reimbursed",
                }
              )
            );


          assert.equal(
            result.outcome,
            "restored"
          );


          assert.equal(
            context.getOrder().status,
            "approved"
          );


          assert.equal(
            context.getOrder().mp_payment_id,
            "PAYMENT-CANONICAL"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "status_detail desconhecido de chargeback deve falhar fechado e suspender",
      () => {
        const context =
          createContext();


        try {
          const result =
            applyMercadoPagoPaymentState(
              context.db,
              payment(
                {
                  paymentStatus:
                    "charged_back",

                  statusDetail:
                    "future_unknown_detail",
                }
              )
            );


          assert.equal(
            result.outcome,
            "charged_back"
          );


          assert.equal(
            context.getOrder().status,
            "charged_back"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "payment_id diferente jamais pode revogar pedido",
      () => {
        const context =
          createContext();


        try {
          assert.throws(
            () => {
              applyMercadoPagoPaymentState(
                context.db,
                payment(
                  {
                    paymentId:
                      "PAYMENT-ATTACKER",

                    paymentStatus:
                      "refunded",

                    transactionAmountRefunded:
                      39.9,
                  }
                )
              );
            },
            PaymentOrderStateError
          );


          assert.equal(
            context.getOrder().status,
            "approved"
          );


          assert.equal(
            context.getOrder().mp_payment_id,
            "PAYMENT-CANONICAL"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "approved antigo não pode restaurar chargeback",
      () => {
        const context =
          createContext(
            "charged_back"
          );


        try {
          const result =
            applyMercadoPagoPaymentState(
              context.db,
              payment()
            );


          assert.equal(
            result.outcome,
            "ignored"
          );


          assert.equal(
            context.getOrder().status,
            "charged_back"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "approved antigo não pode restaurar refund",
      () => {
        const context =
          createContext(
            "refunded"
          );


        try {
          const result =
            applyMercadoPagoPaymentState(
              context.db,
              payment()
            );


          assert.equal(
            result.outcome,
            "ignored"
          );


          assert.equal(
            context.getOrder().status,
            "refunded"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "refund é terminal mesmo após resolução reimbursed de chargeback",
      () => {
        const context =
          createContext(
            "refunded"
          );


        try {
          const result =
            applyMercadoPagoPaymentState(
              context.db,
              payment(
                {
                  paymentStatus:
                    "charged_back",

                  statusDetail:
                    "reimbursed",
                }
              )
            );


          assert.equal(
            result.outcome,
            "ignored"
          );


          assert.equal(
            context.getOrder().status,
            "refunded"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "valor reembolsado superior ao pedido deve ser rejeitado sem revogação",
      () => {
        const context =
          createContext();


        try {
          assert.throws(
            () => {
              applyMercadoPagoPaymentState(
                context.db,
                payment(
                  {
                    transactionAmountRefunded:
                      39.91,
                  }
                )
              );
            },
            PaymentOrderStateError
          );


          assert.equal(
            context.getOrder().status,
            "approved"
          );
        } finally {
          context.cleanup();
        }
      }
    );
  }
);