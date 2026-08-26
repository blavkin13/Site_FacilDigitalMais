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
      "external_reference desconhecida deve retornar 409 sem tocar último pending",
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
            409
          );


          assert.equal(
            payload.error,
            "Payment correlation conflict"
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
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "approved com diferença de um centavo deve retornar 409 e não conceder entitlement",
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


          const response =
            await handler(
              createWebhookRequest()
            );


          const payload =
            await response.json();


          assert.equal(
            response.status,
            409
          );


          assert.equal(
            payload.error,
            "Payment financial mismatch"
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
            409
          );


          assert.equal(
            payload.error,
            "Payment state conflict"
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
        } finally {
          context.cleanup();
        }
      }
    );
  }
);