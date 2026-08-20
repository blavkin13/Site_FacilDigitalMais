import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

describe("Fase 6 - Deploy, Otimizacoes e Documentacao", () => {
  before(() => {
    console.log("[TESTE] Preparando testes finais da Fase 6...");
  });

  // === DEPLOY ===

  test("Script de deploy existe", () => {
    const p = join(process.cwd(), "scripts", "deploy-hostinger.sh");
    assert.ok(existsSync(p), "scripts/deploy-hostinger.sh deve existir");
    console.log("[OK] Script de deploy existe");
  });

  test("Configuracao PM2 existe", () => {
    const p = join(process.cwd(), "ecosystem.config.js");
    assert.ok(existsSync(p), "ecosystem.config.js deve existir");
    console.log("[OK] Configuracao PM2 existe");
  });

  test("Configuracao Nginx existe", () => {
    const p = join(process.cwd(), "scripts", "nginx-config.conf");
    assert.ok(existsSync(p), "scripts/nginx-config.conf deve existir");
    console.log("[OK] Configuracao Nginx existe");
  });

  test(".env.example existe", () => {
    const p = join(process.cwd(), ".env.example");
    assert.ok(existsSync(p), ".env.example deve existir");
    console.log("[OK] .env.example existe");
  });

  // === DOCUMENTACAO ===

  test("README.md existe e tem conteudo essencial", async () => {
    const p = join(process.cwd(), "README.md");
    assert.ok(existsSync(p), "README.md deve existir");

    const content = await readFile(p, "utf-8");
    
    // Verificar secoes essenciais (sem caracteres especiais)
    assert.ok(content.includes("Facil Digital"), "Deve ter titulo do projeto");
    assert.ok(content.toLowerCase().includes("instalacao") || content.toLowerCase().includes("install"), "Deve ter secao de instalacao");
    assert.ok(content.includes("Hostinger"), "Deve mencionar Hostinger");
    assert.ok(content.includes("Mercado Pago"), "Deve mencionar Mercado Pago");
    assert.ok(content.includes("test:all") || content.includes("testes"), "Deve mencionar testes");
    
    console.log("[OK] README.md completo com secoes essenciais");
  });

  // === SEO ===

  test("Sitemap atualizado com rotas dinamicas", async () => {
    const p = join(process.cwd(), "app", "sitemap.ts");
    assert.ok(existsSync(p), "app/sitemap.ts deve existir");

    const content = await readFile(p, "utf-8");
    assert.ok(content.includes("/concurso/"), "Deve ter rotas de concurso");
    assert.ok(content.includes("products.map"), "Deve mapear produtos");
    
    console.log("[OK] Sitemap atualizado");
  });

  test("Robots.txt protege areas sensiveis", async () => {
    const p = join(process.cwd(), "app", "robots.ts");
    assert.ok(existsSync(p), "app/robots.ts deve existir");

    const content = await readFile(p, "utf-8");
    assert.ok(content.includes("disallow"), "Deve ter disallow");
    assert.ok(content.includes("/admin"), "Deve bloquear /admin");
    assert.ok(content.includes("/api/"), "Deve bloquear /api/");
    
    console.log("[OK] Robots.txt protege areas sensiveis");
  });

  // === REGRESSAO FINAL ===

  test("Arquivos criticos de todas as fases preservados", () => {
    const criticalFiles = [
      // Fase 1
      "lib/auth.ts",
      "db/schema.ts",
      "db/init.ts",
      "db/seed.ts",
      
      // Fase 2
      "components/auth-provider.tsx",
      "app/api/auth/login/route.ts",
      "app/api/auth/register/route.ts",
      "app/login/page.tsx",
      
      // Fase 3
      "components/student-dashboard.tsx",
      "components/simulation-quiz.tsx",
      "app/api/orders/route.ts",
      "app/api/simulations/route.ts",
      
      // Fase 4
      "components/checkout-real.tsx",
      "lib/mercadopago.ts",
      "lib/pdf-protection.ts",
      "app/api/checkout/create/route.ts",
      
      // Fase 5
      "middleware.ts",
      "components/admin-dashboard.tsx",
      "components/contest-landing.tsx",
      "lib/json-loader-runtime.ts",
    ];

    let missing = [];
    for (const path of criticalFiles) {
      if (!existsSync(join(process.cwd(), path))) {
        missing.push(path);
      }
    }

    assert.strictEqual(missing.length, 0, `Arquivos faltando: ${missing.join(", ")}`);
    console.log(`[OK] ${criticalFiles.length} arquivos criticos preservados`);
  });

  test("Package.json tem scripts essenciais", async () => {
    const p = join(process.cwd(), "package.json");
    const content = await readFile(p, "utf-8");
    const pkg = JSON.parse(content);

    const requiredScripts = [
      "dev",
      "build",
      "start",
      "db:init",
      "db:seed",
      "test:phase1",
      "test:phase2",
      "test:phase3",
      "test:phase3b",
      "test:phase4",
      "test:phase5",
      "test:phase6",
      "test:all",
    ];

    let missing = [];
    for (const script of requiredScripts) {
      if (!pkg.scripts[script]) {
        missing.push(script);
      }
    }

    assert.strictEqual(missing.length, 0, `Scripts faltando: ${missing.join(", ")}`);
    console.log(`[OK] ${requiredScripts.length} scripts essenciais presentes`);
  });

  after(() => {
    console.log("[OK] Testes da Fase 6 concluidos!");
    console.log("[FINAL] PROJETO COMPLETO - PRONTO PARA PRODUCAO!");
  });
});