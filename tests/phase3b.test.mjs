import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";

describe("Fase 3B - Sistema de Simulados", () => {
  before(() => {
    console.log("🧪 Preparando testes da Fase 3B...");
  });

  // === ESTRUTURA ===

  test("API /api/simulations existe", () => {
    const p = join(process.cwd(), "app", "api", "simulations", "route.ts");
    assert.ok(existsSync(p), "Deve existir");
    console.log("✅ API /api/simulations existe");
  });

  test("API /api/simulations/[id] existe", () => {
    const p = join(process.cwd(), "app", "api", "simulations", "[id]", "route.ts");
    assert.ok(existsSync(p), "Deve existir");
    console.log("✅ API /api/simulations/[id] existe");
  });

  test("API submit existe", () => {
    const p = join(process.cwd(), "app", "api", "simulations", "[id]", "submit", "route.ts");
    assert.ok(existsSync(p), "Deve existir");
    console.log("✅ API submit existe");
  });

  test("Componente SimulationList existe", () => {
    const p = join(process.cwd(), "components", "simulation-list.tsx");
    assert.ok(existsSync(p));
    console.log("✅ SimulationList existe");
  });

  test("Componente SimulationQuiz existe", () => {
    const p = join(process.cwd(), "components", "simulation-quiz.tsx");
    assert.ok(existsSync(p));
    console.log("✅ SimulationQuiz existe");
  });

  test("Componente SimulationResults existe", () => {
    const p = join(process.cwd(), "components", "simulation-results.tsx");
    assert.ok(existsSync(p));
    console.log("✅ SimulationResults existe");
  });

  test("Página /simulados/[id] existe", () => {
    const p = join(process.cwd(), "app", "simulados", "[id]", "page.tsx");
    assert.ok(existsSync(p));
    console.log("✅ Página de simulado específico existe");
  });

  test("Página de resultado existe", () => {
    const p = join(process.cwd(), "app", "simulados", "[id]", "resultado", "page.tsx");
    assert.ok(existsSync(p));
    console.log("✅ Página de resultado existe");
  });

  test("Seed de simulados existe", () => {
    const p = join(process.cwd(), "db", "seed-simulations.ts");
    assert.ok(existsSync(p));
    console.log("✅ Seed de simulados existe");
  });

  // === CONTEÚDO ===

  test("API simulações verifica acesso (tem que ter compra)", async () => {
    const c = await readFile(join(process.cwd(), "app", "api", "simulations", "route.ts"), "utf-8");
    assert.ok(c.includes("hasAccess"), "Deve verificar acesso");
    assert.ok(c.includes("orders"), "Deve consultar pedidos");
    console.log("✅ API verifica acesso");
  });

  test("API submit retorna ranking", async () => {
    const c = await readFile(
      join(process.cwd(), "app", "api", "simulations", "[id]", "submit", "route.ts"),
      "utf-8"
    );
    assert.ok(c.includes("ranking"), "Deve retornar ranking");
    assert.ok(c.includes("userPosition"), "Deve retornar posição do usuário");
    assert.ok(c.includes("detailedAnswers"), "Deve retornar respostas detalhadas");
    assert.ok(c.includes("isCorrect"), "Deve calcular acertos");
    console.log("✅ API submit tem ranking e detalhes");
  });

  test("SimulationQuiz tem timer", async () => {
    const c = await readFile(join(process.cwd(), "components", "simulation-quiz.tsx"), "utf-8");
    assert.ok(c.includes("timeLeft"), "Deve ter timeLeft");
    assert.ok(c.includes("setInterval"), "Deve ter timer");
    assert.ok(c.includes("formatTime"), "Deve formatar tempo");
    console.log("✅ SimulationQuiz tem timer");
  });

  test("SimulationResults mostra revisão detalhada", async () => {
    const c = await readFile(join(process.cwd(), "components", "simulation-results.tsx"), "utf-8");
    assert.ok(c.includes("detailedAnswers"), "Deve mostrar respostas detalhadas");
    assert.ok(c.includes("correctAnswer"), "Deve mostrar resposta correta");
    assert.ok(c.includes("explanation"), "Deve mostrar explicação");
    assert.ok(c.includes("ranking"), "Deve mostrar ranking");
    console.log("✅ SimulationResults tem revisão completa");
  });

  // === INTEGRAÇÃO ===

  test("Executar seed de simulados", () => {
    try {
      const result = execSync("npx tsx db/seed-simulations.ts", {
        encoding: "utf-8",
        stdio: "pipe",
      });
      const success = result.includes("concluído");
      assert.ok(success, "Seed deve executar");
      console.log("✅ Seed de simulados executado");
    } catch (error) {
      console.error(error.stdout || error.message);
      throw error;
    }
  });

  test("Banco tem questões", () => {
    const dbPath = join(process.cwd(), "data", "dev.db");
    if (!existsSync(dbPath)) return;
    const count = execSync(
      `sqlite3 ${dbPath} "SELECT COUNT(*) FROM questions;"`,
      { encoding: "utf-8" }
    ).trim();
    assert.ok(parseInt(count) >= 4, "Deve ter pelo menos 4 questões");
    console.log(`✅ Banco tem ${count} questões`);
  });

  test("Banco tem simulados", () => {
    const dbPath = join(process.cwd(), "data", "dev.db");
    if (!existsSync(dbPath)) return;
    const count = execSync(
      `sqlite3 ${dbPath} "SELECT COUNT(*) FROM simulations;"`,
      { encoding: "utf-8" }
    ).trim();
    assert.ok(parseInt(count) >= 1, "Deve ter pelo menos 1 simulado");
    console.log(`✅ Banco tem ${count} simulado(s)`);
  });

  test("Fluxo completo: submeter simulado e gerar ranking", () => {
    const dbPath = join(process.cwd(), "data", "dev.db");
    if (!existsSync(dbPath)) return;

    const testScript = `
      import { initDatabase } from "../db/init.js";
      import { getDb } from "../db/index.js";
      import { users, orders, simulations, questions, simulationResults } from "../db/schema.js";
      import { eq } from "drizzle-orm";

      await initDatabase();
      const db = getDb();

      // 1. Verificar admin com compra
      const admin = await db.select().from(users).where(eq(users.email, "digicopiamix@facildigitalmais.com")).get();
      if (!admin) { console.log("NOADMIN"); process.exit(1); }
      console.log("ADMIN:OK");

      const userOrders = await db.select().from(orders).where(eq(orders.userId, admin.id)).all();
      if (userOrders.length === 0) { console.log("NOORDERS"); process.exit(1); }
      console.log("HAS_ACCESS:OK");

      // 2. Buscar primeiro simulado
      const sim = await db.select().from(simulations).limit(1).get();
      if (!sim) { console.log("NOSIM"); process.exit(1); }
      console.log("SIM:OK:" + sim.id);

      // 3. Buscar questões
      const questionIds = JSON.parse(sim.questionIds);
      const qs = await db.select().from(questions).all();
      const simQs = qs.filter(q => questionIds.includes(q.id));
      if (simQs.length === 0) { console.log("NOQS"); process.exit(1); }
      console.log("QS:OK:" + simQs.length);

      // 4. Simular submissão (metade correta)
      const answers = simQs.map((q, i) => ({
        questionId: q.id,
        selectedOption: i % 2 === 0 ? q.correctAnswer : (q.correctAnswer + 1) % 4,
      }));

      const result = await db.insert(simulationResults).values({
        userId: admin.id,
        simulationId: sim.id,
        score: Math.ceil(simQs.length / 2),
        totalQuestions: simQs.length,
        timeSpent: 300,
        answers: JSON.stringify(answers),
      }).returning();

      if (result[0]) {
        console.log("SUBMIT:OK:" + result[0].id);
      }

      // 5. Verificar que há ranking
      const ranking = await db.select().from(simulationResults).all();
      console.log("RANKING:OK:" + ranking.length);

      process.exit(0);
    `;

    try {
      const tmpFile = join(process.cwd(), "tests", "_tmp_sim_test.ts");
      writeFileSync(tmpFile, testScript);
      const result = execSync(`npx tsx ${tmpFile}`, { encoding: "utf-8", stdio: "pipe" });
      unlinkSync(tmpFile);

      assert.ok(result.includes("ADMIN:OK"));
      assert.ok(result.includes("HAS_ACCESS:OK"));
      assert.ok(result.includes("SIM:OK"));
      assert.ok(result.includes("QS:OK"));
      assert.ok(result.includes("SUBMIT:OK"));
      assert.ok(result.includes("RANKING:OK"));

      console.log("✅ Fluxo completo: acesso → questões → submissão → ranking");
    } catch (error) {
      console.error(error.stdout || error.message);
      throw error;
    }
  });

  // === CSS ===

  test("CSS de simulados foi adicionado", async () => {
    const c = await readFile(join(process.cwd(), "app", "extra.css"), "utf-8");
    assert.ok(c.includes(".simulation-card"), "Deve ter .simulation-card");
    assert.ok(c.includes(".sim-start-card"), "Deve ter .sim-start-card");
    assert.ok(c.includes(".results-summary"), "Deve ter .results-summary");
    assert.ok(c.includes(".ranking-table"), "Deve ter .ranking-table");
    assert.ok(c.includes(".review-question"), "Deve ter .review-question");
    console.log("✅ CSS de simulados e resultados adicionado");
  });

  // === REGRESSÃO ===

  test("Fases anteriores preservadas", () => {
    const checks = [
      "lib/auth.ts",
      "components/auth-provider.tsx",
      "components/student-dashboard.tsx",
      "app/api/orders/route.ts",
    ];
    for (const path of checks) {
      assert.ok(existsSync(join(process.cwd(), path)), `${path} deve existir`);
    }
    console.log("✅ Fases anteriores preservadas");
  });

  after(() => {
    console.log("✅ Testes da Fase 3B concluídos!");
  });
});