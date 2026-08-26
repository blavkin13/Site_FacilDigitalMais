import assert from "node:assert/strict";

import {
  mkdtempSync,
  readFileSync,
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

import * as schema from "../db/schema.ts";

import {
  runMigrations,
} from "../db/migrations.ts";

import {
  attachPaymentPreference,
  CheckoutValidationError,
  createPendingCheckoutOrder,
} from "../lib/checkout-order.ts";


function createContext() {
  const directory =
    mkdtempSync(
      join(
        tmpdir(),
        "facildigital-p0-checkout-"
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
      "checkout-test@example.com",
      "test-hash",
      "Checkout Test",
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
      "apostila-a",
      "Apostila A",
      "Produto de teste A",
      49.9,
      39.9,
      1
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
      "apostila-b",
      "Apostila B",
      "Produto de teste B",
      29.9,
      24.9,
      1
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
      "apostila-inativa",
      "Apostila Inativa",
      "Produto inativo",
      99.9,
      89.9,
      0
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


function countRows(
  sqlite,
  table
) {
  return sqlite
    .prepare(
      `SELECT COUNT(*) AS total FROM ${table}`
    )
    .get()
    .total;
}


describe(
  "P0 - criacao segura de pedidos",
  () => {
    test(
      "API publica de pedidos nao deve permitir criacao ou aprovacao direta",
      () => {
        const routeSource =
          readFileSync(
            join(
              process.cwd(),
              "app/api/orders/route.ts"
            ),
            "utf8"
          );

        assert.match(
          routeSource,
          /export async function GET/
        );

        assert.doesNotMatch(
          routeSource,
          /export async function POST/
        );

        assert.doesNotMatch(
          routeSource,
          /status:\s*["']approved["']/
        );

        assert.doesNotMatch(
          routeSource,
          /mpPaymentId/
        );

        assert.doesNotMatch(
          routeSource,
          /\.insert\s*\(\s*orders\s*\)/
        );
      }
    );

    test(
      "handler de checkout deve delegar criacao atomica para a camada de dominio",
      () => {
        const routeSource =
          readFileSync(
            join(
              process.cwd(),
              "app/api/checkout/create/route.ts"
            ),
            "utf8"
          );


        const handlerSource =
          readFileSync(
            join(
              process.cwd(),
              "lib/checkout-route-handler.ts"
            ),
            "utf8"
          );


        assert.match(
          routeSource,
          /createCheckoutPostHandler/
        );


        assert.match(
          handlerSource,
          /createPendingCheckoutOrder/
        );


        assert.match(
          handlerSource,
          /attachPaymentPreference/
        );


        assert.match(
          handlerSource,
          /externalReference/
        );


        assert.doesNotMatch(
          handlerSource,
          /\.insert\s*\(\s*orders\s*\)/
        );


        assert.doesNotMatch(
          handlerSource,
          /\.insert\s*\(\s*orderItems\s*\)/
        );


        assert.doesNotMatch(
          handlerSource,
          /Math\.random/
        );


        assert.doesNotMatch(
          handlerSource,
          /Date\.now/
        );
      }
    );

    test(
      "deve usar preco do banco e ignorar preco enviado pelo cliente",
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

                items: [
                  {
                    slug:
                      "apostila-a",

                    quantity:
                      1,

                    price:
                      0.01,
                  },
                ],
              }
            );

          assert.equal(
            result.subtotal,
            49.9
          );

          assert.equal(
            result.total,
            49.9
          );

          assert.equal(
            result.mpItems[0]
              .unit_price,
            49.9
          );

          const persistedOrder =
            context.sqlite
              .prepare(`
                SELECT *
                FROM orders
                WHERE id = ?
              `)
              .get(
                result.order.id
              );

          assert.equal(
            persistedOrder.total,
            49.9
          );

          assert.equal(
            persistedOrder.payment_method,
            "card"
          );

          assert.match(
            persistedOrder.external_reference,
            /^FD-[0-9a-f-]{36}$/i
          );

          const persistedItem =
            context.sqlite
              .prepare(`
                SELECT *
                FROM order_items
                WHERE order_id = ?
              `)
              .get(
                result.order.id
              );

          assert.equal(
            persistedItem.quantity,
            1
          );

          assert.equal(
            persistedItem.unit_price,
            49.9
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "PIX, cartao e boleto devem utilizar o mesmo preco base",
      () => {
        const context =
          createContext();

        try {
          for (
            const paymentMethod
            of [
              "pix",
              "card",
              "boleto",
            ]
          ) {
            const result =
              createPendingCheckoutOrder(
                context.db,
                {
                  userId:
                    1,

                  paymentMethod,

                  items: [
                    {
                      slug:
                        "apostila-a",

                      quantity:
                        1,
                    },
                  ],
                }
              );

            assert.equal(
              result.subtotal,
              49.9
            );

            assert.equal(
              result.discount,
              0
            );

            assert.equal(
              result.total,
              49.9
            );

            assert.equal(
              result.mpItems[0]
                .unit_price,
              49.9
            );
          }
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "cupom deve continuar sendo normalizado e aplicado sobre o preco unico",
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

                coupon:
                  "  aprova10  ",

                items: [
                  {
                    slug:
                      "apostila-a",

                    quantity:
                      1,
                  },
                ],
              }
            );

          assert.equal(
            result.coupon,
            "APROVA10"
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
            result.mpItems[0]
              .unit_price,
            49.9
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "deve rejeitar quantidade manipulada sem criar pedido",
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
                    "card",

                  items: [
                    {
                      slug:
                        "apostila-a",

                      quantity:
                        50,
                    },
                  ],
                }
              );
            },
            CheckoutValidationError
          );

          assert.equal(
            countRows(
              context.sqlite,
              "orders"
            ),
            0
          );

          assert.equal(
            countRows(
              context.sqlite,
              "order_items"
            ),
            0
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "deve rejeitar produto inexistente ou inativo sem criar pedido parcial",
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
                    "card",

                  items: [
                    {
                      slug:
                        "apostila-a",

                      quantity:
                        1,
                    },

                    {
                      slug:
                        "produto-inexistente",

                      quantity:
                        1,
                    },
                  ],
                }
              );
            },
            CheckoutValidationError
          );

          assert.equal(
            countRows(
              context.sqlite,
              "orders"
            ),
            0
          );

          assert.throws(
            () => {
              createPendingCheckoutOrder(
                context.db,
                {
                  userId:
                    1,

                  paymentMethod:
                    "card",

                  items: [
                    {
                      slug:
                        "apostila-inativa",

                      quantity:
                        1,
                    },
                  ],
                }
              );
            },
            CheckoutValidationError
          );

          assert.equal(
            countRows(
              context.sqlite,
              "orders"
            ),
            0
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "deve rejeitar produto duplicado no carrinho",
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
                    "card",

                  items: [
                    {
                      slug:
                        "apostila-a",

                      quantity:
                        1,
                    },

                    {
                      slug:
                        "apostila-a",

                      quantity:
                        1,
                    },
                  ],
                }
              );
            },
            CheckoutValidationError
          );

          assert.equal(
            countRows(
              context.sqlite,
              "orders"
            ),
            0
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "falha ao inserir item deve reverter o pedido inteiro",
      () => {
        const context =
          createContext();

        try {
          context.sqlite.exec(`
            CREATE TRIGGER
              force_order_item_failure
            BEFORE INSERT
              ON order_items
            BEGIN
              SELECT RAISE(
                ABORT,
                'forced-order-item-failure'
              );
            END;
          `);

          assert.throws(
            () => {
              createPendingCheckoutOrder(
                context.db,
                {
                  userId:
                    1,

                  paymentMethod:
                    "card",

                  items: [
                    {
                      slug:
                        "apostila-a",

                      quantity:
                        1,
                    },
                  ],
                }
              );
            },
            /forced-order-item-failure/
          );

          assert.equal(
            countRows(
              context.sqlite,
              "orders"
            ),
            0
          );

          assert.equal(
            countRows(
              context.sqlite,
              "order_items"
            ),
            0
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "deve gerar external_reference diferente para pedidos distintos",
      () => {
        const context =
          createContext();

        try {
          const first =
            createPendingCheckoutOrder(
              context.db,
              {
                userId:
                  1,

                paymentMethod:
                  "card",

                items: [
                  {
                    slug:
                      "apostila-a",

                    quantity:
                      1,
                  },
                ],
              }
            );

          const second =
            createPendingCheckoutOrder(
              context.db,
              {
                userId:
                  1,

                paymentMethod:
                  "card",

                items: [
                  {
                    slug:
                      "apostila-b",

                    quantity:
                      1,
                  },
                ],
              }
            );

          assert.notEqual(
            first.externalReference,
            second.externalReference
          );

          assert.equal(
            countRows(
              context.sqlite,
              "orders"
            ),
            2
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "deve persistir preference_id no pedido correto",
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

                items: [
                  {
                    slug:
                      "apostila-a",

                    quantity:
                      1,
                  },
                ],
              }
            );

          attachPaymentPreference(
            context.db,
            result.order.id,
            "MP-PREFERENCE-123"
          );

          const persisted =
            context.sqlite
              .prepare(`
                SELECT preference_id
                FROM orders
                WHERE id = ?
              `)
              .get(
                result.order.id
              );

          assert.equal(
            persisted.preference_id,
            "MP-PREFERENCE-123"
          );
        } finally {
          context.cleanup();
        }
      }
    );
  }
);