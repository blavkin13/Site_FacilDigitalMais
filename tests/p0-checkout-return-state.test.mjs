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

import Database from "better-sqlite3";

import {
  drizzle,
} from "drizzle-orm/better-sqlite3";

import {
  CheckoutReturnReferenceError,
  findCheckoutReturnOrderStatus,
  normalizeCheckoutReturnReference,
  normalizeCheckoutReturnStatus,
} from "../lib/checkout-return-status.ts";


function createContext() {
  const sqlite =
    new Database(
      ":memory:"
    );


  sqlite.exec(`
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      external_reference TEXT,
      updated_at TEXT NOT NULL
        DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX
      uq_test_orders_external_reference
    ON orders (
      external_reference
    )
    WHERE external_reference IS NOT NULL;
  `);


  const db =
    drizzle(
      sqlite
    );


  function insertOrder({
    userId =
      1,

    status =
      "pending",

    externalReference =
      "FD-RETURN-TEST",
  } = {}) {
    sqlite
      .prepare(`
        INSERT INTO orders (
          user_id,
          status,
          external_reference,
          updated_at
        )
        VALUES (
          ?,
          ?,
          ?,
          datetime('now')
        )
      `)
      .run(
        userId,
        status,
        externalReference
      );
  }


  return {
    db,
    sqlite,
    insertOrder,

    cleanup() {
      sqlite.close();
    },
  };
}


