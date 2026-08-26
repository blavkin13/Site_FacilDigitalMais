import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  after,
  describe,
  test,
} from "node:test";

import Database from "better-sqlite3";

import {
  runMigrations,
} from "../db/migrations.ts";

const temporaryDirectories = [];

function createTemporaryDatabasePath() {
  const directory =
    mkdtempSync(
      join(
        tmpdir(),
        "facildigital-p0-payment-schema-"
      )
    );

  temporaryDirectories.push(
    directory
  );

  return join(
    directory,
    "test.db"
  );
}

function getPaymentMigrationSql() {
  const migrationsSource =
    readFileSync(
      join(
        process.cwd(),
        "db/migrations.ts"
      ),
      "utf8"
    );

  const match =
    migrationsSource.match(
      /id:\s*"0006_payment_order_identity"[\s\S]*?sql:\s*`([\s\S]*?)`\s*,?\s*\}/
    );

  assert.ok(
    match,
    "Migration 0006_payment_order_identity deve existir em db/migrations.ts"
  );

  return match[1];
}

function createLegacyOrdersDatabase() {
  const databasePath =
    createTemporaryDatabasePath();

  const db =
    new Database(
      databasePath
    );

  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      cpf TEXT,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL
        REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending',
      payment_method TEXT,
      mp_payment_id TEXT,
      subtotal REAL NOT NULL,
      discount REAL DEFAULT 0,
      total REAL NOT NULL,
      coupon TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.prepare(`
    INSERT INTO users (
      email,
      password_hash,
      role
    )
    VALUES (?, ?, ?)
  `).run(
    "p0-test@example.com",
    "test-hash",
    "user"
  );

  return db;
}

function insertLegacyOrder(
  db,
  {
    mpPaymentId = null,
    total = 39.9,
  } = {}
) {
  return db
    .prepare(`
      INSERT INTO orders (
        user_id,
        status,
        payment_method,
        mp_payment_id,
        subtotal,
        discount,
        total
      )
      VALUES (
        1,
        'pending',
        'pix',
        ?,
        ?,
        0,
        ?
      )
    `)
    .run(
      mpPaymentId,
      total,
      total
    );
}

function applyPaymentMigration(
  db
) {
  const migrationSql =
    getPaymentMigrationSql();

  const apply =
    db.transaction(
      () => {
        db.exec(
          migrationSql
        );
      }
    );

  apply();
}

after(
  () => {
    for (
      const directory
      of temporaryDirectories
    ) {
      rmSync(
        directory,
        {
          recursive: true,
          force: true,
        }
      );
    }
  }
);

