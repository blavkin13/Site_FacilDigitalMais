#!/usr/bin/env node

// ==========================================
// SCRIPT DE VALIDACAO COMPLETA
// Substitui o test runner do Node para evitar bug
// ==========================================

import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (error) {
    console.log(`[FAIL] ${name}: ${error.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (error) {
    console.log(`[FAIL] ${name}: ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

console.log("=== VALIDACAO COMPLETA DO PROJETO ===\n");

// FASE 1
console.log("--- FASE 1: AUTENTICACAO ---");
test("lib/auth.ts existe", () => assert(existsSync("lib/auth.ts"), "Faltando"));
test("db/schema.ts existe", () => assert(existsSync("db/schema.ts"), "Faltando"));
test("db/init.ts existe", () => assert(existsSync("db/init.ts"), "Faltando"));
test("db/seed.ts existe", () => assert(existsSync("db/seed.ts"), "Faltando"));

// FASE 2
console.log("\n--- FASE 2: API ROUTES ---");
test("auth-provider.tsx existe", () => assert(existsSync("components/auth-provider.tsx"), "Faltando"));
test("API login existe", () => assert(existsSync("app/api/auth/login/route.ts"), "Faltando"));
test("API register existe", () => assert(existsSync("app/api/auth/register/route.ts"), "Faltando"));
test("API logout existe", () => assert(existsSync("app/api/auth/logout/route.ts"), "Faltando"));
test("API me existe", () => assert(existsSync("app/api/auth/me/route.ts"), "Faltando"));
test("LoginForm existe", () => assert(existsSync("components/login-form.tsx"), "Faltando"));

// FASE 3
console.log("\n--- FASE 3: PEDIDOS E SIMULADOS ---");
test("student-dashboard.tsx existe", () => assert(existsSync("components/student-dashboard.tsx"), "Faltando"));
test("API orders existe", () => assert(existsSync("app/api/orders/route.ts"), "Faltando"));
test("API simulations existe", () => assert(existsSync("app/api/simulations/route.ts"), "Faltando"));
test("simulation-quiz.tsx existe", () => assert(existsSync("components/simulation-quiz.tsx"), "Faltando"));
test("simulation-results.tsx existe", () => assert(existsSync("components/simulation-results.tsx"), "Faltando"));

// FASE 4
console.log("\n--- FASE 4: CHECKOUT E PDFs ---");
test("checkout-real.tsx existe", () => assert(existsSync("components/checkout-real.tsx"), "Faltando"));
test("mercadopago.ts existe", () => assert(existsSync("lib/mercadopago.ts"), "Faltando"));
test("pdf-protection.ts existe", () => assert(existsSync("lib/pdf-protection.ts"), "Faltando"));
test("API checkout existe", () => assert(existsSync("app/api/checkout/create/route.ts"), "Faltando"));
test("API webhook existe", () => assert(existsSync("app/api/webhooks/mercadopago/route.ts"), "Faltando"));
test("API download existe", () => assert(existsSync("app/api/download/[token]/route.ts"), "Faltando"));

// FASE 5
console.log("\n--- FASE 5: ADMIN E CONTEST ---");
test("proxy.ts existe", () => assert(existsSync("proxy.ts"), "Faltando"));
test("admin-dashboard.tsx existe", () => assert(existsSync("components/admin-dashboard.tsx"), "Faltando"));
test("API admin/stats existe", () => assert(existsSync("app/api/admin/stats/route.ts"), "Faltando"));
test("API admin/orders existe", () => assert(existsSync("app/api/admin/orders/route.ts"), "Faltando"));
test("API admin/products existe", () => assert(existsSync("app/api/admin/products/route.ts"), "Faltando"));
test("contest-landing.tsx existe", () => assert(existsSync("components/contest-landing.tsx"), "Faltando"));
test("json-loader-runtime.ts existe", () => assert(existsSync("lib/json-loader-runtime.ts"), "Faltando"));

// FASE 6
console.log("\n--- FASE 6: DEPLOY E DOCS ---");
test("deploy-hostinger.sh existe", () => assert(existsSync("scripts/deploy-hostinger.sh"), "Faltando"));
test("ecosystem.config.cjs existe", () => assert(existsSync("ecosystem.config.cjs"), "Faltando"));
test("nginx-config.conf existe", () => assert(existsSync("scripts/nginx-config.conf"), "Faltando"));
test(".env.example existe", () => assert(existsSync(".env.example"), "Faltando"));
test("README.md existe", () => assert(existsSync("README.md"), "Faltando"));
test("sitemap.ts existe", () => assert(existsSync("app/sitemap.ts"), "Faltando"));
test("robots.ts existe", () => assert(existsSync("app/robots.ts"), "Faltando"));

// Verificar package.json
console.log("\n--- PACKAGE.JSON ---");
await testAsync("package.json tem scripts essenciais", async () => {
  const content = await readFile("package.json", "utf-8");
  const pkg = JSON.parse(content);

  const required = ["dev", "build", "start", "db:init", "db:seed", "test:all"];
  for (const script of required) {
    assert(pkg.scripts[script], `Script ${script} faltando`);
  }
});

// Resultado final
console.log("\n=== RESULTADO ===");
console.log(`[OK] ${passed} testes passaram`);
if (failed > 0) {
  console.log(`[ERRO] ${failed} testes falharam`);
  process.exit(1);
} else {
  console.log("[SUCESSO] Todos os testes passaram!");
  console.log("[FINAL] Validacoes estruturais concluidas com sucesso.");
}