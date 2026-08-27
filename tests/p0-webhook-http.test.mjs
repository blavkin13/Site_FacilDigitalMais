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

import {
  NextRequest,
} from "next/server";

import * as schema
  from "../db/schema.ts";

import {
  runMigrations,
} from "../db/migrations.ts";

import {
  MercadoPagoProviderError,
} from "../lib/mercadopago.ts";

import {
  createMercadoPagoWebhookPostHandler,
} from "../lib/mercadopago-webhook-handler.ts";

import {
  PaymentConfigurationError,
} from "../lib/payment-config.ts";


function createContext() {
  const directory =
    mkdtempSync(
      join(
        tmpdir(),
        "facildigital-webhook-http-"
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
      "webhook-http@example.com",
      "test-hash",
      "Webhook HTTP",
      "user"
    );


  function insertOrder(
    {
      reference =
        "FD-ORDER-A",

      status =
        "pending",

      paymentId =
        null,

      total =
        39.9,
    } = {}
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


  function getLedgerEvents() {
    return sqlite
      .prepare(`
        SELECT
          id,
          event_fingerprint,
          payment_id,
          external_reference,
          mp_status,
          mp_status_detail,
          transaction_amount,
          transaction_amount_refunded,
          currency_id,
          outcome,
          error_code,
          request_id,
          occurrence_count
        FROM payment_webhook_events
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
    getLedgerEvents,
    cleanup,
  };
}


function createWebhookRequest(
  {
    dataId =
      "PAYMENT-123",

    type =
      "payment",

    bodyType =
      type,

    bodyDataId =
      dataId,

    rawBody,
  } = {}
) {
  const url =
    new URL(
      "https://facildigitalmais.com/api/webhooks/mercadopago"
    );


  url.searchParams.set(
    "data.id",
    dataId
  );


  url.searchParams.set(
    "type",
    type
  );


  const body =
    rawBody ??
    JSON.stringify(
      {
        type:
          bodyType,

        action:
          `${bodyType}.updated`,

        data: {
          id:
            bodyDataId,
        },
      }
    );


  return new NextRequest(
    url,
    {
      method:
        "POST",

      headers: {
        "content-type":
          "application/json",

        "x-signature":
          "ts=1,v1=test",

        "x-request-id":
          "request-test",
      },

      body,
    }
  );
}


function createPayment(
  overrides =
    {}
) {
  return {
    id:
      "PAYMENT-123",

    status:
      "approved",

    status_detail:
      "accredited",

    external_reference:
      "FD-ORDER-A",

    transaction_amount:
      39.9,

    transaction_amount_refunded:
      0,

    currency_id:
      "BRL",

    ...overrides,
  };
}


function commonDependencies(
  context,
  overrides =
    {}
) {
  return {
    initializeDatabase:
      async () => {},

    getDatabase:
      () =>
        context.db,

    validateSignature:
      () =>
        true,

    getPayment:
      async (
        paymentId
      ) =>
        createPayment(
          {
            id:
              paymentId,
          }
        ),

    ...overrides,
  };
}


describe(
  "P0.9 - webhook HTTP fail-closed",
  () => {
    test(
      "assinatura inválida deve retornar 401 antes do banco e provedor",
      async () => {
        const context =
          createContext();


        let databaseCalls =
          0;

        let providerCalls =
          0;


        try {
          const handler =
            createMercadoPagoWebhookPostHandler(
              commonDependencies(
                context,
                {
                  initializeDatabase:
                    async () => {
                      databaseCalls +=
                        1;
                    },

                  validateSignature:
                    () =>
                      false,

                  getPayment:
                    async () => {
                      providerCalls +=
                        1;


                      return createPayment();
                    },
                }
              )
            );


          const response =
            await handler(
              createWebhookRequest()
            );


          const payload =
            await response.json();


          assert.equal(
            response.status,
            401
          );


          assert.equal(
            payload.error,
            "Invalid signature"
          );


          assert.equal(
            databaseCalls,
            0
          );


          assert.equal(
            providerCalls,
            0
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "secret/configuracao inválida deve retornar 503",
      async () => {
        const context =
          createContext();


        let providerCalls =
          0;


        try {
          const handler =
            createMercadoPagoWebhookPostHandler(
              commonDependencies(
                context,
                {
                  validateSignature:
                    () => {
                      throw new PaymentConfigurationError(
                        "Webhook sem secret."
                      );
                    },

                  getPayment:
                    async () => {
                      providerCalls +=
                        1;


                      return createPayment();
                    },
                }
              )
            );


          const response =
            await handler(
              createWebhookRequest()
            );


          const payload =
            await response.json();


          assert.equal(
            response.status,
            503
          );


          assert.equal(
            payload.error,
            "Webhook temporarily unavailable"
          );


          assert.equal(
            providerCalls,
            0
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "payload malformado autenticado deve retornar 400",
      async () => {
        const context =
          createContext();


        let providerCalls =
          0;


        try {
          const handler =
            createMercadoPagoWebhookPostHandler(
              commonDependencies(
                context,
                {
                  getPayment:
                    async () => {
                      providerCalls +=
                        1;


                      return createPayment();
                    },
                }
              )
            );


          const response =
            await handler(
              createWebhookRequest(
                {
                  rawBody:
                    "{invalid-json",
                }
              )
            );


          const payload =
            await response.json();


          assert.equal(
            response.status,
            400
          );


          assert.equal(
            payload.error,
            "Invalid webhook payload"
          );


          assert.equal(
            providerCalls,
            0
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "evento autenticado não-payment deve retornar 200 e ser ignorado",
      async () => {
        const context =
          createContext();


        let providerCalls =
          0;


        try {
          const handler =
            createMercadoPagoWebhookPostHandler(
              commonDependencies(
                context,
                {
                  getPayment:
                    async () => {
                      providerCalls +=
                        1;


                      return createPayment();
                    },
                }
              )
            );


          const response =
            await handler(
              createWebhookRequest(
                {
                  type:
                    "merchant_order",

                  bodyType:
                    "merchant_order",
                }
              )
            );


          const payload =
            await response.json();


          assert.equal(
            response.status,
            200
          );


          assert.equal(
            payload.received,
            true
          );


          assert.equal(
            payload.ignored,
            true
          );


          assert.equal(
            providerCalls,
            0
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "falha transitória do Mercado Pago deve retornar 502 sem alterar pedido",
      async () => {
        const context =
          createContext();


        try {
          context.insertOrder();


          const handler =
            createMercadoPagoWebhookPostHandler(
              commonDependencies(
                context,
                {
                  getPayment:
                    async () => {
                      throw new MercadoPagoProviderError(
                        "Falha simulada."
                      );
                    },
                }
              )
            );


          const response =
            await handler(
              createWebhookRequest()
            );


          const payload =
            await response.json();


          assert.equal(
            response.status,
            502
          );


          assert.equal(
            payload.error,
            "Payment provider unavailable"
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
      "external_reference desconhecida deve ser colocada em quarentena e retornar 200",
      async () => {
        const context =
          createContext();


        try {
          context.insertOrder(
            {
              reference:
                "FD-ORDER-A",
            }
          );


          context.insertOrder(
            {
              reference:
                "FD-ORDER-B",
            }
          );


          const handler =
            createMercadoPagoWebhookPostHandler(
              commonDependencies(
                context,
                {
                  getPayment:
                    async (
                      paymentId
                    ) =>
                      createPayment(
                        {
                          id:
                            paymentId,

                          external_reference:
                            "FD-INEXISTENTE",
                        }
                      ),
                }
              )
            );


          const response =
            await handler(
              createWebhookRequest()
            );


          const payload =
            await response.json();


          assert.equal(
            response.status,
            200
          );


          assert.equal(
            payload.received,
            true
          );


          assert.equal(
            payload.quarantined,
            true
          );


          const orders =
            context.getOrders();


          assert.equal(
            orders[0].status,
            "pending"
          );


          assert.equal(
            orders[1].status,
            "pending"
          );


          assert.equal(
            orders[0]
              .mp_payment_id,
            null
          );


          assert.equal(
            orders[1]
              .mp_payment_id,
            null
          );


          const events =
            context
              .getLedgerEvents();


          assert.equal(
            events.length,
            1
          );


          assert.equal(
            events[0].outcome,
            "quarantined"
          );


          assert.equal(
            events[0].error_code,
            "MERCADO_PAGO_WEBHOOK_CORRELATION_ERROR"
          );


          assert.equal(
            events[0].external_reference,
            "FD-INEXISTENTE"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "divergência financeira deve ser quarantined e reentrega deve ser idempotente",
      async () => {
        const context =
          createContext();


        try {
          context.insertOrder();


          const handler =
            createMercadoPagoWebhookPostHandler(
              commonDependencies(
                context,
                {
                  getPayment:
                    async (
                      paymentId
                    ) =>
                      createPayment(
                        {
                          id:
                            paymentId,

                          transaction_amount:
                            39.91,
                        }
                      ),
                }
              )
            );


          const first =
            await handler(
              createWebhookRequest()
            );


          const firstPayload =
            await first.json();


          assert.equal(
            first.status,
            200
          );


          assert.equal(
            firstPayload.received,
            true
          );


          assert.equal(
            firstPayload.quarantined,
            true
          );


          const second =
            await handler(
              createWebhookRequest()
            );


          const secondPayload =
            await second.json();


          assert.equal(
            second.status,
            200
          );


          assert.equal(
            secondPayload.quarantined,
            true
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


          const events =
            context
              .getLedgerEvents();


          assert.equal(
            events.length,
            1
          );


          assert.equal(
            events[0].outcome,
            "quarantined"
          );


          assert.equal(
            events[0].error_code,
            "PAYMENT_FINANCIAL_VALIDATION_ERROR"
          );


          assert.equal(
            events[0].occurrence_count,
            2
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "pending válido deve retornar 200 sem reservar payment_id",
      async () => {
        const context =
          createContext();


        try {
          context.insertOrder();


          const handler =
            createMercadoPagoWebhookPostHandler(
              commonDependencies(
                context,
                {
                  getPayment:
                    async (
                      paymentId
                    ) =>
                      createPayment(
                        {
                          id:
                            paymentId,

                          status:
                            "pending",

                          status_detail:
                            "pending_waiting_payment",
                        }
                      ),
                }
              )
            );


          const response =
            await handler(
              createWebhookRequest()
            );


          const payload =
            await response.json();


          assert.equal(
            response.status,
            200
          );


          assert.equal(
            payload.received,
            true
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


          const events =
            context
              .getLedgerEvents();


          assert.equal(
            events.length,
            1
          );


          assert.equal(
            events[0].outcome,
            "ignored"
          );


          assert.equal(
            events[0].mp_status,
            "pending"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "approved válido deve retornar 200 e aprovar pedido com payment_id",
      async () => {
        const context =
          createContext();


        try {
          context.insertOrder();


          const handler =
            createMercadoPagoWebhookPostHandler(
              commonDependencies(
                context
              )
            );


          const response =
            await handler(
              createWebhookRequest()
            );


          const payload =
            await response.json();


          assert.equal(
            response.status,
            200
          );


          assert.equal(
            payload.received,
            true
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
            "PAYMENT-123"
          );


          const events =
            context
              .getLedgerEvents();


          assert.equal(
            events.length,
            1
          );


          assert.equal(
            events[0].outcome,
            "processed"
          );


          assert.equal(
            events[0].occurrence_count,
            1
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "repetição do mesmo approved deve continuar retornando 200",
      async () => {
        const context =
          createContext();


        try {
          context.insertOrder();


          const handler =
            createMercadoPagoWebhookPostHandler(
              commonDependencies(
                context
              )
            );


          const first =
            await handler(
              createWebhookRequest()
            );


          const second =
            await handler(
              createWebhookRequest()
            );


          assert.equal(
            first.status,
            200
          );


          assert.equal(
            second.status,
            200
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
            "PAYMENT-123"
          );


          const events =
            context
              .getLedgerEvents();


          assert.equal(
            events.length,
            1
          );


          assert.equal(
            events[0].outcome,
            "processed"
          );


          assert.equal(
            events[0].occurrence_count,
            2
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "approved seguido de refunded deve revogar pedido e registrar ledger idempotente",
      async () => {
        const context =
          createContext();


        try {
          context.insertOrder();


          let paymentSnapshot =
            createPayment();


          const handler =
            createMercadoPagoWebhookPostHandler(
              commonDependencies(
                context,
                {
                  getPayment:
                    async (
                      paymentId
                    ) =>
                      createPayment(
                        {
                          ...paymentSnapshot,

                          id:
                            paymentId,
                        }
                      ),
                }
              )
            );


          /**
           * 1. Pagamento aprovado.
           */
          const approvedResponse =
            await handler(
              createWebhookRequest()
            );


          assert.equal(
            approvedResponse.status,
            200
          );


          let order =
            context
              .getOrders()[0];


          assert.equal(
            order.status,
            "approved"
          );


          assert.equal(
            order.mp_payment_id,
            "PAYMENT-123"
          );


          /**
           * 2. Mercado Pago informa refund total
           * do mesmo pagamento canônico.
           */
          paymentSnapshot =
            createPayment(
              {
                status:
                  "refunded",

                status_detail:
                  "refunded",

                transaction_amount_refunded:
                  39.9,
              }
            );


          const refundedResponse =
            await handler(
              createWebhookRequest()
            );


          assert.equal(
            refundedResponse.status,
            200
          );


          order =
            context
              .getOrders()[0];


          assert.equal(
            order.status,
            "refunded"
          );


          /**
           * Refund não pode trocar a identidade
           * financeira original do pedido.
           */
          assert.equal(
            order.mp_payment_id,
            "PAYMENT-123"
          );


          let events =
            context
              .getLedgerEvents();


          assert.equal(
            events.length,
            2
          );


          assert.equal(
            events[0].mp_status,
            "approved"
          );


          assert.equal(
            events[0]
              .transaction_amount_refunded,
            0
          );


          assert.equal(
            events[0].outcome,
            "processed"
          );


          assert.equal(
            events[1].mp_status,
            "refunded"
          );


          assert.equal(
            events[1].mp_status_detail,
            "refunded"
          );


          assert.equal(
            events[1]
              .transaction_amount_refunded,
            39.9
          );


          assert.equal(
            events[1].outcome,
            "processed"
          );


          assert.equal(
            events[1].occurrence_count,
            1
          );


          /**
           * 3. Reentrega exata do mesmo refund.
           *
           * Não cria outra fotografia financeira
           * e não altera novamente o estado.
           */
          const repeatedRefund =
            await handler(
              createWebhookRequest()
            );


          assert.equal(
            repeatedRefund.status,
            200
          );


          order =
            context
              .getOrders()[0];


          assert.equal(
            order.status,
            "refunded"
          );


          assert.equal(
            order.mp_payment_id,
            "PAYMENT-123"
          );


          events =
            context
              .getLedgerEvents();


          assert.equal(
            events.length,
            2
          );


          assert.equal(
            events[1].mp_status,
            "refunded"
          );


          assert.equal(
            events[1].outcome,
            "processed"
          );


          assert.equal(
            events[1].occurrence_count,
            2
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "chargeback deve suspender e reimbursed deve restaurar o mesmo pagamento canônico",
      async () => {
        const context =
          createContext();


        try {
          context.insertOrder();


          let paymentSnapshot =
            createPayment();


          const handler =
            createMercadoPagoWebhookPostHandler(
              commonDependencies(
                context,
                {
                  getPayment:
                    async (
                      paymentId
                    ) =>
                      createPayment(
                        {
                          ...paymentSnapshot,

                          id:
                            paymentId,
                        }
                      ),
                }
              )
            );


          /**
           * 1. Estado financeiro inicial aprovado.
           */
          const approvedResponse =
            await handler(
              createWebhookRequest()
            );


          assert.equal(
            approvedResponse.status,
            200
          );


          let order =
            context
              .getOrders()[0];


          assert.equal(
            order.status,
            "approved"
          );


          assert.equal(
            order.mp_payment_id,
            "PAYMENT-123"
          );


          /**
           * 2. Chargeback iniciado.
           *
           * O acesso deve ser suspenso por meio
           * do status interno charged_back.
           */
          paymentSnapshot =
            createPayment(
              {
                status:
                  "charged_back",

                status_detail:
                  "in_process",
              }
            );


          const chargebackResponse =
            await handler(
              createWebhookRequest()
            );


          assert.equal(
            chargebackResponse.status,
            200
          );


          order =
            context
              .getOrders()[0];


          assert.equal(
            order.status,
            "charged_back"
          );


          assert.equal(
            order.mp_payment_id,
            "PAYMENT-123"
          );


          let events =
            context
              .getLedgerEvents();


          assert.equal(
            events.length,
            2
          );


          assert.equal(
            events[1].mp_status,
            "charged_back"
          );


          assert.equal(
            events[1].mp_status_detail,
            "in_process"
          );


          assert.equal(
            events[1].outcome,
            "processed"
          );


          assert.equal(
            events[1].occurrence_count,
            1
          );


          /**
           * 3. Reentrega exata do chargeback.
           */
          const repeatedChargeback =
            await handler(
              createWebhookRequest()
            );


          assert.equal(
            repeatedChargeback.status,
            200
          );


          order =
            context
              .getOrders()[0];


          assert.equal(
            order.status,
            "charged_back"
          );


          events =
            context
              .getLedgerEvents();


          assert.equal(
            events.length,
            2
          );


          assert.equal(
            events[1].occurrence_count,
            2
          );


          /**
           * 4. Disputa resolvida em favor
           * do vendedor.
           *
           * O mesmo pagamento canônico volta
           * a conceder entitlement.
           */
          paymentSnapshot =
            createPayment(
              {
                status:
                  "charged_back",

                status_detail:
                  "reimbursed",
              }
            );


          const reimbursedResponse =
            await handler(
              createWebhookRequest()
            );


          assert.equal(
            reimbursedResponse.status,
            200
          );


          order =
            context
              .getOrders()[0];


          assert.equal(
            order.status,
            "approved"
          );


          assert.equal(
            order.mp_payment_id,
            "PAYMENT-123"
          );


          events =
            context
              .getLedgerEvents();


          /**
           * approved,
           * charged_back/in_process,
           * charged_back/reimbursed.
           */
          assert.equal(
            events.length,
            3
          );


          assert.equal(
            events[2].mp_status,
            "charged_back"
          );


          assert.equal(
            events[2].mp_status_detail,
            "reimbursed"
          );


          assert.equal(
            events[2].outcome,
            "processed"
          );


          assert.equal(
            events[2].occurrence_count,
            1
          );


          /**
           * 5. Reentrega do reimbursed também
           * precisa permanecer idempotente.
           */
          const repeatedReimbursed =
            await handler(
              createWebhookRequest()
            );


          assert.equal(
            repeatedReimbursed.status,
            200
          );


          order =
            context
              .getOrders()[0];


          assert.equal(
            order.status,
            "approved"
          );


          assert.equal(
            order.mp_payment_id,
            "PAYMENT-123"
          );


          events =
            context
              .getLedgerEvents();


          assert.equal(
            events.length,
            3
          );


          assert.equal(
            events[2].occurrence_count,
            2
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "segundo payment_id não pode substituir pagamento já aprovado",
      async () => {
        const context =
          createContext();


        try {
          context.insertOrder();


          const handler =
            createMercadoPagoWebhookPostHandler(
              commonDependencies(
                context
              )
            );


          const first =
            await handler(
              createWebhookRequest(
                {
                  dataId:
                    "PAYMENT-FIRST",

                  bodyDataId:
                    "PAYMENT-FIRST",
                }
              )
            );


          assert.equal(
            first.status,
            200
          );


          const second =
            await handler(
              createWebhookRequest(
                {
                  dataId:
                    "PAYMENT-SECOND",

                  bodyDataId:
                    "PAYMENT-SECOND",
                }
              )
            );


          const payload =
            await second.json();


          assert.equal(
            second.status,
            200
          );


          assert.equal(
            payload.received,
            true
          );


          assert.equal(
            payload.quarantined,
            true
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
            "PAYMENT-FIRST"
          );


          const events =
            context
              .getLedgerEvents();


          assert.equal(
            events.length,
            2
          );


          assert.equal(
            events[0].outcome,
            "processed"
          );


          assert.equal(
            events[1].outcome,
            "quarantined"
          );


          assert.equal(
            events[1].error_code,
            "PAYMENT_ORDER_STATE_ERROR"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "falha ao persistir ledger deve retornar 500 para permitir retry",
      async () => {
        const context =
          createContext();


        try {
          context.insertOrder();


          const handler =
            createMercadoPagoWebhookPostHandler(
              commonDependencies(
                context,
                {
                  getPayment:
                    async (
                      paymentId
                    ) =>
                      createPayment(
                        {
                          id:
                            paymentId,

                          status:
                            "pending",
                        }
                      ),

                  recordLedger:
                    () => {
                      throw new Error(
                        "Falha simulada no ledger."
                      );
                    },
                }
              )
            );


          const response =
            await handler(
              createWebhookRequest()
            );


          const payload =
            await response.json();


          assert.equal(
            response.status,
            500
          );


          assert.equal(
            payload.error,
            "Webhook audit persistence failed"
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


          assert.equal(
            context
              .getLedgerEvents()
              .length,
            0
          );
        } finally {
          context.cleanup();
        }
      }
    );
  }
);