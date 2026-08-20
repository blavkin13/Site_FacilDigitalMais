import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";

describe("Fase 4 - Checkout e Proteção de PDFs", () => {
  before(() => {
    console.log("🧪 Preparando testes da Fase 4...");
  });

  // === ESTRUTURA ===

  test("lib/mercadopago.ts existe", () => {
    const p = join(process.cwd(), "lib", "mercadopago.ts");
    assert.ok(existsSync(p));
    console.log("✅ lib/mercadopago.ts existe");
  });

  test("lib/pdf-protection.ts existe", () => {
    const p = join(process.cwd(), "lib", "pdf-protection.ts");
    assert.ok(existsSync(p));
    console.log("✅ lib/pdf-protection.ts existe");
  });

  test("API checkout/create existe", () => {
    const p = join(process.cwd(), "app", "api", "checkout", "create", "route.ts");
    assert.ok(existsSync(p));
    console.log("✅ API checkout/create existe");
  });

  test("API webhook mercadopago existe", () => {
    const p = join(process.cwd(), "app", "api", "webhooks", "mercadopago", "route.ts");
    assert.ok(existsSync(p));
    console.log("✅ API webhook existe");
  });

  test("API download/[token] existe", () => {
    const p = join(process.cwd(), "app", "api", "download", "[token]", "route.ts");
    assert.ok(existsSync(p));
    console.log("✅ API download existe");
  });

  test("API download/generate existe", () => {
    const p = join(process.cwd(), "app", "api", "download", "generate", "route.ts");
    assert.ok(existsSync(p));
    console.log("✅ API download/generate existe");
  });

  test("CheckoutReal existe", () => {
    const p = join(process.cwd(), "components", "checkout-real.tsx");
    assert.ok(existsSync(p));
    console.log("✅ CheckoutReal existe");
  });

  test("CheckoutSuccess existe", () => {
    const p = join(process.cwd(), "components", "checkout-success.tsx");
    assert.ok(existsSync(p));
    console.log("✅ CheckoutSuccess existe");
  });

  test("Página de sucesso existe", () => {
    const p = join(process.cwd(), "app", "checkout", "success", "page.tsx");
    assert.ok(existsSync(p));
    console.log("✅ Página de sucesso existe");
  });

  // === CONTEÚDO ===

  test("mercadopago.ts tem funções essenciais", async () => {
    const c = await readFile(join(process.cwd(), "lib", "mercadopago.ts"), "utf-8");
    assert.ok(c.includes("createPaymentPreference"), "Deve ter createPaymentPreference");
    assert.ok(c.includes("getPaymentStatus"), "Deve ter getPaymentStatus");
    assert.ok(c.includes("verifyWebhookSignature"), "Deve ter verifyWebhookSignature");
    console.log("✅ mercadopago.ts tem funções essenciais");
  });

  test("pdf-protection.ts tem funções essenciais", async () => {
    const c = await readFile(join(process.cwd(), "lib", "pdf-protection.ts"), "utf-8");
    assert.ok(c.includes("addWatermarkToPdf"), "Deve ter addWatermarkToPdf");
    assert.ok(c.includes("generateProtectedPdf"), "Deve ter generateProtectedPdf");
    assert.ok(c.includes("validateCpf"), "Deve ter validateCpf");
    assert.ok(c.includes("cleanupExpiredPdfs"), "Deve ter cleanupExpiredPdfs");
    assert.ok(c.includes("getProtectedPdfByToken"), "Deve ter getProtectedPdfByToken");
    console.log("✅ pdf-protection.ts tem funções essenciais");
  });

  test("API checkout cria preferência e pedido", async () => {
    const c = await readFile(
      join(process.cwd(), "app", "api", "checkout", "create", "route.ts"),
      "utf-8"
    );
    assert.ok(c.includes("createPaymentPreference"), "Deve chamar Mercado Pago");
    assert.ok(c.includes("pending"), "Deve criar pedido como pending");
    assert.ok(c.includes("external_reference"), "Deve ter referência externa");
    console.log("✅ API checkout integra com MP");
  });

  test("Webhook processa pagamentos", async () => {
    const c = await readFile(
      join(process.cwd(), "app", "api", "webhooks", "mercadopago", "route.ts"),
      "utf-8"
    );
    assert.ok(c.includes("verifyWebhookSignature"), "Deve validar assinatura");
    assert.ok(c.includes("statusMap"), "Deve mapear status");
    assert.ok(c.includes("approved"), "Deve tratar aprovado");
    console.log("✅ Webhook processa pagamentos");
  });

  test("Checkout real substitui demo", async () => {
    const c = await readFile(join(process.cwd(), "app", "checkout", "page.tsx"), "utf-8");
    assert.ok(c.includes("CheckoutReal"), "Deve usar CheckoutReal");
    assert.ok(!c.includes("CheckoutDemo"), "Não deve usar CheckoutDemo");
    console.log("✅ Checkout real substituiu demo");
  });

  test("Dashboard tem botão de download funcional", async () => {
    const c = await readFile(
      join(process.cwd(), "components", "student-dashboard.tsx"),
      "utf-8"
    );
    assert.ok(c.includes("DownloadButton"), "Deve ter DownloadButton");
    assert.ok(c.includes("/api/download/generate"), "Deve chamar API de download");
    console.log("✅ Dashboard tem download funcional");
  });

  // === FUNÇÕES DE PDF ===

  test("Validação de CPF funciona", async () => {
    const testScript = `
      process.removeAllListeners('warning');
      import { validateCpf, formatCpf } from "../lib/pdf-protection.js";

      // CPFs válidos
      const validCpf1 = "52998224725";
      const validCpf2 = "11144477735";

      // CPFs inválidos
      const invalidCpf1 = "11111111111";
      const invalidCpf2 = "12345678900";
      const invalidCpf3 = "123";

      const results = [
        validateCpf(validCpf1),
        validateCpf(validCpf2),
        !validateCpf(invalidCpf1),
        !validateCpf(invalidCpf2),
        !validateCpf(invalidCpf3),
      ];

      const formatted = formatCpf(validCpf1);

      if (results.every(r => r) && formatted === "529.982.247-25") {
        console.log("CPF:OK");
      } else {
        console.log("CPF:FAIL");
      }
    `;

    const tmpFile = join(process.cwd(), "tests", "_tmp_cpf_test.ts");

    // Limpar antes
    try { if (existsSync(tmpFile)) unlinkSync(tmpFile); } catch {}

    try {
      writeFileSync(tmpFile, testScript);

      const { spawnSync } = await import("node:child_process");
      const result = spawnSync("npx", ["tsx", "--no-warnings", tmpFile], {
        encoding: "utf-8",
        env: { ...process.env, NODE_NO_WARNINGS: "1" },
        timeout: 30000,
        stdio: "pipe",
      });

      const output = (result.stdout || "") + (result.stderr || "");
      assert.ok(output.includes("CPF:OK"), "Validação de CPF deve funcionar. Saída: " + output);
      console.log("✅ Validação de CPF funciona");
    } catch (error) {
      console.error("Erro no teste:", error.message);
      throw error;
    } finally {
      try { if (existsSync(tmpFile)) unlinkSync(tmpFile); } catch {}
    }
  });

  test("Geração de PDF protegido funciona", async () => {
    const testScript = `
      process.removeAllListeners('warning');
      import { addWatermarkToPdf, generateProtectedPdf, cleanupExpiredPdfs } from "../lib/pdf-protection.js";
      import { PDFDocument } from "pdf-lib";

      // Criar PDF de teste em memória
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595, 842]);
      const pdfBytes = await pdfDoc.save();

      // Aplicar watermark
      const watermarked = await addWatermarkToPdf(pdfBytes, "52998224725");
      if (!watermarked || watermarked.length === 0) {
        console.log("WATERMARK:FAIL");
      } else {
        console.log("WATERMARK:OK");
      }

      // Verificar que o PDF ainda é válido
      const checkDoc = await PDFDocument.load(watermarked);
      if (checkDoc.getPageCount() !== 1) {
        console.log("PAGES:FAIL");
      } else {
        console.log("PAGES:OK");
      }

      // Testar geração de PDF protegido (sem arquivo original, cria demo)
      const result = await generateProtectedPdf("/nonexistent.pdf", "52998224725", 999);
      if (!result.downloadToken || !result.protectedPath) {
        console.log("GENERATE:FAIL");
      } else {
        console.log("GENERATE:OK:" + result.downloadToken.substring(0, 8));
      }

      // Cleanup
      const removed = await cleanupExpiredPdfs();
      console.log("CLEANUP:OK:" + removed);
    `;

    const tmpFile = join(process.cwd(), "tests", "_tmp_pdf_test.ts");

    // Limpar antes
    try { if (existsSync(tmpFile)) unlinkSync(tmpFile); } catch {}

    try {
      writeFileSync(tmpFile, testScript);

      const { spawnSync } = await import("node:child_process");
      const result = spawnSync("npx", ["tsx", "--no-warnings", tmpFile], {
        encoding: "utf-8",
        env: { ...process.env, NODE_NO_WARNINGS: "1" },
        timeout: 60000,
        stdio: "pipe",
      });

      const output = (result.stdout || "") + (result.stderr || "");
      
      assert.ok(output.includes("WATERMARK:OK"), "Watermark deve funcionar. Saída: " + output);
      assert.ok(output.includes("PAGES:OK"), "PDF deve manter páginas");
      assert.ok(output.includes("GENERATE:OK"), "Geração deve funcionar");
      assert.ok(output.includes("CLEANUP:OK"), "Cleanup deve funcionar");

      console.log("✅ Geração de PDF protegido com watermark funciona");
    } catch (error) {
      console.error("Erro no teste:", error.message);
      throw error;
    } finally {
      try { if (existsSync(tmpFile)) unlinkSync(tmpFile); } catch {}
    }
  });

  // === CSS ===

  test("CSS de checkout foi adicionado", async () => {
    const c = await readFile(join(process.cwd(), "app", "extra.css"), "utf-8");
    assert.ok(c.includes(".checkout-auth-required"), "Deve ter checkout-auth-required");
    assert.ok(c.includes(".checkout-success-page"), "Deve ter checkout-success-page");
    assert.ok(c.includes(".success-icon"), "Deve ter success-icon");
    assert.ok(c.includes(".cpf-warning"), "Deve ter cpf-warning");
    console.log("✅ CSS de checkout adicionado");
  });

  // === REGRESSÃO ===

  test("Fases anteriores preservadas", () => {
    const checks = [
      "lib/auth.ts",
      "components/auth-provider.tsx",
      "components/student-dashboard.tsx",
      "components/simulation-quiz.tsx",
      "app/api/orders/route.ts",
      "app/api/simulations/route.ts",
    ];
    for (const path of checks) {
      assert.ok(existsSync(join(process.cwd(), path)), `${path} deve existir`);
    }
    console.log("✅ Fases anteriores preservadas");
  });

  after(() => {
    console.log("✅ Testes da Fase 4 concluídos!");
  });
});