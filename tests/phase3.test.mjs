import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";

describe("Fase 3A - Schema, Pedidos e Dashboard", () => {
  before(() => {
    console.log("🧪 Preparando testes da Fase 3A...");
  });

  // === TESTES DE ESTRUTURA ===

  test("Schema Drizzle está completo", async () => {
    const schemaPath = join(process.cwd(), "db", "schema.ts");
    assert.ok(existsSync(schemaPath), "schema.ts deve existir");

    const content = await readFile(schemaPath, "utf-8");
    const requiredTables = [
      "users", "products", "orders", "orderItems",
      "questions", "simulations", "simulationResults",
      "sessions", "protectedDownloads"
    ];
    for (const table of requiredTables) {
      assert.ok(
        content.includes(`sqliteTable("${table}"`) || content.includes(`export const ${table}`),
        `Tabela ${table} deve estar no schema`
      );
    }
    console.log("✅ Schema completo com todas as 9 tabelas");
  });

  test("API de pedidos existe", () => {
    const path = join(process.cwd(), "app", "api", "orders", "route.ts");
    assert.ok(existsSync(path), "app/api/orders/route.ts deve existir");
    console.log("✅ API de pedidos existe");
  });

  test("lib/orders.ts existe", () => {
    const path = join(process.cwd(), "lib", "orders.ts");
    assert.ok(existsSync(path), "lib/orders.ts deve existir");
    console.log("✅ lib/orders.ts existe");
  });

  test("StudentDashboard existe", () => {
    const path = join(process.cwd(), "components", "student-dashboard.tsx");
    assert.ok(existsSync(path), "components/student-dashboard.tsx deve existir");
    console.log("✅ StudentDashboard existe");
  });

  test("seed-orders.ts existe", () => {
    const path = join(process.cwd(), "db", "seed-orders.ts");
    assert.ok(existsSync(path), "db/seed-orders.ts deve existir");
    console.log("✅ seed-orders.ts existe");
  });

  // === TESTES DE CONTEÚDO ===

  test("API orders tem GET e POST", async () => {
    const content = await readFile(join(process.cwd(), "app", "api", "orders", "route.ts"), "utf-8");
    assert.ok(content.includes("export async function GET"), "Deve exportar GET");
    assert.ok(content.includes("export async function POST"), "Deve exportar POST");
    assert.ok(content.includes("validateSession"), "Deve validar sessão");
    assert.ok(content.includes("APROVA10"), "Deve suportar cupom APROVA10");
    console.log("✅ API orders tem GET e POST com validações");
  });

  test("StudentDashboard tem as 3 abas", async () => {
    const content = await readFile(join(process.cwd(), "components", "student-dashboard.tsx"), "utf-8");
    assert.ok(content.includes('"biblioteca"'), "Deve ter aba biblioteca");
    assert.ok(content.includes('"pedidos"'), "Deve ter aba pedidos");
    assert.ok(content.includes('"perfil"'), "Deve ter aba perfil");
    assert.ok(content.includes("/api/orders"), "Deve chamar /api/orders");
    assert.ok(content.includes("formatPrice"), "Deve formatar preços");
    console.log("✅ StudentDashboard tem biblioteca, pedidos e perfil");
  });

  test("minha-conta usa StudentDashboard", async () => {
    const content = await readFile(join(process.cwd(), "app", "minha-conta", "page.tsx"), "utf-8");
    assert.ok(content.includes("StudentDashboard"), "Deve importar StudentDashboard");
    assert.ok(!content.includes("products[0]"), "Não deve mais usar produtos hardcoded");
    console.log("✅ minha-conta usa dashboard real");
  });

  test("CSS do dashboard foi adicionado", async () => {
    const content = await readFile(join(process.cwd(), "app", "extra.css"), "utf-8");
    assert.ok(content.includes(".student-stats-mini"), "Deve ter .student-stats-mini");
    assert.ok(content.includes(".library-grid"), "Deve ter .library-grid");
    assert.ok(content.includes(".order-card"), "Deve ter .order-card");
    assert.ok(content.includes(".status-approved"), "Deve ter .status-approved");
    assert.ok(content.includes(".profile-card"), "Deve ter .profile-card");
    console.log("✅ CSS do dashboard adicionado");
  });

  test("seed-orders.ts cria pedidos com produtos", async () => {
    const content = await readFile(join(process.cwd(), "db", "seed-orders.ts"), "utf-8");
    assert.ok(content.includes("orders"), "Deve inserir em orders");
    assert.ok(content.includes("orderItems"), "Deve inserir em orderItems");
    assert.ok(content.includes("admin"), "Deve usar admin para pedidos");
    console.log("✅ seed-orders.ts tem lógica completa");
  });

  // === TESTES DE INTEGRAÇÃO ===

  test("Executar seed de pedidos", () => {
    try {
      const result = execSync("npx tsx db/seed-orders.ts", {
        encoding: "utf-8",
        stdio: "pipe",
      });
      const success = result.includes("concluído") || result.includes("Pulando");
      assert.ok(success, "Seed de pedidos deve executar sem erros");
      console.log("✅ Seed de pedidos executado");
    } catch (error) {
      console.error("Saída:", error.stdout || error.message);
      throw error;
    }
  });

  test("Banco tem pedidos após seed", () => {
    const dbPath = join(process.cwd(), "data", "dev.db");
    if (!existsSync(dbPath)) {
      console.log("⚠️  Banco não encontrado (pulando)");
      return;
    }

    const count = execSync(
      `sqlite3 ${dbPath} "SELECT COUNT(*) FROM orders;"`,
      { encoding: "utf-8" }
    ).trim();

    assert.ok(parseInt(count) > 0, "Deve haver pedidos no banco");
    console.log(`✅ Banco tem ${count} pedido(s)`);
  });

  test("Banco tem itens de pedidos após seed", () => {
    const dbPath = join(process.cwd(), "data", "dev.db");
    if (!existsSync(dbPath)) {
      console.log("⚠️  Banco não encontrado (pulando)");
      return;
    }

    const count = execSync(
      `sqlite3 ${dbPath} "SELECT COUNT(*) FROM order_items;"`,
      { encoding: "utf-8" }
    ).trim();

    assert.ok(parseInt(count) > 0, "Deve haver itens de pedidos no banco");
    console.log(`✅ Banco tem ${count} item(ns) de pedido`);
  });

  test("Fluxo completo: criar pedido via API simulado", () => {
    const dbPath = join(process.cwd(), "data", "dev.db");
    if (!existsSync(dbPath)) {
      console.log("⚠️  Banco não encontrado (pulando)");
      return;
    }

    const testScript = `
      process.removeAllListeners('warning');
      import { initDatabase } from "../db/init.js";
      import { getDb } from "../db/index.js";
      import { users, orders, orderItems, products } from "../db/schema.js";
      import { eq } from "drizzle-orm";

      await initDatabase();
      const db = getDb();

      // 1. Buscar admin
      const admin = await db.select().from(users).where(eq(users.email, "digicopiamix@facildigitalmais.com")).get();
      if (!admin) {
        console.log("NOADMIN");
        process.exit(1);
      }
      console.log("ADMIN:OK:" + admin.id);

      // 2. Buscar produto
      const product = await db.select().from(products).limit(1).get();
      if (!product) {
        console.log("NOPROD");
        process.exit(1);
      }
      console.log("PRODUCT:OK:" + product.slug);

      // 3. Contar pedidos antes
      const beforeCount = (await db.select().from(orders).all()).length;

      // 4. Criar pedido manual
      const orderResult = await db.insert(orders).values({
        userId: admin.id,
        status: "approved",
        paymentMethod: "pix",
        subtotal: product.price,
        discount: 0,
        total: product.pixPrice || product.price,
      }).returning();

      if (orderResult[0]) {
        await db.insert(orderItems).values({
          orderId: orderResult[0].id,
          productId: product.id,
          quantity: 1,
          unitPrice: product.pixPrice || product.price,
        });
        console.log("ORDER:OK:" + orderResult[0].id);
      }

      // 5. Verificar quantidade aumentou
      const afterCount = (await db.select().from(orders).all()).length;
      if (afterCount > beforeCount) {
        console.log("COUNT:OK:" + afterCount);
      }

      process.exit(0);
    `;

    const tmpFile = join(process.cwd(), "tests", "_tmp_order_test.ts");

    // Limpar arquivo temporário antes (caso exista de execução anterior)
    try {
      if (existsSync(tmpFile)) unlinkSync(tmpFile);
    } catch {}

    try {
      writeFileSync(tmpFile, testScript);

      let result = "";
      try {
        result = execSync(`npx tsx --no-warnings ${tmpFile}`, {
          encoding: "utf-8",
          stdio: "pipe",
          env: { ...process.env, NODE_NO_WARNINGS: "1" },
          timeout: 30000,
        });
      } catch (execError) {
        result = (execError.stdout || "") + (execError.stderr || "");
        if (result.includes("Error:") || result.includes("ERR_")) {
          throw new Error("Subprocesso falhou: " + result.substring(0, 500));
        }
      }

      assert.ok(result.includes("ADMIN:OK"), "Admin deve existir. Saída: " + result);
      assert.ok(result.includes("PRODUCT:OK"), "Produto deve existir");
      assert.ok(result.includes("ORDER:OK"), "Pedido deve ser criado");
      assert.ok(result.includes("COUNT:OK"), "Contagem deve aumentar");

      console.log("✅ Fluxo de criação de pedido funciona");
    } catch (error) {
      try {
        if (existsSync(tmpFile)) unlinkSync(tmpFile);
      } catch {}
      throw error;
    } finally {
      try {
        if (existsSync(tmpFile)) unlinkSync(tmpFile);
      } catch {}
    }
  });

  // === TESTES DE REGRESSÃO ===

  test("Fase 1: auth.ts ainda funciona", async () => {
    const content = await readFile(join(process.cwd(), "lib", "auth.ts"), "utf-8");
    assert.ok(content.includes("hashPassword"), "auth.ts deve ter hashPassword");
    assert.ok(content.includes("validateSession"), "auth.ts deve ter validateSession");
    console.log("✅ Fase 1 preservada: auth.ts intacto");
  });

  test("Fase 2: API routes de auth ainda existem", () => {
    const routes = ["login", "register", "logout", "me"];
    for (const route of routes) {
      const path = join(process.cwd(), "app", "api", "auth", route, "route.ts");
      assert.ok(existsSync(path), `API auth/${route} deve existir`);
    }
    console.log("✅ Fase 2 preservada: todas as APIs de auth intactas");
  });

  after(() => {
    console.log("✅ Testes da Fase 3A concluídos!");
  });
});