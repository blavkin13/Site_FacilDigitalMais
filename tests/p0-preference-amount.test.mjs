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
  CheckoutValidationError,
  createPendingCheckoutOrder,
} from "../lib/checkout-order.ts";

import {
  assertPaymentPreferenceAmount,
  calculateMercadoPagoItemsTotalCents,
  MercadoPagoProviderError,
} from "../lib/mercadopago.ts";


function createContext() {
  const directory =
    mkdtempSync(
      join(
        tmpdir(),
        "facildigital-preference-amount-"
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
      "amount-test@example.com",
      "test-hash",
      "Amount Test",
      "user"
    );


  const insertProduct =
    sqlite.prepare(`
      INSERT INTO products (
        slug,
        title,
        description,
        price,
        pix_price,
        active
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `);


  insertProduct.run(
    "apostila-a",
    "Apostila A",
    "Produto A",
    49.9,
    1,
    1
  );


  insertProduct.run(
    "apostila-b",
    "Apostila B",
    "Produto B",
    29.9,
    1,
    1
  );


  insertProduct.run(
    "produto-barato-a",
    "Produto barato A",
    "Produto barato A",
    5,
    1,
    1
  );


  insertProduct.run(
    "produto-barato-b",
    "Produto barato B",
    "Produto barato B",
    5.01,
    1,
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


function item(
  slug
) {
  return {
    slug,
    quantity:
      1,
  };
}


describe(
  "P0.8-A - valor exato da preferência",
  () => {
    test(
      "pedido sem cupom deve enviar exatamente orders.total",
      () => {
        const context =
          createContext();


        try {
          const result =
            createPendingCheckoutOrder(
              context.db,
              {
                userId:
                  1,

                paymentMethod:
                  "pix",

                items: [
                  item(
                    "apostila-a"
                  ),
                  item(
                    "apostila-b"
                  ),
                ],
              }
            );


          assert.equal(
            result.subtotal,
            79.8
          );


          assert.equal(
            result.discount,
            0
          );


          assert.equal(
            result.total,
            79.8
          );


          assert.equal(
            calculateMercadoPagoItemsTotalCents(
              result.mpItems
            ),
            7980
          );


          assertPaymentPreferenceAmount(
            result.mpItems,
            result.total
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "APROVA10 em um item deve reduzir também o valor enviado ao Mercado Pago",
      () => {
        const context =
          createContext();


        try {
          const result =
            createPendingCheckoutOrder(
              context.db,
              {
                userId:
                  1,

                paymentMethod:
                  "card",

                coupon:
                  "APROVA10",

                items: [
                  item(
                    "apostila-a"
                  ),
                ],
              }
            );


          assert.equal(
            result.subtotal,
            49.9
          );


          assert.equal(
            result.discount,
            10
          );


          assert.equal(
            result.total,
            39.9
          );


          assert.equal(
            result.mpItems.length,
            1
          );


          assert.equal(
            result.mpItems[0]
              .unit_price,
            39.9
          );


          assert.equal(
            calculateMercadoPagoItemsTotalCents(
              result.mpItems
            ),
            3990
          );


          assertPaymentPreferenceAmount(
            result.mpItems,
            result.total
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "APROVA10 com varios itens deve distribuir desconto e preservar total exato",
      () => {
        const context =
          createContext();


        try {
          const result =
            createPendingCheckoutOrder(
              context.db,
              {
                userId:
                  1,

                paymentMethod:
                  "boleto",

                coupon:
                  "APROVA10",

                items: [
                  item(
                    "apostila-a"
                  ),
                  item(
                    "apostila-b"
                  ),
                ],
              }
            );


          assert.equal(
            result.subtotal,
            79.8
          );


          assert.equal(
            result.discount,
            10
          );


          assert.equal(
            result.total,
            69.8
          );


          assert.equal(
            result.mpItems.length,
            2
          );


          for (
            const mpItem
            of result.mpItems
          ) {
            assert.equal(
              mpItem.quantity,
              1
            );


            assert.ok(
              mpItem.unit_price >
                0
            );
          }


          assert.equal(
            calculateMercadoPagoItemsTotalCents(
              result.mpItems
            ),
            6980
          );


          assertPaymentPreferenceAmount(
            result.mpItems,
            result.total
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "divergencia de um centavo deve impedir criação da preferência",
      () => {
        const items = [
          {
            id:
              "apostila-a",

            title:
              "Apostila A",

            description:
              "Teste",

            quantity:
              1,

            unit_price:
              39.9,
          },
        ];


        assertPaymentPreferenceAmount(
          items,
          39.9
        );


        assert.throws(
          () => {
            assertPaymentPreferenceAmount(
              items,
              39.91
            );
          },
          MercadoPagoProviderError
        );


        assert.throws(
          () => {
            assertPaymentPreferenceAmount(
              items,
              39.89
            );
          },
          MercadoPagoProviderError
        );
      }
    );


    test(
      "cupom que tornaria itens não representáveis deve ser rejeitado antes do pedido",
      () => {
        const context =
          createContext();


        try {
          assert.throws(
            () => {
              createPendingCheckoutOrder(
                context.db,
                {
                  userId:
                    1,

                  paymentMethod:
                    "pix",

                  coupon:
                    "APROVA10",

                  items: [
                    item(
                      "produto-barato-a"
                    ),
                    item(
                      "produto-barato-b"
                    ),
                  ],
                }
              );
            },
            CheckoutValidationError
          );


          assert.equal(
            context.sqlite
              .prepare(`
                SELECT COUNT(*) AS total
                FROM orders
              `)
              .get()
              .total,
            0
          );


          assert.equal(
            context.sqlite
              .prepare(`
                SELECT COUNT(*) AS total
                FROM order_items
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