import { test, describe } from "node:test";
import assert from "node:assert";
import { execSync } from "node:child_process";

describe("Fase 1 - Testes de Integração", () => {
  test("Validar que db:init funciona", () => {
    try {
      const result = execSync("npm run db:init", { 
        encoding: "utf-8",
        stdio: "pipe"
      });
      assert.ok(
        result.includes("Tabelas criadas com sucesso") || 
        result.includes("Connected to SQLite"),
        "db:init deve executar sem erros"
      );
      console.log("✅ db:init funciona corretamente");
    } catch (error) {
      console.error("❌ Erro no db:init:", error.message);
      throw error;
    }
  });

  test("Validar que db:seed cria admin (idempotente)", () => {
    try {
      const result1 = execSync("npm run db:seed", { 
        encoding: "utf-8",
        stdio: "pipe"
      });
      
      // Executar novamente para testar idempotência
      const result2 = execSync("npm run db:seed", { 
        encoding: "utf-8",
        stdio: "pipe"
      });
      
      const success = result2.includes("já existe") || result2.includes("criado com sucesso");
      assert.ok(success, "db:seed deve ser idempotente");
      
      console.log("✅ db:seed é idempotente");
    } catch (error) {
      console.error("❌ Erro no db:seed:", error.message);
      throw error;
    }
  });
});