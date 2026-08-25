import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

describe("Fase 5 - Admin, Contest Pages e JSON Loader", () => {
  before(() => {
    console.log("[PREP] Preparando testes da Fase 5...");
  });

  // ============================================================
  // ESTRUTURA
  // ============================================================

  test("Proxy de protecao existe", () => {
    const proxyPath = join(process.cwd(), "proxy.ts");
    const legacyMiddlewarePath = join(process.cwd(), "middleware.ts");

    assert.ok(
      existsSync(proxyPath),
      "proxy.ts deve existir na raiz do projeto"
    );

    assert.strictEqual(
      existsSync(legacyMiddlewarePath),
      false,
      "middleware.ts legado nao deve existir no Next.js 16"
    );

    console.log("[OK] proxy.ts existe e middleware legado foi removido");
  });

  test("API admin/stats existe", () => {
    const p = join(
      process.cwd(),
      "app",
      "api",
      "admin",
      "stats",
      "route.ts"
    );

    assert.ok(existsSync(p));

    console.log("[OK] API admin/stats existe");
  });

  test("API admin/orders existe", () => {
    const p = join(
      process.cwd(),
      "app",
      "api",
      "admin",
      "orders",
      "route.ts"
    );

    assert.ok(existsSync(p));

    console.log("[OK] API admin/orders existe");
  });

  test("API admin/products existe", () => {
    const p = join(
      process.cwd(),
      "app",
      "api",
      "admin",
      "products",
      "route.ts"
    );

    assert.ok(existsSync(p));

    console.log("[OK] API admin/products existe");
  });

  test("AdminDashboard existe", () => {
    const p = join(
      process.cwd(),
      "components",
      "admin-dashboard.tsx"
    );

    assert.ok(existsSync(p));

    console.log("[OK] AdminDashboard existe");
  });

  test("Pagina /admin existe", () => {
    const p = join(
      process.cwd(),
      "app",
      "admin",
      "page.tsx"
    );

    assert.ok(existsSync(p));

    console.log("[OK] Pagina /admin existe");
  });

  test("Landing page de concurso existe", () => {
    const p = join(
      process.cwd(),
      "app",
      "concurso",
      "[slug]",
      "page.tsx"
    );

    assert.ok(existsSync(p));

    console.log("[OK] Pagina /concurso/[slug] existe");
  });

  test("ContestLanding existe", () => {
    const p = join(
      process.cwd(),
      "components",
      "contest-landing.tsx"
    );

    assert.ok(existsSync(p));

    console.log("[OK] ContestLanding existe");
  });

  test("JSON loader runtime existe", () => {
    const p = join(
      process.cwd(),
      "lib",
      "json-loader-runtime.ts"
    );

    assert.ok(existsSync(p));

    console.log("[OK] JSON loader runtime existe");
  });

  // ============================================================
  // SEGURANCA / PROXY
  // ============================================================

  test(
    "Proxy protege rotas admin",
    async () => {
      const proxyPath =
        join(
          process.cwd(),
          "proxy.ts"
        );


      const content =
        await readFile(
          proxyPath,
          "utf-8"
        );


      assert.ok(
        content.includes(
          "ADMIN_ROUTES"
        ),
        "Proxy deve possuir ADMIN_ROUTES"
      );


      assert.ok(
        content.includes(
          '"/admin"'
        ),
        "Proxy deve proteger /admin"
      );


      /**
       * Não usamos includes() porque o proxy atual
       * segue a formatação multilinha do projeto:
       *
       * meData.user?.role !==
       *   "admin"
       *
       * A regex verifica a semântica independentemente
       * de espaços e quebras de linha.
       */
      assert.match(
        content,
        /meData\.user\?\.role\s*!==\s*["']admin["']/,
        "Proxy deve verificar role admin"
      );


      assert.ok(
        content.includes(
          "/login"
        ),
        "Proxy deve redirecionar usuário não autenticado para login"
      );


      assert.ok(
        content.includes(
          "fd-session"
        ),
        "Proxy deve verificar cookie de sessão"
      );


      /**
       * Depois do hardening 4.4B.2A, falha ao
       * verificar autorização administrativa deve
       * fechar o acesso em vez de liberar a página.
       */
      assert.match(
        content,
        /catch[\s\S]*redirectToLogin/,
        "Proxy administrativo deve falhar fechado"
      );


      assert.match(
        content,
        /meData\.authenticated/,
        "Proxy deve validar a sessão antes da role"
      );


      console.log(
        "[OK] Proxy protege rotas admin"
      );
    }
  );

  // ============================================================
  // APIs ADMIN
  // ============================================================

  test("API admin/stats tem estatisticas completas", async () => {
    const content = await readFile(
      join(
        process.cwd(),
        "app",
        "api",
        "admin",
        "stats",
        "route.ts"
      ),
      "utf-8"
    );

    assert.ok(
      content.includes("totalUsers"),
      "Deve ter totalUsers"
    );

    assert.ok(
      content.includes("totalRevenue"),
      "Deve ter totalRevenue"
    );

    assert.ok(
      content.includes("topProducts"),
      "Deve ter topProducts"
    );

    assert.ok(
      content.includes("salesByDay"),
      "Deve ter salesByDay"
    );

    assert.ok(
      content.includes("signupsByDay"),
      "Deve ter signupsByDay"
    );

    assert.ok(
      content.includes('role !== "admin"'),
      "Deve validar role admin"
    );

    console.log("[OK] API admin/stats completa");
  });

  test("API admin/orders permite atualizar status", async () => {
    const content = await readFile(
      join(
        process.cwd(),
        "app",
        "api",
        "admin",
        "orders",
        "route.ts"
      ),
      "utf-8"
    );

    assert.ok(
      content.includes("export async function PATCH"),
      "Deve ter PATCH"
    );

    assert.ok(
      content.includes("status"),
      "Deve permitir atualizar status"
    );

    assert.ok(
      content.includes("refunded"),
      "Deve suportar reembolso"
    );

    assert.ok(
      content.includes('role !== "admin"'),
      "API de pedidos deve validar role admin"
    );

    console.log(
      "[OK] API admin/orders permite atualizar status"
    );
  });

  test(
    "API admin/products tem CRUD completo",
    async () => {
      const content =
        await readFile(
          join(
            process.cwd(),
            "app",
            "api",
            "admin",
            "products",
            "route.ts"
          ),
          "utf-8"
        );


      assert.ok(
        content.includes(
          "export async function GET"
        ),
        "Deve ter GET"
      );


      assert.ok(
        content.includes(
          "export async function POST"
        ),
        "Deve ter POST"
      );


      assert.ok(
        content.includes(
          "export async function PATCH"
        ),
        "Deve ter PATCH"
      );


      assert.ok(
        content.includes(
          "export async function DELETE"
        ),
        "Deve ter DELETE"
      );


      assert.ok(
        content.includes(
          "authorizeAdminRequest"
        ),
        "API de produtos deve utilizar o guard administrativo central"
      );


      assert.ok(
        content.includes(
          "validateAdminProductCreate"
        ),
        "POST deve validar a entrada administrativa"
      );


      assert.ok(
        content.includes(
          "validateAdminProductPatch"
        ),
        "PATCH deve validar a entrada administrativa"
      );


      assert.ok(
        !content.includes(
          "...body"
        ),
        "API não pode aplicar mass assignment a partir do body"
      );


      console.log(
        "[OK] API admin/products tem CRUD seguro"
      );
    }
  );

  // ============================================================
  // ADMIN DASHBOARD
  // ============================================================

  test("AdminDashboard tem graficos Recharts", async () => {
    const content = await readFile(
      join(
        process.cwd(),
        "components",
        "admin-dashboard.tsx"
      ),
      "utf-8"
    );

    assert.ok(
      content.includes("LineChart"),
      "Deve ter LineChart"
    );

    assert.ok(
      content.includes("BarChart"),
      "Deve ter BarChart"
    );

    assert.ok(
      content.includes("PieChart"),
      "Deve ter PieChart"
    );

    assert.ok(
      content.includes("/api/admin/stats"),
      "Deve chamar API stats"
    );

    console.log(
      "[OK] AdminDashboard tem graficos Recharts"
    );
  });

  // ============================================================
  // CONCURSOS
  // ============================================================

  test("ContestLanding filtra produtos por concurso", async () => {
    const content = await readFile(
      join(
        process.cwd(),
        "components",
        "contest-landing.tsx"
      ),
      "utf-8"
    );

    assert.ok(
      content.includes("contestSlug"),
      "Deve receber contestSlug"
    );

    assert.ok(
      content.includes("products.filter"),
      "Deve filtrar produtos"
    );

    assert.ok(
      content.includes("ProductCard"),
      "Deve usar ProductCard"
    );

    console.log(
      "[OK] ContestLanding filtra produtos por concurso"
    );
  });

  // ============================================================
  // JSON LOADER
  // ============================================================

  test("JSON loader tem funcoes essenciais", async () => {
    const content = await readFile(
      join(
        process.cwd(),
        "lib",
        "json-loader-runtime.ts"
      ),
      "utf-8"
    );

    assert.ok(
      content.includes("loadProductsToDb"),
      "Deve ter loadProductsToDb"
    );

    assert.ok(
      content.includes("watchProductsJson"),
      "Deve ter watchProductsJson"
    );

    assert.ok(
      content.includes("getProductsFromDb"),
      "Deve ter getProductsFromDb"
    );

    assert.ok(
      content.includes("products.json"),
      "Deve ler products.json"
    );

    console.log(
      "[OK] JSON loader tem funcoes essenciais"
    );
  });

  // ============================================================
  // CSS
  // ============================================================

  test("CSS do admin foi adicionado", async () => {
    const content = await readFile(
      join(
        process.cwd(),
        "app",
        "extra.css"
      ),
      "utf-8"
    );

    assert.ok(
      content.includes(".admin-page"),
      "Deve ter .admin-page"
    );

    assert.ok(
      content.includes(".stats-grid"),
      "Deve ter .stats-grid"
    );

    assert.ok(
      content.includes(".admin-table"),
      "Deve ter .admin-table"
    );

    assert.ok(
      content.includes(".chart-card"),
      "Deve ter .chart-card"
    );

    console.log(
      "[OK] CSS do admin adicionado"
    );
  });

  test("CSS do contest foi adicionado", async () => {
    const content = await readFile(
      join(
        process.cwd(),
        "app",
        "extra.css"
      ),
      "utf-8"
    );

    assert.ok(
      content.includes(".contest-hero"),
      "Deve ter .contest-hero"
    );

    assert.ok(
      content.includes(".contest-stats"),
      "Deve ter .contest-stats"
    );

    console.log(
      "[OK] CSS do contest adicionado"
    );
  });

  // ============================================================
  // REGRESSAO
  // ============================================================

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
      "proxy.ts",
    ];

    for (const path of checks) {
      assert.ok(
        existsSync(
          join(process.cwd(), path)
        ),
        `${path} deve existir`
      );
    }

    console.log(
      "[OK] Fases anteriores preservadas"
    );
  });

  after(() => {
    console.log(
      "[OK] Testes da Fase 5 concluidos!"
    );
  });
});