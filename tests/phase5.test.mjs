import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

describe("Fase 5 - Admin, Contest Pages e JSON Loader", () => {
  before(() => {
    console.log("[PREP] Preparando testes da Fase 5...");
  });

  // === ESTRUTURA ===

  test("Middleware de protecao existe", () => {
    const p = join(process.cwd(), "middleware.ts");
    assert.ok(existsSync(p));
    console.log("[OK] middleware.ts existe");
  });

  test("API admin/stats existe", () => {
    const p = join(process.cwd(), "app", "api", "admin", "stats", "route.ts");
    assert.ok(existsSync(p));
    console.log("[OK] API admin/stats existe");
  });

  test("API admin/orders existe", () => {
    const p = join(process.cwd(), "app", "api", "admin", "orders", "route.ts");
    assert.ok(existsSync(p));
    console.log("[OK] API admin/orders existe");
  });

  test("API admin/products existe", () => {
    const p = join(process.cwd(), "app", "api", "admin", "products", "route.ts");
    assert.ok(existsSync(p));
    console.log("[OK] API admin/products existe");
  });

  test("AdminDashboard existe", () => {
    const p = join(process.cwd(), "components", "admin-dashboard.tsx");
    assert.ok(existsSync(p));
    console.log("[OK] AdminDashboard existe");
  });

  test("Pagina /admin existe", () => {
    const p = join(process.cwd(), "app", "admin", "page.tsx");
    assert.ok(existsSync(p));
    console.log("[OK] Pagina /admin existe");
  });

  test("Landing page de concurso existe", () => {
    const p = join(process.cwd(), "app", "concurso", "[slug]", "page.tsx");
    assert.ok(existsSync(p));
    console.log("[OK] Pagina /concurso/[slug] existe");
  });

  test("ContestLanding existe", () => {
    const p = join(process.cwd(), "components", "contest-landing.tsx");
    assert.ok(existsSync(p));
    console.log("[OK] ContestLanding existe");
  });

  test("JSON loader runtime existe", () => {
    const p = join(process.cwd(), "lib", "json-loader-runtime.ts");
    assert.ok(existsSync(p));
    console.log("[OK] JSON loader runtime existe");
  });

  // === CONTEUDO ===

  test("Middleware protege rotas admin", async () => {
    const c = await readFile(join(process.cwd(), "middleware.ts"), "utf-8");
    assert.ok(c.includes("ADMIN_ROUTES"), "Deve ter ADMIN_ROUTES");
    assert.ok(c.includes('"/admin"'), "Deve proteger /admin");
    assert.ok(c.includes("role !== \"admin\""), "Deve verificar role admin");
    assert.ok(c.includes("/login"), "Deve redirecionar para login");
    console.log("[OK] Middleware protege rotas admin");
  });

  test("API admin/stats tem estatisticas completas", async () => {
    const c = await readFile(
      join(process.cwd(), "app", "api", "admin", "stats", "route.ts"),
      "utf-8"
    );
    assert.ok(c.includes("totalUsers"), "Deve ter totalUsers");
    assert.ok(c.includes("totalRevenue"), "Deve ter totalRevenue");
    assert.ok(c.includes("topProducts"), "Deve ter topProducts");
    assert.ok(c.includes("salesByDay"), "Deve ter salesByDay");
    assert.ok(c.includes("signupsByDay"), "Deve ter signupsByDay");
    assert.ok(c.includes("role !== \"admin\""), "Deve validar role admin");
    console.log("[OK] API admin/stats completa");
  });

  test("API admin/orders permite atualizar status", async () => {
    const c = await readFile(
      join(process.cwd(), "app", "api", "admin", "orders", "route.ts"),
      "utf-8"
    );
    assert.ok(c.includes("export async function PATCH"), "Deve ter PATCH");
    assert.ok(c.includes("status"), "Deve permitir atualizar status");
    assert.ok(c.includes("refunded"), "Deve suportar reembolso");
    console.log("[OK] API admin/orders permite atualizar status");
  });

  test("API admin/products tem CRUD completo", async () => {
    const c = await readFile(
      join(process.cwd(), "app", "api", "admin", "products", "route.ts"),
      "utf-8"
    );
    assert.ok(c.includes("export async function GET"), "Deve ter GET");
    assert.ok(c.includes("export async function POST"), "Deve ter POST");
    assert.ok(c.includes("export async function PATCH"), "Deve ter PATCH");
    assert.ok(c.includes("export async function DELETE"), "Deve ter DELETE");
    console.log("[OK] API admin/products tem CRUD completo");
  });

  test("AdminDashboard tem graficos Recharts", async () => {
    const c = await readFile(
      join(process.cwd(), "components", "admin-dashboard.tsx"),
      "utf-8"
    );
    assert.ok(c.includes("LineChart"), "Deve ter LineChart");
    assert.ok(c.includes("BarChart"), "Deve ter BarChart");
    assert.ok(c.includes("PieChart"), "Deve ter PieChart");
    assert.ok(c.includes("/api/admin/stats"), "Deve chamar API stats");
    console.log("[OK] AdminDashboard tem graficos Recharts");
  });

  test("ContestLanding filtra produtos por concurso", async () => {
    const c = await readFile(
      join(process.cwd(), "components", "contest-landing.tsx"),
      "utf-8"
    );
    assert.ok(c.includes("contestSlug"), "Deve receber contestSlug");
    assert.ok(c.includes("products.filter"), "Deve filtrar produtos");
    assert.ok(c.includes("ProductCard"), "Deve usar ProductCard");
    console.log("[OK] ContestLanding filtra produtos por concurso");
  });

  test("JSON loader tem funcoes essenciais", async () => {
    const c = await readFile(
      join(process.cwd(), "lib", "json-loader-runtime.ts"),
      "utf-8"
    );
    assert.ok(c.includes("loadProductsToDb"), "Deve ter loadProductsToDb");
    assert.ok(c.includes("watchProductsJson"), "Deve ter watchProductsJson");
    assert.ok(c.includes("getProductsFromDb"), "Deve ter getProductsFromDb");
    assert.ok(c.includes("products.json"), "Deve ler products.json");
    console.log("[OK] JSON loader tem funcoes essenciais");
  });

  // === CSS ===

  test("CSS do admin foi adicionado", async () => {
    const c = await readFile(join(process.cwd(), "app", "extra.css"), "utf-8");
    assert.ok(c.includes(".admin-page"), "Deve ter .admin-page");
    assert.ok(c.includes(".stats-grid"), "Deve ter .stats-grid");
    assert.ok(c.includes(".admin-table"), "Deve ter .admin-table");
    assert.ok(c.includes(".chart-card"), "Deve ter .chart-card");
    console.log("[OK] CSS do admin adicionado");
  });

  test("CSS do contest foi adicionado", async () => {
    const c = await readFile(join(process.cwd(), "app", "extra.css"), "utf-8");
    assert.ok(c.includes(".contest-hero"), "Deve ter .contest-hero");
    assert.ok(c.includes(".contest-stats"), "Deve ter .contest-stats");
    console.log("[OK] CSS do contest adicionado");
  });

  // === REGRESSAO ===

  test("Fases anteriores preservadas", () => {
    const checks = [
      "lib/auth.ts",
      "components/auth-provider.tsx",
      "components/student-dashboard.tsx",
      "components/simulation-quiz.tsx",
      "components/checkout-real.tsx",
      "lib/mercadopago.ts",
      "lib/pdf-protection.ts",
      "app/api/orders/route.ts",
      "app/api/simulations/route.ts",
    ];
    for (const path of checks) {
      assert.ok(existsSync(join(process.cwd(), path)), `${path} deve existir`);
    }
    console.log("[OK] Fases anteriores preservadas");
  });

  after(() => {
    console.log("[OK] Testes da Fase 5 concluidos!");
  });
});