describe(
  "P0 - retorno seguro do checkout",
  () => {
    test(
      "referência deve ser normalizada sem adquirir autoridade financeira",
      () => {
        assert.equal(
          normalizeCheckoutReturnReference(
            "  FD-ORDER-123  "
          ),
          "FD-ORDER-123"
        );


        assert.throws(
          () =>
            normalizeCheckoutReturnReference(
              ""
            ),
          CheckoutReturnReferenceError
        );


        assert.throws(
          () =>
            normalizeCheckoutReturnReference(
              "x".repeat(
                201
              )
            ),
          CheckoutReturnReferenceError
        );
      }
    );


    test(
      "somente approved deve ativar entitlement",
      () => {
        const context =
          createContext();


        try {
          context.insertOrder({
            status:
              "approved",

            externalReference:
              "FD-APPROVED",
          });


          const result =
            findCheckoutReturnOrderStatus(
              context.db,
              1,
              "FD-APPROVED"
            );


          assert.ok(
            result
          );


          assert.equal(
            result.status,
            "approved"
          );


          assert.equal(
            result.entitlementActive,
            true
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "pending não deve ativar entitlement",
      () => {
        const context =
          createContext();


        try {
          context.insertOrder({
            status:
              "pending",

            externalReference:
              "FD-PENDING",
          });


          const result =
            findCheckoutReturnOrderStatus(
              context.db,
              1,
              "FD-PENDING"
            );


          assert.ok(
            result
          );


          assert.equal(
            result.status,
            "pending"
          );


          assert.equal(
            result.entitlementActive,
            false
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "refunded e charged_back devem permanecer revogados",
      () => {
        for (
          const status
          of [
            "refunded",
            "charged_back",
          ]
        ) {
          const context =
            createContext();


          try {
            const reference =
              `FD-${status}`;


            context.insertOrder({
              status,
              externalReference:
                reference,
            });


            const result =
              findCheckoutReturnOrderStatus(
                context.db,
                1,
                reference
              );


            assert.ok(
              result
            );


            assert.equal(
              result.status,
              status
            );


            assert.equal(
              result.entitlementActive,
              false
            );
          } finally {
            context.cleanup();
          }
        }
      }
    );


    test(
      "referência pertencente a outro usuário não deve localizar pedido",
      () => {
        const context =
          createContext();


        try {
          context.insertOrder({
            userId:
              2,

            status:
              "approved",

            externalReference:
              "FD-OTHER-USER",
          });


          const result =
            findCheckoutReturnOrderStatus(
              context.db,
              1,
              "FD-OTHER-USER"
            );


          assert.equal(
            result,
            null
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "estado financeiro desconhecido deve falhar fechado",
      () => {
        assert.equal(
          normalizeCheckoutReturnStatus(
            "authorized"
          ),
          "unknown"
        );


        assert.equal(
          normalizeCheckoutReturnStatus(
            "anything"
          ),
          "unknown"
        );


        const context =
          createContext();


        try {
          context.insertOrder({
            status:
              "authorized",

            externalReference:
              "FD-UNKNOWN",
          });


          const result =
            findCheckoutReturnOrderStatus(
              context.db,
              1,
              "FD-UNKNOWN"
            );


          assert.ok(
            result
          );


          assert.equal(
            result.status,
            "unknown"
          );


          assert.equal(
            result.entitlementActive,
            false
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "página success não deve confiar em status, payment_id ou demo da URL",
      () => {
        const source =
          readFileSync(
            join(
              process.cwd(),
              "components",
              "checkout-success.tsx"
            ),
            "utf8"
          );


        assert.match(
          source,
          /external_reference/
        );


        assert.match(
          source,
          /\/api\/checkout\/status/
        );


        assert.doesNotMatch(
          source,
          /searchParams\.get\(\s*["']status["']\s*\)/
        );


        assert.doesNotMatch(
          source,
          /searchParams\.get\(\s*["']collection_status["']\s*\)/
        );


        assert.doesNotMatch(
          source,
          /searchParams\.get\(\s*["']payment_id["']\s*\)/
        );


        assert.doesNotMatch(
          source,
          /searchParams\.get\(\s*["']demo["']\s*\)/
        );


        assert.doesNotMatch(
          source,
          /\bisDemo\b/
        );
      }
    );


    test(
      "approved visual deve depender da resposta autenticada do servidor",
      () => {
        const source =
          readFileSync(
            join(
              process.cwd(),
              "components",
              "checkout-success.tsx"
            ),
            "utf8"
          );


        assert.match(
          source,
          /status\s*===\s*["']approved["']/
        );


        assert.match(
          source,
          /entitlementActive\s*!==\s*true/
        );


        assert.match(
          source,
          /setState\(\s*["']approved["']\s*\)/
        );
      }
    );


    test(
      "referência deve ser persistida antes do redirect ao Mercado Pago",
      () => {
        const source =
          readFileSync(
            join(
              process.cwd(),
              "components",
              "checkout-real.tsx"
            ),
            "utf8"
          );


        const storageIndex =
          source.indexOf(
            "fd-checkout-order-reference"
          );


        const redirectIndex =
          source.indexOf(
            "window.location.assign"
          );


        assert.ok(
          storageIndex >=
            0,
          "orderReference deve possuir fallback em sessionStorage"
        );


        assert.ok(
          redirectIndex >=
            0,
          "checkout deve continuar redirecionando ao provedor"
        );


        assert.ok(
          storageIndex <
            redirectIndex,
          "orderReference deve ser salvo antes do redirect"
        );
      }
    );


    test(
      "rotas pending e failure devem existir e não prometer entitlement",
      () => {
        const pending =
          readFileSync(
            join(
              process.cwd(),
              "app",
              "checkout",
              "pending",
              "page.tsx"
            ),
            "utf8"
          );


        const failure =
          readFileSync(
            join(
              process.cwd(),
              "app",
              "checkout",
              "failure",
              "page.tsx"
            ),
            "utf8"
          );


        assert.match(
          pending,
          /ainda não foi confirmado/i
        );


        assert.match(
          pending,
          /servidor registrar a aprovação financeira/i
        );


        assert.match(
          failure,
          /Nenhum acesso é liberado/i
        );
      }
    );


    test(
      "endpoint de status deve ser autenticado e read-only",
      () => {
        const source =
          readFileSync(
            join(
              process.cwd(),
              "app",
              "api",
              "checkout",
              "status",
              "route.ts"
            ),
            "utf8"
          );


        assert.match(
          source,
          /validateSession/
        );


        assert.match(
          source,
          /findCheckoutReturnOrderStatus/
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
      "nova suite deve participar do gate completo",
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
          typeof pkg.scripts[
            "test:p0-checkout-return-state"
          ],
          "string"
        );


        assert.match(
          pkg.scripts[
            "test:all"
          ],
          /\btest:p0-checkout-return-state\b/
        );
      }
    );
  }
);