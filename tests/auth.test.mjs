import {
  after,
  before,
  describe,
  test,
} from "node:test";

import assert from "node:assert/strict";

import {
  existsSync,
  readFileSync,
} from "node:fs";

import {
  join,
} from "node:path";

import Database from "better-sqlite3";

import {
  createIsolatedDatabase,
} from "./helpers/isolated-database.mjs";


describe(
  "Fase 1 - Testes de Autenticação",
  () => {
    let testEnvironment;


    before(
      async () => {
        console.log(
          "🧪 Preparando ambiente isolado de autenticação..."
        );


        testEnvironment =
          await createIsolatedDatabase({
            admin: true,
          });


        console.log(
          `🧪 SQLite isolado: ${testEnvironment.databasePath}`
        );
      }
    );


    test(
      "Validar estrutura do schema",
      () => {
        const schemaPath =
          join(
            process.cwd(),
            "db",
            "schema.ts"
          );


        assert.ok(
          existsSync(
            schemaPath
          )
        );


        console.log(
          "✅ Schema existe"
        );
      }
    );


    test(
      "Validar arquivo de autenticação",
      () => {
        assert.ok(
          existsSync(
            join(
              process.cwd(),
              "lib",
              "auth.ts"
            )
          )
        );


        console.log(
          "✅ auth.ts existe"
        );
      }
    );


    test(
      "Validar arquivo de seed",
      () => {
        assert.ok(
          existsSync(
            join(
              process.cwd(),
              "db",
              "seed.ts"
            )
          )
        );


        console.log(
          "✅ seed.ts existe"
        );
      }
    );


    test(
      "Validar sistema de JSON loader",
      () => {
        assert.ok(
          existsSync(
            join(
              process.cwd(),
              "lib",
              "json-loader.ts"
            )
          )
        );


        console.log(
          "✅ json-loader.ts existe"
        );
      }
    );


    test(
      "Validar hash de senha sem persistência externa",
      async () => {
        const {
          hashPassword,
          verifyPassword,
        } =
          await import(
            "../lib/auth.ts"
          );


        const password =
          "teste123";


        const hash =
          hashPassword(
            password
          );


        assert.equal(
          hash.length,
          64
        );


        assert.equal(
          verifyPassword(
            password,
            hash
          ),
          true
        );


        assert.equal(
          verifyPassword(
            "senhaErrada",
            hash
          ),
          false
        );


        assert.equal(
          verifyPassword(
            "",
            hash
          ),
          false
        );


        assert.equal(
          hashPassword(
            password
          ),
          hash
        );


        console.log(
          "✅ Sistema de hash funcionando"
        );
      }
    );


    test(
      "Validar geração de token sem persistência externa",
      async () => {
        const {
          generateSessionToken,
        } =
          await import(
            "../lib/auth.ts"
          );


        const token1 =
          generateSessionToken();


        const token2 =
          generateSessionToken();


        assert.equal(
          token1.length,
          64
        );


        assert.equal(
          token2.length,
          64
        );


        assert.notEqual(
          token1,
          token2
        );


        const tokens =
          new Set();


        for (
          let index = 0;
          index < 10;
          index += 1
        ) {
          tokens.add(
            generateSessionToken()
          );
        }


        assert.equal(
          tokens.size,
          10
        );


        console.log(
          "✅ Geração de tokens funcionando"
        );
      }
    );


    test(
      "Validar estrutura de interfaces TypeScript",
      () => {
        const schemaContent =
          readFileSync(
            join(
              process.cwd(),
              "db",
              "schema.ts"
            ),
            "utf8"
          );


        const requiredTables = [
          "users",
          "products",
          "orders",
          "orderItems",
          "questions",
          "simulations",
          "simulationResults",
          "sessions",
          "protectedDownloads",
        ];


        for (
          const table of requiredTables
        ) {
          assert.ok(
            schemaContent.includes(
              `export const ${table}`
            ),
            `Tabela ${table} deve existir`
          );
        }


        console.log(
          "✅ Schema contém todas as tabelas necessárias"
        );
      }
    );


    test(
      "Validar que auth.ts exporta funções necessárias",
      () => {
        const authContent =
          readFileSync(
            join(
              process.cwd(),
              "lib",
              "auth.ts"
            ),
            "utf8"
          );


        const requiredFunctions = [
          "hashPassword",
          "verifyPassword",
          "generateSessionToken",
          "registerUser",
          "authenticateUser",
          "validateSession",
          "logoutSession",
          "cleanupExpiredSessions",
        ];


        for (
          const functionName of requiredFunctions
        ) {
          assert.ok(
            authContent.includes(
              `function ${functionName}`
            ),
            `Função ${functionName} deve estar exportada`
          );
        }


        console.log(
          "✅ auth.ts exporta todas as funções necessárias"
        );
      }
    );


    test(
      "Validar integridade do banco isolado",
      () => {
        const sqlite =
          new Database(
            testEnvironment.databasePath,
            {
              readonly: true,
            }
          );


        try {
          assert.equal(
            sqlite.pragma(
              "integrity_check",
              {
                simple: true,
              }
            ),
            "ok"
          );


          const admin =
            sqlite
              .prepare(`
                SELECT
                  email,
                  role
                FROM users
                WHERE role = 'admin'
                LIMIT 1
              `)
              .get();


          assert.ok(
            admin
          );


          assert.equal(
            admin.role,
            "admin"
          );
        } finally {
          sqlite.close();
        }


        console.log(
          "✅ Banco isolado de autenticação está íntegro"
        );
      }
    );


    after(
      () => {
        testEnvironment?.cleanup();


        console.log(
          "✅ Testes da Fase 1 concluídos sem banco persistente"
        );
      }
    );
  }
);