describe(
  "P0 - schema financeiro dos pedidos",
  () => {
    test(
      "banco novo deve aplicar migrations 0001-0006 e permanecer idempotente",
      () => {
        const databasePath =
          createTemporaryDatabasePath();

        const db =
          new Database(
            databasePath
          );

        try {
          const firstRun =
            runMigrations(
              db
            );

          assert.equal(
            firstRun.total,
            6
          );

          assert.ok(
            firstRun.applied.includes(
              "0006_payment_order_identity"
            )
          );

          const columns =
            db
              .prepare(
                "PRAGMA table_info(orders)"
              )
              .all();

          const columnNames =
            new Set(
              columns.map(
                (
                  column
                ) =>
                  column.name
              )
            );

          assert.ok(
            columnNames.has(
              "external_reference"
            )
          );

          assert.ok(
            columnNames.has(
              "preference_id"
            )
          );

          assert.ok(
            columnNames.has(
              "mp_payment_id"
            )
          );

          const indexes =
            db
              .prepare(
                "PRAGMA index_list(orders)"
              )
              .all();

          const indexNames =
            new Set(
              indexes.map(
                (
                  index
                ) =>
                  index.name
              )
            );

          assert.ok(
            indexNames.has(
              "uq_orders_external_reference"
            )
          );

          assert.ok(
            indexNames.has(
              "uq_orders_preference_id"
            )
          );

          assert.ok(
            indexNames.has(
              "uq_orders_mp_payment_id"
            )
          );

          const secondRun =
            runMigrations(
              db
            );

          assert.deepEqual(
            secondRun.applied,
            []
          );

          assert.equal(
            secondRun.alreadyApplied,
            6
          );

          assert.equal(
            secondRun.total,
            6
          );
        } finally {
          db.close();
        }
      }
    );

    test(
      "migration 0006 deve preservar pedidos historicos e permitir multiplos NULL",
      () => {
        const db =
          createLegacyOrdersDatabase();

        try {
          insertLegacyOrder(
            db
          );

          insertLegacyOrder(
            db
          );

          applyPaymentMigration(
            db
          );

          const columns =
            db
              .prepare(
                "PRAGMA table_info(orders)"
              )
              .all();

          const externalReference =
            columns.find(
              (
                column
              ) =>
                column.name ===
                "external_reference"
            );

          const preferenceId =
            columns.find(
              (
                column
              ) =>
                column.name ===
                "preference_id"
            );

          assert.ok(
            externalReference
          );

          assert.ok(
            preferenceId
          );

          assert.equal(
            externalReference.notnull,
            0
          );

          assert.equal(
            preferenceId.notnull,
            0
          );

          const historicalOrders =
            db
              .prepare(`
                SELECT
                  external_reference,
                  preference_id,
                  mp_payment_id
                FROM orders
                ORDER BY id
              `)
              .all();

          assert.equal(
            historicalOrders.length,
            2
          );

          for (
            const order
            of historicalOrders
          ) {
            assert.equal(
              order.external_reference,
              null
            );

            assert.equal(
              order.preference_id,
              null
            );

            assert.equal(
              order.mp_payment_id,
              null
            );
          }

          insertLegacyOrder(
            db
          );

          assert.equal(
            db
              .prepare(
                "SELECT COUNT(*) AS total FROM orders"
              )
              .get()
              .total,
            3
          );
        } finally {
          db.close();
        }
      }
    );

    test(
      "external_reference deve ser unica quando preenchida",
      () => {
        const db =
          createLegacyOrdersDatabase();

        try {
          insertLegacyOrder(
            db
          );

          insertLegacyOrder(
            db
          );

          applyPaymentMigration(
            db
          );

          db.prepare(`
            UPDATE orders
            SET external_reference = ?
            WHERE id = 1
          `).run(
            "fd-order-reference-a"
          );

          assert.throws(
            () => {
              db.prepare(`
                UPDATE orders
                SET external_reference = ?
                WHERE id = 2
              `).run(
                "fd-order-reference-a"
              );
            },
            /UNIQUE constraint failed/
          );
        } finally {
          db.close();
        }
      }
    );

    test(
      "preference_id deve ser unico quando preenchido",
      () => {
        const db =
          createLegacyOrdersDatabase();

        try {
          insertLegacyOrder(
            db
          );

          insertLegacyOrder(
            db
          );

          applyPaymentMigration(
            db
          );

          db.prepare(`
            UPDATE orders
            SET preference_id = ?
            WHERE id = 1
          `).run(
            "mp-preference-a"
          );

          assert.throws(
            () => {
              db.prepare(`
                UPDATE orders
                SET preference_id = ?
                WHERE id = 2
              `).run(
                "mp-preference-a"
              );
            },
            /UNIQUE constraint failed/
          );
        } finally {
          db.close();
        }
      }
    );

    test(
      "mp_payment_id deve ser unico quando preenchido",
      () => {
        const db =
          createLegacyOrdersDatabase();

        try {
          insertLegacyOrder(
            db
          );

          insertLegacyOrder(
            db
          );

          applyPaymentMigration(
            db
          );

          db.prepare(`
            UPDATE orders
            SET mp_payment_id = ?
            WHERE id = 1
          `).run(
            "payment-123"
          );

          assert.throws(
            () => {
              db.prepare(`
                UPDATE orders
                SET mp_payment_id = ?
                WHERE id = 2
              `).run(
                "payment-123"
              );
            },
            /UNIQUE constraint failed/
          );
        } finally {
          db.close();
        }
      }
    );

    test(
      "migration deve falhar atomicamente se banco legado possuir payment_id duplicado",
      () => {
        const db =
          createLegacyOrdersDatabase();

        try {
          insertLegacyOrder(
            db,
            {
              mpPaymentId:
                "duplicate-payment",
            }
          );

          insertLegacyOrder(
            db,
            {
              mpPaymentId:
                "duplicate-payment",
            }
          );

          assert.throws(
            () => {
              applyPaymentMigration(
                db
              );
            },
            /UNIQUE constraint failed/
          );

          const columns =
            db
              .prepare(
                "PRAGMA table_info(orders)"
              )
              .all();

          const columnNames =
            new Set(
              columns.map(
                (
                  column
                ) =>
                  column.name
              )
            );

          assert.equal(
            columnNames.has(
              "external_reference"
            ),
            false,
            "Falha da migration deve reverter external_reference"
          );

          assert.equal(
            columnNames.has(
              "preference_id"
            ),
            false,
            "Falha da migration deve reverter preference_id"
          );
        } finally {
          db.close();
        }
      }
    );
  }
);