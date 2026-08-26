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
  createCheckoutPostHandler,
} from "../lib/checkout-route-handler.ts";

import {
  MercadoPagoProviderError,
} from "../lib/mercadopago.ts";

import {
  PaymentConfigurationError,
} from "../lib/payment-config.ts";


function createContext() {
  const directory =
    mkdtempSync(
      join(
        tmpdir(),
        "facildigital-p0-route-"
      )
    );


  const databasePath =
    join(
      directory,
      "test.db"
    );


  const sqlite =
    new Database(
      databasePath
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
      "route-test@example.com",
      "test-hash",
      "Route Test",
      "user"
    );


  sqlite
    .prepare(`
      INSERT INTO products (
        slug,
        title,
        description,
        price,
        pix_price,
        active
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(
      "apostila-route",
      "Apostila Route",
      "Produto do teste da rota",
      49.9,
      29.9,
      1
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
    db,
    sqlite,
    cleanup,
  };
}


function createRequest(
  body,
  token =
    "test-session-token"
) {
  return {
    cookies: {
      get(
        name
      ) {
        if (
          name ===
            "fd-session" &&
          token
        ) {
          return {
            value:
              token,
          };
        }


        return undefined;
      },
    },


    async json() {
      return body;
    },
  };
}


function validBody() {
  return {
    items: [
      {
        slug:
          "apostila-route",

        quantity:
          1,
      },
    ],

    paymentMethod:
      "pix",

    coupon:
      null,
  };
}


function commonDependencies(
  context
) {
  return {
    initializeDatabase:
      async () => {},

    getDatabase:
      () =>
        context.db,

    validateSessionToken:
      async () => ({
        id:
          1,

        email:
          "route-test@example.com",

        name:
          "Route Test",
      }),

    getBaseUrl:
      () =>
        "https://facildigitalmais.com",

    getAccessToken:
      () =>
        "TEST-valid-test-credential",
  };
}


function getOrders(
  sqlite
) {
  return sqlite
    .prepare(`
      SELECT
        id,
        status,
        external_reference,
        preference_id,
        mp_payment_id,
        total
      FROM orders
      ORDER BY id
    `)
    .all();
}


describe(
  "P0 - checkout HTTP fail-closed",
  () => {
    test(
      "configuracao invalida deve retornar 503 sem criar pedido",
      async () => {
        const context =
          createContext();


        let providerCalls =
          0;


        try {
          const handler =
            createCheckoutPostHandler(
              {
                ...commonDependencies(
                  context
                ),

                getAccessToken:
                  () => {
                    throw new PaymentConfigurationError(
                      "Token ausente."
                    );
                  },

                createPreference:
                  async () => {
                    providerCalls +=
                      1;


                    throw new Error(
                      "Provider nao deveria ser chamado."
                    );
                  },
              }
            );


          const response =
            await handler(
              createRequest(
                validBody()
              )
            );


          const payload =
            await response.json();


          assert.equal(
            response.status,
            503
          );


          assert.equal(
            payload.error,
            "Pagamento temporariamente indisponível."
          );


          assert.equal(
            Object.hasOwn(
              payload,
              "success"
            ),
            false
          );


          assert.equal(
            Object.hasOwn(
              payload,
              "checkoutUrl"
            ),
            false
          );


          assert.equal(
            providerCalls,
            0
          );


          assert.equal(
            getOrders(
              context.sqlite
            ).length,
            0,
            "Erro local de configuracao nao deve criar pedido"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "falha do provedor deve retornar 502 e preservar pedido pending",
      async () => {
        const context =
          createContext();


        try {
          const handler =
            createCheckoutPostHandler(
              {
                ...commonDependencies(
                  context
                ),

                createPreference:
                  async () => {
                    throw new MercadoPagoProviderError(
                      "Falha simulada do provedor."
                    );
                  },
              }
            );


          const response =
            await handler(
              createRequest(
                validBody()
              )
            );


          const payload =
            await response.json();


          assert.equal(
            response.status,
            502
          );


          assert.equal(
            payload.error,
            "Não foi possível iniciar o pagamento. Tente novamente."
          );


          assert.equal(
            Object.hasOwn(
              payload,
              "success"
            ),
            false
          );


          assert.equal(
            Object.hasOwn(
              payload,
              "checkoutUrl"
            ),
            false
          );


          const orders =
            getOrders(
              context.sqlite
            );


          assert.equal(
            orders.length,
            1
          );


          assert.equal(
            orders[0].status,
            "pending"
          );


          assert.notEqual(
            orders[0]
              .external_reference,
            null
          );


          assert.equal(
            orders[0]
              .preference_id,
            null
          );


          assert.equal(
            orders[0]
              .mp_payment_id,
            null
          );


          assert.equal(
            context.sqlite
              .prepare(`
                SELECT COUNT(*) AS total
                FROM order_items
              `)
              .get()
              .total,
            1
          );


          /**
           * O entitlement da plataforma deriva de
           * pedidos approved.
           *
           * Um erro do provedor nunca pode transformar
           * o pedido em approved.
           */
          assert.equal(
            context.sqlite
              .prepare(`
                SELECT COUNT(*) AS total
                FROM orders
                WHERE status = 'approved'
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
      "sucesso do provedor deve persistir preference_id antes da resposta",
      async () => {
        const context =
          createContext();


        let providerInput =
          null;


        try {
          const handler =
            createCheckoutPostHandler(
              {
                ...commonDependencies(
                  context
                ),

                createPreference:
                  async (
                    data
                  ) => {
                    providerInput =
                      data;


                    return {
                      init_point:
                        "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=PREF-123",

                      preference_id:
                        "PREF-123",
                    };
                  },
              }
            );


          const response =
            await handler(
              createRequest(
                validBody()
              )
            );


          const payload =
            await response.json();


          assert.equal(
            response.status,
            200
          );


          assert.equal(
            payload.success,
            true
          );


          assert.equal(
            payload.checkoutUrl,
            "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=PREF-123"
          );


          assert.equal(
            payload.preferenceId,
            "PREF-123"
          );


          assert.equal(
            providerInput.backUrl,
            "https://facildigitalmais.com"
          );


          assert.equal(
            providerInput
              .orderReference,
            payload.orderReference
          );


          const orders =
            getOrders(
              context.sqlite
            );


          assert.equal(
            orders.length,
            1
          );


          assert.equal(
            orders[0].status,
            "pending"
          );


          assert.equal(
            orders[0]
              .preference_id,
            "PREF-123"
          );


          assert.equal(
            orders[0]
              .external_reference,
            payload.orderReference
          );


          assert.equal(
            orders[0].total,
            49.9,
            "Preco deve permanecer unico independentemente do PIX"
          );


          assert.equal(
            context.sqlite
              .prepare(`
                SELECT COUNT(*) AS total
                FROM orders
                WHERE status = 'approved'
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
      "sessao ausente deve retornar 401 antes de qualquer operacao financeira",
      async () => {
        const context =
          createContext();


        let providerCalls =
          0;


        try {
          const handler =
            createCheckoutPostHandler(
              {
                ...commonDependencies(
                  context
                ),

                createPreference:
                  async () => {
                    providerCalls +=
                      1;


                    throw new Error(
                      "Nao deveria ser chamado."
                    );
                  },
              }
            );


          const response =
            await handler(
              createRequest(
                validBody(),
                null
              )
            );


          const payload =
            await response.json();


          assert.equal(
            response.status,
            401
          );


          assert.equal(
            payload.error,
            "Não autenticado."
          );


          assert.equal(
            providerCalls,
            0
          );


          assert.equal(
            getOrders(
              context.sqlite
            ).length,
            0
          );
        } finally {
          context.cleanup();
        }
      }
    );
  }
);