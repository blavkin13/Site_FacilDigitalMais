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
  PaymentFinancialValidationError,
} from "../lib/payment-financial-validation.ts";

import {
  applyMercadoPagoPaymentState,
  PaymentOrderStateError,
} from "../lib/payment-order-state.ts";


function createContext() {
  const directory =
    mkdtempSync(
      join(
        tmpdir(),
        "facildigital-payment-state-"
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
      "state-test@example.com",
      "test-hash",
      "State Test",
      "user"
    );


  function insertOrder(
    {
      reference,
      status =
        "pending",
      paymentId =
        null,
      total =
        39.9,
    }
  ) {
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
          ?,
          ?,
          ?,
          0,
          ?
        )
      `)
      .run(
        status,
        reference,
        paymentId,
        total,
        total
      );
  }


  function getOrders() {
    return sqlite
      .prepare(`
        SELECT
          id,
          status,
          external_reference,
          mp_payment_id,
          total
        FROM orders
        ORDER BY id
      `)
      .all();
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
    sqlite,
    insertOrder,
    getOrders,
    cleanup,
  };
}


function approvedPayment(
  overrides =
    {}
) {
  return {
    paymentId:
      "PAYMENT-APPROVED",

    externalReference:
      "FD-ORDER-A",

    paymentStatus:
      "approved",

    transactionAmount:
      39.9,

    currencyId:
      "BRL",

    ...overrides,
  };
}


describe(
  "P0.9 - maquina de estados financeira",
  () => {
    test(
      "approved com valor exato e BRL deve aprovar atomicamente",
      () => {
        const context =
          createContext();


        try {
          context.insertOrder(
            {
              reference:
                "FD-ORDER-A",
            }
          );


          const result =
            applyMercadoPagoPaymentState(
              context.db,
              approvedPayment()
            );


          assert.equal(
            result.outcome,
            "approved"
          );


          const order =
            context
              .getOrders()[0];


          assert.equal(
            order.status,
            "approved"
          );


          assert.equal(
            order.mp_payment_id,
            "PAYMENT-APPROVED"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "um centavo a mais deve impedir aprovacao",
      () => {
        const context =
          createContext();


        try {
          context.insertOrder(
            {
              reference:
                "FD-ORDER-A",
            }
          );


          assert.throws(
            () => {
              applyMercadoPagoPaymentState(
                context.db,
                approvedPayment(
                  {
                    transactionAmount:
                      39.91,
                  }
                )
              );
            },
            PaymentFinancialValidationError
          );


          const order =
            context
              .getOrders()[0];


          assert.equal(
            order.status,
            "pending"
          );


          assert.equal(
            order.mp_payment_id,
            null
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "um centavo a menos deve impedir aprovacao",
      () => {
        const context =
          createContext();


        try {
          context.insertOrder(
            {
              reference:
                "FD-ORDER-A",
            }
          );


          assert.throws(
            () => {
              applyMercadoPagoPaymentState(
                context.db,
                approvedPayment(
                  {
                    transactionAmount:
                      39.89,
                  }
                )
              );
            },
            PaymentFinancialValidationError
          );


          assert.equal(
            context
              .getOrders()[0]
              .status,
            "pending"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "moeda diferente de BRL deve impedir aprovacao",
      () => {
        const context =
          createContext();


        try {
          context.insertOrder(
            {
              reference:
                "FD-ORDER-A",
            }
          );


          assert.throws(
            () => {
              applyMercadoPagoPaymentState(
                context.db,
                approvedPayment(
                  {
                    currencyId:
                      "USD",
                  }
                )
              );
            },
            PaymentFinancialValidationError
          );


          assert.equal(
            context
              .getOrders()[0]
              .status,
            "pending"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "authorized pending in_process in_mediation rejected e cancelled nunca concedem entitlement",
      () => {
        for (
          const paymentStatus
          of [
            "authorized",
            "pending",
            "in_process",
            "in_mediation",
            "rejected",
            "cancelled",
          ]
        ) {
          const context =
            createContext();


          try {
            context.insertOrder(
              {
                reference:
                  "FD-ORDER-A",
              }
            );


            const result =
              applyMercadoPagoPaymentState(
                context.db,
                approvedPayment(
                  {
                    paymentId:
                      `PAYMENT-${paymentStatus}`,

                    paymentStatus,
                  }
                )
              );


            assert.equal(
              result.outcome,
              "ignored"
            );


            const order =
              context
                .getOrders()[0];


            assert.equal(
              order.status,
              "pending",
              `${paymentStatus} não pode aprovar`
            );


            assert.equal(
              order.mp_payment_id,
              null,
              `${paymentStatus} não pode reservar payment_id`
            );
          } finally {
            context.cleanup();
          }
        }
      }
    );


    test(
      "tentativa rejected nao pode bloquear tentativa approved posterior",
      () => {
        const context =
          createContext();


        try {
          context.insertOrder(
            {
              reference:
                "FD-ORDER-A",
            }
          );


          const rejected =
            applyMercadoPagoPaymentState(
              context.db,
              approvedPayment(
                {
                  paymentId:
                    "PAYMENT-REJECTED",

                  paymentStatus:
                    "rejected",
                }
              )
            );


          assert.equal(
            rejected.outcome,
            "ignored"
          );


          assert.equal(
            context
              .getOrders()[0]
              .mp_payment_id,
            null
          );


          const approved =
            applyMercadoPagoPaymentState(
              context.db,
              approvedPayment(
                {
                  paymentId:
                    "PAYMENT-SECOND",
                }
              )
            );


          assert.equal(
            approved.outcome,
            "approved"
          );


          const order =
            context
              .getOrders()[0];


          assert.equal(
            order.status,
            "approved"
          );


          assert.equal(
            order.mp_payment_id,
            "PAYMENT-SECOND"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "repeticao do mesmo pagamento approved deve ser idempotente",
      () => {
        const context =
          createContext();


        try {
          context.insertOrder(
            {
              reference:
                "FD-ORDER-A",
            }
          );


          const first =
            applyMercadoPagoPaymentState(
              context.db,
              approvedPayment()
            );


          const second =
            applyMercadoPagoPaymentState(
              context.db,
              approvedPayment()
            );


          assert.equal(
            first.outcome,
            "approved"
          );


          assert.equal(
            second.outcome,
            "already_approved"
          );


          const orders =
            context.getOrders();


          assert.equal(
            orders.length,
            1
          );


          assert.equal(
            orders[0].status,
            "approved"
          );


          assert.equal(
            orders[0]
              .mp_payment_id,
            "PAYMENT-APPROVED"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "outro payment_id nao pode substituir pagamento de pedido aprovado",
      () => {
        const context =
          createContext();


        try {
          context.insertOrder(
            {
              reference:
                "FD-ORDER-A",
            }
          );


          applyMercadoPagoPaymentState(
            context.db,
            approvedPayment()
          );


          assert.throws(
            () => {
              applyMercadoPagoPaymentState(
                context.db,
                approvedPayment(
                  {
                    paymentId:
                      "PAYMENT-CONFLICT",
                  }
                )
              );
            },
            PaymentOrderStateError
          );


          const order =
            context
              .getOrders()[0];


          assert.equal(
            order.status,
            "approved"
          );


          assert.equal(
            order.mp_payment_id,
            "PAYMENT-APPROVED"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "evento antigo nao pode fazer downgrade de pedido approved",
      () => {
        const context =
          createContext();


        try {
          context.insertOrder(
            {
              reference:
                "FD-ORDER-A",
            }
          );


          applyMercadoPagoPaymentState(
            context.db,
            approvedPayment()
          );


          for (
            const oldStatus
            of [
              "pending",
              "authorized",
              "rejected",
              "cancelled",
            ]
          ) {
            const result =
              applyMercadoPagoPaymentState(
                context.db,
                approvedPayment(
                  {
                    paymentStatus:
                      oldStatus,
                  }
                )
              );


            assert.equal(
              result.outcome,
              "ignored"
            );
          }


          const order =
            context
              .getOrders()[0];


          assert.equal(
            order.status,
            "approved"
          );


          assert.equal(
            order.mp_payment_id,
            "PAYMENT-APPROVED"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "payment_id pertencente a outro pedido deve ser conflito",
      () => {
        const context =
          createContext();


        try {
          context.insertOrder(
            {
              reference:
                "FD-ORDER-A",

              status:
                "approved",

              paymentId:
                "PAYMENT-SHARED",
            }
          );


          context.insertOrder(
            {
              reference:
                "FD-ORDER-B",
            }
          );


          assert.throws(
            () => {
              applyMercadoPagoPaymentState(
                context.db,
                approvedPayment(
                  {
                    paymentId:
                      "PAYMENT-SHARED",

                    externalReference:
                      "FD-ORDER-B",
                  }
                )
              );
            },
            PaymentOrderStateError
          );


          const orders =
            context.getOrders();


          assert.equal(
            orders[0]
              .mp_payment_id,
            "PAYMENT-SHARED"
          );


          assert.equal(
            orders[1]
              .mp_payment_id,
            null
          );


          assert.equal(
            orders[1].status,
            "pending"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "refunded e charged_back ainda nao podem alterar entitlement nesta fase",
      () => {
        for (
          const paymentStatus
          of [
            "refunded",
            "charged_back",
          ]
        ) {
          const context =
            createContext();


          try {
            context.insertOrder(
              {
                reference:
                  "FD-ORDER-A",

                status:
                  "approved",

                paymentId:
                  "PAYMENT-APPROVED",
              }
            );


            const result =
              applyMercadoPagoPaymentState(
                context.db,
                approvedPayment(
                  {
                    paymentStatus,
                  }
                )
              );


            assert.equal(
              result.outcome,
              "ignored"
            );


            const order =
              context
                .getOrders()[0];


            assert.equal(
              order.status,
              "approved"
            );


            assert.equal(
              order.mp_payment_id,
              "PAYMENT-APPROVED"
            );
          } finally {
            context.cleanup();
          }
        }
      }
    );
  }
);