import { test, describe, before, after, mock } from "node:test";
import assert from "node:assert";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

describe("Fase 1 - Testes de Autenticação", () => {
  before(() => {
    console.log("🧪 Preparando ambiente de testes...");
  });

  test("Validar estrutura do schema", () => {
    // Verificar se schema.ts existe
    const schemaPath = join(process.cwd(), "db", "schema.ts");
    assert.ok(existsSync(schemaPath), "Schema deve existir");
    console.log("✅ Schema existe");
  });

  test("Validar arquivo de autenticação", () => {
    const authPath = join(process.cwd(), "lib", "auth.ts");
    assert.ok(existsSync(authPath), "auth.ts deve existir");
    console.log("✅ auth.ts existe");
  });

  test("Validar arquivo de seed", () => {
    const seedPath = join(process.cwd(), "db", "seed.ts");
    assert.ok(existsSync(seedPath), "seed.ts deve existir");
    console.log("✅ seed.ts existe");
  });

  test("Validar sistema de JSON loader", () => {
    const loaderPath = join(process.cwd(), "lib", "json-loader.ts");
    assert.ok(existsSync(loaderPath), "json-loader.ts deve existir");
    console.log("✅ json-loader.ts existe");
  });

  test("Validar hash de senha (sem banco)", async () => {
    // Importar apenas as funções puras que não dependem do banco
    const { hashPassword, verifyPassword } = await import("../lib/auth.ts");
    
    const password = "teste123";
    const hash = hashPassword(password);
    
    assert.ok(hash.length > 0, "Hash deve ser gerado");
    assert.strictEqual(hash.length, 64, "Hash SHA-256 deve ter 64 caracteres hex");
    assert.ok(verifyPassword(password, hash), "Senha deve ser verificada corretamente");
    assert.ok(!verifyPassword("senhaErrada", hash), "Senha incorreta deve falhar");
    assert.ok(!verifyPassword("", hash), "Senha vazia deve falhar");
    
    // Testar consistência (mesma senha sempre gera mesmo hash)
    const hash2 = hashPassword(password);
    assert.strictEqual(hash, hash2, "Mesma senha deve gerar mesmo hash");
    
    console.log("✅ Sistema de hash funcionando");
  });

  test("Validar geração de token (sem banco)", async () => {
    const { generateSessionToken } = await import("../lib/auth.ts");
    
    const token1 = generateSessionToken();
    const token2 = generateSessionToken();
    
    assert.ok(token1.length > 0, "Token deve ser gerado");
    assert.strictEqual(token1.length, 64, "Token deve ter 64 caracteres hex");
    assert.notEqual(token1, token2, "Tokens devem ser únicos");
    
    // Gerar 10 tokens e verificar unicidade
    const tokens = new Set();
    for (let i = 0; i < 10; i++) {
      tokens.add(generateSessionToken());
    }
    assert.strictEqual(tokens.size, 10, "Todos os tokens devem ser únicos");
    
    console.log("✅ Geração de tokens funcionando");
  });

  test("Validar estrutura de interfaces TypeScript", async () => {
    // Ler o arquivo schema.ts e verificar se contém as tabelas esperadas
    const { readFile } = await import("fs/promises");
    const schemaContent = await readFile(join(process.cwd(), "db", "schema.ts"), "utf-8");
    
    const requiredTables = [
      "users",
      "products", 
      "orders",
      "orderItems",
      "questions",
      "simulations",
      "simulationResults",
      "sessions",
      "protectedDownloads"
    ];
    
    for (const table of requiredTables) {
      assert.ok(
        schemaContent.includes(`sqliteTable("${table}"`) || 
        schemaContent.includes(`export const ${table}`),
        `Tabela ${table} deve estar definida no schema`
      );
    }
    
    console.log("✅ Schema contém todas as tabelas necessárias");
  });

  test("Validar que auth.ts exporta funções necessárias", async () => {
    const authContent = await (await import("fs/promises")).readFile(
      join(process.cwd(), "lib", "auth.ts"), 
      "utf-8"
    );
    
    const requiredFunctions = [
      "hashPassword",
      "verifyPassword", 
      "generateSessionToken",
      "registerUser",
      "authenticateUser",
      "validateSession",
      "logoutSession",
      "cleanupExpiredSessions"
    ];
    
    for (const func of requiredFunctions) {
      assert.ok(
        authContent.includes(`export function ${func}`) || 
        authContent.includes(`export async function ${func}`),
        `Função ${func} deve estar exportada`
      );
    }
    
    console.log("✅ auth.ts exporta todas as funções necessárias");
  });

  test("Validar integridade do banco de dados (se existir)", async () => {
    const { existsSync } = await import("fs");
    const dbPath = join(process.cwd(), "data", "dev.db");
    
    if (existsSync(dbPath)) {
      const { execSync } = await import("child_process");
      
      // Verificar se tabela users existe
      const result = execSync(
        `sqlite3 ${dbPath} "SELECT name FROM sqlite_master WHERE type='table' AND name='users';"`,
        { encoding: "utf-8" }
      ).trim();
      
      assert.ok(result.includes("users"), "Tabela users deve existir no banco");
      
      // Verificar se admin foi criado
      const adminResult = execSync(
        `sqlite3 ${dbPath} "SELECT COUNT(*) FROM users WHERE role='admin';"`,
        { encoding: "utf-8" }
      ).trim();
      
      assert.ok(parseInt(adminResult) > 0, "Deve existir pelo menos um admin no banco");
      
      console.log("✅ Banco de dados está íntegro");
    } else {
      console.log("⚠️  Banco de dados local não encontrado (pulando teste)");
    }
  });

  after(() => {
    console.log("✅ Testes da Fase 1 concluídos");
  });
});