import {
  after,
  before,
  describe,
  test,
} from "node:test";

import assert from "node:assert";

import {
  existsSync,
} from "node:fs";

import {
  readFile,
} from "node:fs/promises";

import {
  join,
} from "node:path";

import Database from "better-sqlite3";

import {
  eq,
} from "drizzle-orm";

import {
  getDb,
} from "../db/index.ts";

import {
  orderItems,
  orders,
  products,
  users,
} from "../db/schema.ts";

import {
  seedTestOrders,
} from "../db/seed-orders.ts";

import {
  createIsolatedDatabase,
} from "./helpers/isolated-database.mjs";


describe(
  "Fase 3A - Schema, Pedidos e Dashboard",
  () => {
    let testEnvironment;


    before(
      async () => {
        console.log(
          "🧪 Preparando testes da Fase 3A..."
        );


        /**
         * Banco completamente descartável.
         *
         * Precisamos inicialmente apenas de:
         *
         * - migrations;
         * - admin;
         * - catálogo.
         *
         * O seed de pedidos continua sendo executado pelo
         * teste específico abaixo.
         */
        testEnvironment =
          await createIsolatedDatabase({
            admin: true,
            products: true,
          });


        console.log(
          `🧪 SQLite isolado: ${testEnvironment.databasePath}`
        );
      }
    );


    // ==========================================================
    // ESTRUTURA
    // ==========================================================

    test(
      "Schema Drizzle está completo",
      async () => {
        const schemaPath =
          join(
            process.cwd(),
            "db",
            "schema.ts"
          );


        assert.ok(
          existsSync(
            schemaPath
          ),
          "schema.ts deve existir"
        );


        const content =
          await readFile(
            schemaPath,
            "utf-8"
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
            content.includes(
              `sqliteTable("${table}"`
            ) ||
              content.includes(
                `export const ${table}`
              ),
            `Tabela ${table} deve estar no schema`
          );
        }


        console.log(
          "✅ Schema completo com todas as 9 tabelas"
        );
      }
    );


    test(
      "API de pedidos existe",
      () => {
        const path =
          join(
            process.cwd(),
            "app",
            "api",
            "orders",
            "route.ts"
          );


        assert.ok(
          existsSync(path),
          "app/api/orders/route.ts deve existir"
        );


        console.log(
          "✅ API de pedidos existe"
        );
      }
    );


    test(
      "lib/orders.ts existe",
      () => {
        const path =
          join(
            process.cwd(),
            "lib",
            "orders.ts"
          );


        assert.ok(
          existsSync(path),
          "lib/orders.ts deve existir"
        );


        console.log(
          "✅ lib/orders.ts existe"
        );
      }
    );


    test(
      "StudentDashboard existe",
      () => {
        const path =
          join(
            process.cwd(),
            "components",
            "student-dashboard.tsx"
          );


        assert.ok(
          existsSync(path),
          "components/student-dashboard.tsx deve existir"
        );


        console.log(
          "✅ StudentDashboard existe"
        );
      }
    );


    test(
      "seed-orders.ts existe",
      () => {
        const path =
          join(
            process.cwd(),
            "db",
            "seed-orders.ts"
          );


        assert.ok(
          existsSync(path),
          "db/seed-orders.ts deve existir"
        );


        console.log(
          "✅ seed-orders.ts existe"
        );
      }
    );


    // ==========================================================
    // CONTEÚDO
    // ==========================================================

    test(
      "API orders deve ser somente leitura",
      async () => {
        const content =
          await readFile(
            join(
              process.cwd(),
              "app",
              "api",
              "orders",
              "route.ts"
            ),
            "utf-8"
          );


        assert.ok(
          content.includes(
            "export async function GET"
          ),
          "Deve exportar GET"
        );


        assert.ok(
          !content.includes(
            "export async function POST"
          ),
          "POST /api/orders não pode criar pedidos diretamente"
        );


        assert.ok(
          content.includes(
            "validateSession"
          ),
          "GET deve validar sessão"
        );


        assert.ok(
          !content.includes(
            'status: "approved"'
          ),
          "API de histórico não pode aprovar pedidos"
        );


        console.log(
          "✅ API orders é somente leitura e exige autenticação"
        );
      }
    );


    test(
      "StudentDashboard tem as 3 abas",
      async () => {
        const content =
          await readFile(
            join(
              process.cwd(),
              "components",
              "student-dashboard.tsx"
            ),
            "utf-8"
          );


        assert.ok(
          content.includes(
            '"biblioteca"'
          )
        );


        assert.ok(
          content.includes(
            '"pedidos"'
          )
        );


        assert.ok(
          content.includes(
            '"perfil"'
          )
        );


        assert.ok(
          content.includes(
            "/api/orders"
          )
        );


        assert.ok(
          content.includes(
            "formatPrice"
          )
        );


        console.log(
          "✅ StudentDashboard tem biblioteca, pedidos e perfil"
        );
      }
    );


    test(
      "StudentDashboard libera biblioteca somente para pedidos approved e sinaliza chargeback",
      async () => {
        const content =
          await readFile(
            join(
              process.cwd(),
              "components",
              "student-dashboard.tsx"
            ),
            "utf-8"
          );


        /**
         * A biblioteca do aluno representa
         * entitlement ativo.
         *
         * O histórico pode conter qualquer status,
         * mas somente pedidos approved podem gerar
         * materiais disponíveis para acesso.
         */
        assert.match(
          content,
          /const\s+purchasedProducts\s*=\s*orders[\s\S]*?\.filter\s*\([\s\S]*?order\.status\s*===\s*["']approved["'][\s\S]*?\)\s*\.flatMap/,
          "Biblioteca deve filtrar pedidos approved antes de mapear os produtos"
        );


        /**
         * Chargeback deve continuar visível no
         * histórico financeiro do aluno com uma
         * mensagem compreensível.
         */
        assert.match(
          content,
          /charged_back:\s*["']Pagamento contestado["']/,
          "Aluno deve visualizar charged_back como Pagamento contestado"
        );


        /**
         * Enquanto não houver estilo exclusivo,
         * chargeback reutiliza a aparência visual
         * de entitlement financeiro revogado.
         */
        assert.match(
          content,
          /charged_back:\s*["']status-refunded["']/,
          "Chargeback deve utilizar classe visual de estado revogado"
        );


        /**
         * O contador de materiais também deve ser
         * derivado da biblioteca já filtrada, para
         * não contar produtos cujo acesso foi
         * revogado.
         */
        assert.match(
          content,
          /const\s+totalProducts\s*=\s*purchasedProducts\.length/,
          "Quantidade de materiais deve considerar somente entitlement ativo"
        );


        console.log(
          "✅ StudentDashboard revoga biblioteca em refund/chargeback e preserva histórico financeiro"
        );
      }
    );


    test(
      "minha-conta usa StudentDashboard",
      async () => {
        const content =
          await readFile(
            join(
              process.cwd(),
              "app",
              "minha-conta",
              "page.tsx"
            ),
            "utf-8"
          );


        assert.ok(
          content.includes(
            "StudentDashboard"
          )
        );


        assert.ok(
          !content.includes(
            "products[0]"
          )
        );


        console.log(
          "✅ minha-conta usa dashboard real"
        );
      }
    );


    test(
      "CSS do dashboard foi adicionado",
      async () => {
        const content =
          await readFile(
            join(
              process.cwd(),
              "app",
              "extra.css"
            ),
            "utf-8"
          );


        const requiredClasses = [
          ".student-stats-mini",
          ".library-grid",
          ".order-card",
          ".status-approved",
          ".profile-card",
        ];


        for (
          const className of requiredClasses
        ) {
          assert.ok(
            content.includes(
              className
            ),
            `CSS deve conter ${className}`
          );
        }


        console.log(
          "✅ CSS do dashboard adicionado"
        );
      }
    );


    test(
      "seed-orders.ts cria pedidos com produtos",
      async () => {
        const content =
          await readFile(
            join(
              process.cwd(),
              "db",
              "seed-orders.ts"
            ),
            "utf-8"
          );


        assert.ok(
          content.includes(
            "orders"
          )
        );


        assert.ok(
          content.includes(
            "orderItems"
          )
        );


        assert.ok(
          content.includes(
            "admin"
          )
        );


        console.log(
          "✅ seed-orders.ts tem lógica completa"
        );
      }
    );


    // ==========================================================
    // INTEGRAÇÃO — SOMENTE SQLITE TEMPORÁRIO
    // ==========================================================

    test(
      "Executar seed de pedidos no banco isolado",
      async () => {
        await seedTestOrders();


        const sqlite =
          new Database(
            testEnvironment.databasePath,
            {
              readonly: true,
            }
          );


        try {
          const count =
            sqlite
              .prepare(
                "SELECT COUNT(*) AS total FROM orders"
              )
              .get();


          assert.ok(
            Number(
              count.total
            ) > 0,
            "Seed deve criar pedidos no SQLite temporário"
          );
        } finally {
          sqlite.close();
        }


        console.log(
          "✅ Seed de pedidos executado no SQLite temporário"
        );
      }
    );


    test(
      "Banco isolado tem pedidos após seed",
      () => {
        const sqlite =
          new Database(
            testEnvironment.databasePath,
            {
              readonly: true,
            }
          );


        try {
          const row =
            sqlite
              .prepare(
                "SELECT COUNT(*) AS total FROM orders"
              )
              .get();


          const count =
            Number(
              row.total
            );


          assert.ok(
            count > 0,
            "Deve haver pedidos no banco de teste"
          );


          console.log(
            `✅ Banco isolado tem ${count} pedido(s)`
          );
        } finally {
          sqlite.close();
        }
      }
    );


    test(
      "Banco isolado tem itens de pedidos após seed",
      () => {
        const sqlite =
          new Database(
            testEnvironment.databasePath,
            {
              readonly: true,
            }
          );


        try {
          const row =
            sqlite
              .prepare(
                "SELECT COUNT(*) AS total FROM order_items"
              )
              .get();


          const count =
            Number(
              row.total
            );


          assert.ok(
            count > 0,
            "Deve haver itens de pedidos no banco de teste"
          );


          console.log(
            `✅ Banco isolado tem ${count} item(ns) de pedido`
          );
        } finally {
          sqlite.close();
        }
      }
    );


    test(
      "Fluxo completo: criar pedido no banco isolado",
      async () => {
        const db =
          getDb();


        const admin =
          await db
            .select()
            .from(
              users
            )
            .where(
              eq(
                users.email,
                "digicopiamix@facildigitalmais.com"
              )
            )
            .get();


        assert.ok(
          admin,
          "Admin deve existir"
        );


        const product =
          await db
            .select()
            .from(
              products
            )
            .limit(1)
            .get();


        assert.ok(
          product,
          "Produto deve existir"
        );


        const beforeCount =
          (
            await db
              .select()
              .from(
                orders
              )
              .all()
          ).length;


        const orderResult =
          await db
            .insert(
              orders
            )
            .values({
              userId:
                admin.id,

              status:
                "approved",

              paymentMethod:
                "pix",

              subtotal:
                product.price,

              discount:
                0,

              total:
                product.price,
            })
            .returning();


        const createdOrder =
          orderResult[0];


        assert.ok(
          createdOrder,
          "Pedido deve ser criado"
        );


        await db
          .insert(
            orderItems
          )
          .values({
            orderId:
              createdOrder.id,

            productId:
              product.id,

            quantity:
              1,

            unitPrice:
              product.price,
          });


        const afterCount =
          (
            await db
              .select()
              .from(
                orders
              )
              .all()
          ).length;


        assert.equal(
          afterCount,
          beforeCount + 1,
          "A criação deve aumentar a quantidade de pedidos em 1"
        );


        console.log(
          "✅ Fluxo de criação de pedido funciona no SQLite temporário"
        );
      }
    );


    // ==========================================================
    // REGRESSÃO
    // ==========================================================

    test(
      "Fase 1: auth.ts ainda funciona",
      async () => {
        const content =
          await readFile(
            join(
              process.cwd(),
              "lib",
              "auth.ts"
            ),
            "utf-8"
          );


        assert.ok(
          content.includes(
            "hashPassword"
          )
        );


        assert.ok(
          content.includes(
            "validateSession"
          )
        );


        console.log(
          "✅ Fase 1 preservada: auth.ts intacto"
        );
      }
    );


    test(
      "Fase 2: API routes de auth ainda existem",
      () => {
        const routes = [
          "login",
          "register",
          "logout",
          "me",
        ];


        for (
          const route of routes
        ) {
          const path =
            join(
              process.cwd(),
              "app",
              "api",
              "auth",
              route,
              "route.ts"
            );


          assert.ok(
            existsSync(path),
            `API auth/${route} deve existir`
          );
        }


        console.log(
          "✅ Fase 2 preservada: todas as APIs de auth intactas"
        );
      }
    );


    after(
      () => {
        testEnvironment?.cleanup();


        console.log(
          "✅ Testes da Fase 3A concluídos sem tocar data/dev.db!"
        );
      }
    );
  }
);