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
  runMigrations,
} from "../db/migrations.ts";


function createContext() {
  const directory =
    mkdtempSync(
      join(
        tmpdir(),
        "facildigital-webhook-ledger-"
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
    sqlite,
    cleanup,
  };
}


function tableExists(
  sqlite,
  tableName
) {
  return Boolean(
    sqlite
      .prepare(`
        SELECT 1
        FROM sqlite_master
        WHERE
          type = 'table'
          AND name = ?
      `)
      .get(
        tableName
      )
  );
}


function getColumnNames(
  sqlite,
  tableName
) {
  return sqlite
    .prepare(
      `PRAGMA table_info(${tableName})`
    )
    .all()
    .map(
      (
        column
      ) =>
        column.name
    );
}


function getIndexNames(
  sqlite,
  tableName
) {
  return sqlite
    .prepare(
      `PRAGMA index_list(${tableName})`
    )
    .all()
    .map(
      (
        index
      ) =>
        index.name
    );
}


describe(
  "P0.12-A - schema do ledger de webhooks",
  () => {
    test(
      "fresh migrations devem criar migration 0007 e ledger financeiro",
      () => {
        const context =
          createContext();


        try {
          runMigrations(
            context.sqlite
          );


          assert.equal(
            tableExists(
              context.sqlite,
              "payment_webhook_events"
            ),
            true
          );


          const migration =
            context.sqlite
              .prepare(`
                SELECT
                  id,
                  description
                FROM schema_migrations
                WHERE id = ?
              `)
              .get(
                "0007_payment_webhook_events"
              );


          assert.ok(
            migration
          );


          assert.equal(
            migration.id,
            "0007_payment_webhook_events"
          );


          assert.match(
            migration.description,
            /Ledger durável/i
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "ledger deve possuir todos os campos de auditoria necessários",
      () => {
        const context =
          createContext();


        try {
          runMigrations(
            context.sqlite
          );


          const columns =
            getColumnNames(
              context.sqlite,
              "payment_webhook_events"
            );


          for (
            const column
            of [
              "id",
              "event_fingerprint",
              "payment_id",
              "external_reference",
              "mp_status",
              "mp_status_detail",
              "transaction_amount",
              "transaction_amount_refunded",
              "currency_id",
              "outcome",
              "error_code",
              "request_id",
              "occurrence_count",
              "first_received_at",
              "last_received_at",
              "processed_at",
            ]
          ) {
            assert.equal(
              columns.includes(
                column
              ),
              true,
              `Coluna ausente: ${column}`
            );
          }
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "fingerprint deve ser único no banco",
      () => {
        const context =
          createContext();


        try {
          runMigrations(
            context.sqlite
          );


          const insert =
            context.sqlite
              .prepare(`
                INSERT INTO payment_webhook_events (
                  event_fingerprint,
                  payment_id,
                  external_reference,
                  mp_status,
                  mp_status_detail,
                  transaction_amount,
                  currency_id,
                  outcome,
                  request_id
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `);


          insert.run(
            "fingerprint-001",
            "PAYMENT-001",
            "ORDER-001",
            "approved",
            "accredited",
            39.9,
            "BRL",
            "processed",
            "REQUEST-001"
          );


          assert.throws(
            () => {
              insert.run(
                "fingerprint-001",
                "PAYMENT-001",
                "ORDER-001",
                "approved",
                "accredited",
                39.9,
                "BRL",
                "processed",
                "REQUEST-002"
              );
            },
            /UNIQUE constraint failed/
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "occurrence_count deve iniciar em 1",
      () => {
        const context =
          createContext();


        try {
          runMigrations(
            context.sqlite
          );


          context.sqlite
            .prepare(`
              INSERT INTO payment_webhook_events (
                event_fingerprint,
                payment_id,
                external_reference,
                mp_status,
                transaction_amount,
                currency_id,
                outcome,
                request_id
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .run(
              "fingerprint-default",
              "PAYMENT-DEFAULT",
              "ORDER-DEFAULT",
              "pending",
              39.9,
              "BRL",
              "ignored",
              "REQUEST-DEFAULT"
            );


          const row =
            context.sqlite
              .prepare(`
                SELECT
                  occurrence_count,
                  mp_status_detail,
                  first_received_at,
                  last_received_at
                FROM payment_webhook_events
                WHERE event_fingerprint = ?
              `)
              .get(
                "fingerprint-default"
              );


          assert.equal(
            row.occurrence_count,
            1
          );


          assert.equal(
            row.mp_status_detail,
            ""
          );


          assert.equal(
            typeof row.first_received_at,
            "string"
          );


          assert.equal(
            typeof row.last_received_at,
            "string"
          );


          assert.ok(
            row.first_received_at.length >
              0
          );


          assert.ok(
            row.last_received_at.length >
              0
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "ledger deve possuir índices operacionais esperados",
      () => {
        const context =
          createContext();


        try {
          runMigrations(
            context.sqlite
          );


          const indexes =
            getIndexNames(
              context.sqlite,
              "payment_webhook_events"
            );


          for (
            const index
            of [
              "uq_payment_webhook_events_fingerprint",
              "idx_payment_webhook_events_payment",
              "idx_payment_webhook_events_external_reference",
              "idx_payment_webhook_events_outcome",
            ]
          ) {
            assert.equal(
              indexes.includes(
                index
              ),
              true,
              `Índice ausente: ${index}`
            );
          }
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "upgrade lógico de 0006 para 0007 deve preservar pedidos existentes",
      () => {
        const context =
          createContext();


        try {
          /**
           * Criamos primeiro um banco totalmente
           * migrado para obter um histórico válido
           * com checksums reais de 0001-0006.
           */
          runMigrations(
            context.sqlite
          );


          context.sqlite
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
              "upgrade-ledger@example.com",
              "test-hash",
              "Upgrade Ledger",
              "user"
            );


          context.sqlite
            .prepare(`
              INSERT INTO orders (
                user_id,
                status,
                payment_method,
                external_reference,
                preference_id,
                mp_payment_id,
                subtotal,
                discount,
                total
              )
              VALUES (
                1,
                'approved',
                'pix',
                'ORDER-UPGRADE',
                'PREF-UPGRADE',
                'PAYMENT-UPGRADE',
                49.9,
                10,
                39.9
              )
            `)
            .run();


          const before =
            context.sqlite
              .prepare(`
                SELECT
                  id,
                  status,
                  external_reference,
                  preference_id,
                  mp_payment_id,
                  total
                FROM orders
                WHERE external_reference =
                  'ORDER-UPGRADE'
              `)
              .get();


          /**
           * Como 0007 somente cria o ledger,
           * removê-lo e retirar seu registro deixa
           * o banco estruturalmente equivalente ao
           * estado imediatamente após 0006.
           */
          context.sqlite.exec(`
            DROP TABLE payment_webhook_events;

            DELETE FROM schema_migrations
            WHERE id =
              '0007_payment_webhook_events';
          `);


          assert.equal(
            tableExists(
              context.sqlite,
              "payment_webhook_events"
            ),
            false
          );


          runMigrations(
            context.sqlite
          );


          const after =
            context.sqlite
              .prepare(`
                SELECT
                  id,
                  status,
                  external_reference,
                  preference_id,
                  mp_payment_id,
                  total
                FROM orders
                WHERE external_reference =
                  'ORDER-UPGRADE'
              `)
              .get();


          assert.deepEqual(
            after,
            before
          );


          assert.equal(
            tableExists(
              context.sqlite,
              "payment_webhook_events"
            ),
            true
          );


          const applied =
            context.sqlite
              .prepare(`
                SELECT COUNT(*) AS total
                FROM schema_migrations
                WHERE id =
                  '0007_payment_webhook_events'
              `)
              .get();


          assert.equal(
            applied.total,
            1
          );
        } finally {
          context.cleanup();
        }
      }
    );


    test(
      "migration deve permanecer idempotente depois de aplicada",
      () => {
        const context =
          createContext();


        try {
          runMigrations(
            context.sqlite
          );


          const firstCount =
            context.sqlite
              .prepare(`
                SELECT COUNT(*) AS total
                FROM schema_migrations
              `)
              .get()
              .total;


          runMigrations(
            context.sqlite
          );


          const secondCount =
            context.sqlite
              .prepare(`
                SELECT COUNT(*) AS total
                FROM schema_migrations
              `)
              .get()
              .total;


          assert.equal(
            secondCount,
            firstCount
          );


          assert.equal(
            tableExists(
              context.sqlite,
              "payment_webhook_events"
            ),
            true
          );
        } finally {
          context.cleanup();
        }
      }
    );
  }
);