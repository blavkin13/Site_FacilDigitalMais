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
  locateMercadoPagoOrder,
  MercadoPagoWebhookCorrelationError,
} from "../lib/mercadopago-webhook-order.ts";


function createContext() {
  const directory =
    mkdtempSync(
      join(
        tmpdir(),
        "facildigital-webhook-correlation-"
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
      "webhook-test@example.com",
      "test-hash",
      "Webhook Test",
      "user"
    );


  function insertOrder(
    {
      reference,
      paymentId =
        null,
      status =
        "pending",
      total =
        49.9,
    }
  ) {
    return sqlite
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
          preference_id,
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


describe(
  "P0.8-D - localizacao segura do pedido",
  () => {
    test(
      "external_reference deve localizar somente o pedido correto",
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


          context.insertOrder(
            {
              reference:
                "FD-ORDER-B",

              total:
                69.8,
            }
          );


          const result =
            locateMercadoPagoOrder(
              context.db,
              "FD-ORDER-B"
            );


          assert.equal(
            result.orderId,
            2
          );


          assert.equal(
            result.externalReference,
            "FD-ORDER-B"
          );


          assert.equal(
            result.status,
            "pending"
          );


          assert.equal(
            result.total,
            69.8
          );


          assert.equal(
            result.mpPaymentId,
            null
          );


          const orders =
            context.getOrders();


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
      "external_reference desconhecida não pode alterar nenhum pedido",
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


          context.insertOrder(
            {
              reference:
                "FD-ORDER-B",
            }
          );


          assert.throws(
            () => {
              locateMercadoPagoOrder(
                context.db,
                "FD-INEXISTENTE"
              );
            },
            MercadoPagoWebhookCorrelationError
          );


          const orders =
            context.getOrders();


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


          assert.equal(
            orders[0].status,
            "pending"
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
      "localizacao não deve reservar payment_id para primeira tentativa",
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


          const firstAttempt =
            locateMercadoPagoOrder(
              context.db,
              "FD-ORDER-A"
            );


          const secondAttempt =
            locateMercadoPagoOrder(
              context.db,
              "FD-ORDER-A"
            );


          assert.equal(
            firstAttempt.orderId,
            1
          );


          assert.equal(
            secondAttempt.orderId,
            1
          );


          assert.equal(
            firstAttempt.mpPaymentId,
            null
          );


          assert.equal(
            secondAttempt.mpPaymentId,
            null
          );


          const persisted =
            context
              .getOrders()[0];


          assert.equal(
            persisted
              .mp_payment_id,
            null
          );


          assert.equal(
            persisted.status,
            "pending"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "pedido com payment_id existente deve ser apenas lido sem substituição",
      () => {
        const context =
          createContext();


        try {
          context.insertOrder(
            {
              reference:
                "FD-ORDER-A",

              paymentId:
                "PAYMENT-ORIGINAL",
            }
          );


          const result =
            locateMercadoPagoOrder(
              context.db,
              "FD-ORDER-A"
            );


          assert.equal(
            result.mpPaymentId,
            "PAYMENT-ORIGINAL"
          );


          assert.equal(
            context
              .getOrders()[0]
              .mp_payment_id,
            "PAYMENT-ORIGINAL"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "localização não pode alterar status approved existente",
      () => {
        const context =
          createContext();


        try {
          context.insertOrder(
            {
              reference:
                "FD-ORDER-A",

              paymentId:
                "PAYMENT-APPROVED",

              status:
                "approved",
            }
          );


          const result =
            locateMercadoPagoOrder(
              context.db,
              "FD-ORDER-A"
            );


          assert.equal(
            result.status,
            "approved"
          );


          const persisted =
            context
              .getOrders()[0];


          assert.equal(
            persisted.status,
            "approved"
          );


          assert.equal(
            persisted
              .mp_payment_id,
            "PAYMENT-APPROVED"
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "lookup deve ser estritamente somente leitura",
      () => {
        const context =
          createContext();


        try {
          context.insertOrder(
            {
              reference:
                "FD-ORDER-A",

              total:
                39.9,
            }
          );


          const before =
            context
              .getOrders();


          locateMercadoPagoOrder(
            context.db,
            "FD-ORDER-A"
          );


          locateMercadoPagoOrder(
            context.db,
            "FD-ORDER-A"
          );


          const after =
            context
              .getOrders();


          assert.deepEqual(
            after,
            before
          );
        } finally {
          context.cleanup();
        }
      }
    );
  }
);