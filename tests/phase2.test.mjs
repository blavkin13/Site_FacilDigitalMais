import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";

describe("Fase 2 - API Routes e Autenticação", () => {
  before(() => {
    console.log("🧪 Preparando testes da Fase 2...");
  });

  // === TESTES DE ESTRUTURA ===

  test("API Route: login existe", () => {
    const filePath = join(process.cwd(), "app", "api", "auth", "login", "route.ts");
    assert.ok(existsSync(filePath), "app/api/auth/login/route.ts deve existir");
    console.log("✅ API login existe");
  });

  test("API Route: register existe", () => {
    const filePath = join(process.cwd(), "app", "api", "auth", "register", "route.ts");
    assert.ok(existsSync(filePath), "app/api/auth/register/route.ts deve existir");
    console.log("✅ API register existe");
  });

  test("API Route: logout existe", () => {
    const filePath = join(process.cwd(), "app", "api", "auth", "logout", "route.ts");
    assert.ok(existsSync(filePath), "app/api/auth/logout/route.ts deve existir");
    console.log("✅ API logout existe");
  });

  test("API Route: me existe", () => {
    const filePath = join(process.cwd(), "app", "api", "auth", "me", "route.ts");
    assert.ok(existsSync(filePath), "app/api/auth/me/route.ts deve existir");
    console.log("✅ API me existe");
  });

  test("AuthProvider existe", () => {
    const filePath = join(process.cwd(), "components", "auth-provider.tsx");
    assert.ok(existsSync(filePath), "components/auth-provider.tsx deve existir");
    console.log("✅ AuthProvider existe");
  });

  test("LoginForm existe", () => {
    const filePath = join(process.cwd(), "components", "login-form.tsx");
    assert.ok(existsSync(filePath), "components/login-form.tsx deve existir");
    console.log("✅ LoginForm existe");
  });

  test("Página de login existe", () => {
    const filePath = join(process.cwd(), "app", "login", "page.tsx");
    assert.ok(existsSync(filePath), "app/login/page.tsx deve existir");
    console.log("✅ Página de login existe");
  });

  // === TESTES DE CONTEÚDO ===

  test("Layout inclui AuthProvider", async () => {
    const content = await readFile(join(process.cwd(), "app", "layout.tsx"), "utf-8");
    assert.ok(content.includes("AuthProvider"), "Layout deve importar AuthProvider");
    assert.ok(content.includes("<AuthProvider>"), "Layout deve usar <AuthProvider>");
    console.log("✅ Layout inclui AuthProvider");
  });

  test("SiteHeader usa useAuth", async () => {
    const content = await readFile(join(process.cwd(), "components", "site-header.tsx"), "utf-8");
    assert.ok(content.includes("useAuth"), "SiteHeader deve usar useAuth");
    assert.ok(content.includes("user-dropdown") || content.includes("userMenu"), "SiteHeader deve ter menu do usuário");
    assert.ok(content.includes("/login"), "SiteHeader deve ter link para login");
    console.log("✅ SiteHeader integrado com autenticação");
  });

  test("AuthProvider exporta funções necessárias", async () => {
    const content = await readFile(join(process.cwd(), "components", "auth-provider.tsx"), "utf-8");
    const requiredExports = ["AuthProvider", "useAuth", "AuthUser"];
    for (const exp of requiredExports) {
      assert.ok(content.includes(exp), `AuthProvider deve exportar ${exp}`);
    }
    console.log("✅ AuthProvider exporta todas as funções necessárias");
  });

  test("LoginForm tem modo login e registro", async () => {
    const content = await readFile(join(process.cwd(), "components", "login-form.tsx"), "utf-8");
    assert.ok(content.includes('"login"'), "Deve ter modo login");
    assert.ok(content.includes('"register"'), "Deve ter modo register");
    assert.ok(content.includes("formatCpf"), "Deve ter máscara de CPF");
    assert.ok(content.includes("formatPhone"), "Deve ter máscara de telefone");
    assert.ok(content.includes("returnTo"), "Deve ter redirect após login");
    console.log("✅ LoginForm tem login e registro com validações");
  });

  test("API login valida campos obrigatórios", async () => {
    const content = await readFile(
      join(process.cwd(), "app", "api", "auth", "login", "route.ts"),
      "utf-8"
    );
    assert.ok(content.includes("!email || !password"), "Deve validar campos obrigatórios");
    assert.ok(content.includes("fd-session"), "Deve usar cookie fd-session");
    assert.ok(content.includes("httpOnly"), "Cookie deve ser HTTPOnly");
    console.log("✅ API login tem validações de segurança");
  });

  test("API register valida email, senha e CPF", async () => {
    const content = await readFile(
      join(process.cwd(), "app", "api", "auth", "register", "route.ts"),
      "utf-8"
    );
    assert.ok(content.includes("emailRegex"), "Deve validar formato de email");
    assert.ok(content.includes("password.length < 6"), "Deve validar tamanho da senha");
    assert.ok(content.includes("cleanCpf.length !== 11"), "Deve validar CPF");
    assert.ok(content.includes("409"), "Deve retornar 409 para email duplicado");
    console.log("✅ API register tem validações completas");
  });

  test("Checkout exige login antes de comprar", async () => {
    const headerContent = await readFile(
      join(process.cwd(), "components", "site-header.tsx"),
      "utf-8"
    );
    assert.ok(
      headerContent.includes("login?returnTo=/checkout") || 
      headerContent.includes("returnTo=/checkout"),
      "Carrinho deve redirecionar para login antes do checkout"
    );
    console.log("✅ Checkout exige login");
  });

  // === TESTE DE INTEGRIDADE DO BANCO ===

  test("Banco de dados mantém admin após Fase 1", () => {
    const dbPath = join(process.cwd(), "data", "dev.db");
    if (existsSync(dbPath)) {
      const result = execSync(
        `sqlite3 ${dbPath} "SELECT email, role FROM users WHERE role='admin';"`,
        { encoding: "utf-8" }
      ).trim();
      assert.ok(
        result.includes("digicopiamix@facildigitalmais.com"),
        "Admin deve existir no banco"
      );
      console.log("✅ Admin continua íntegro no banco");
    } else {
      console.log("⚠️  Banco local não encontrado (pulando)");
    }
  });

  // === TESTE DE INTEGRAÇÃO: REGISTRO + LOGIN VIA SCRIPT ===

  test("Registro e login de usuário de teste via script", () => {
    const dbPath = join(process.cwd(), "data", "dev.db");
    if (!existsSync(dbPath)) {
      console.log("⚠️  Banco local não encontrado (pulando)");
      return;
    }

    try {
      // Criar script temporário para testar registro e login
      const testScript = `
        import { initDatabase } from "../db/init.js";
        import { registerUser, authenticateUser, validateSession, logoutSession } from "../lib/auth.js";
        
        await initDatabase();
        
        // 1. Registrar usuário de teste
        const user = await registerUser("teste@teste.com", "senha123", "Usuário Teste", "12345678901", "(11) 99999-9999");
        if (!user) {
          // Talvez já exista de testes anteriores
          console.log("REGISTER:EXISTS");
        } else {
          console.log("REGISTER:OK:" + user.id);
        }
        
        // 2. Autenticar
        const auth = await authenticateUser("teste@teste.com", "senha123");
        if (!auth) {
          console.log("LOGIN:FAIL");
          process.exit(1);
        }
        console.log("LOGIN:OK:" + auth.session.token.substring(0, 8));
        
        // 3. Validar sessão
        const validUser = await validateSession(auth.session.token);
        if (!validUser || validUser.email !== "teste@teste.com") {
          console.log("SESSION:FAIL");
          process.exit(1);
        }
        console.log("SESSION:OK");
        
        // 4. Logout
        await logoutSession(auth.session.token);
        const afterLogout = await validateSession(auth.session.token);
        if (afterLogout !== null) {
          console.log("LOGOUT:FAIL");
          process.exit(1);
        }
        console.log("LOGOUT:OK");
        
        // 5. Testar login com senha errada
        const badAuth = await authenticateUser("teste@teste.com", "senhaerrada");
        if (badAuth !== null) {
          console.log("BADPASS:FAIL");
          process.exit(1);
        }
        console.log("BADPASS:OK");
        
        process.exit(0);
      `;

      const tmpFile = join(process.cwd(), "tests", "_tmp_auth_test.ts");
      writeFileSync(tmpFile, testScript);

      const result = execSync(`npx tsx ${tmpFile}`, {
        encoding: "utf-8",
        stdio: "pipe",
      });

      // Limpar arquivo temporário
      unlinkSync(tmpFile);

      assert.ok(result.includes("LOGIN:OK"), "Login deve funcionar");
      assert.ok(result.includes("SESSION:OK"), "Sessão deve ser válida");
      assert.ok(result.includes("LOGOUT:OK"), "Logout deve funcionar");
      assert.ok(result.includes("BADPASS:OK"), "Senha errada deve ser rejeitada");

      console.log("✅ Fluxo completo: Registro → Login → Sessão → Logout → Senha errada");
    } catch (error) {
      console.error("Saída do teste:", error.stdout || error.message);
      throw error;
    }
  });

  // === TESTE DE CSS ===

  test("CSS de login foi adicionado", async () => {
    const cssContent = await readFile(join(process.cwd(), "app", "extra.css"), "utf-8");
    assert.ok(cssContent.includes(".login-page"), "CSS deve conter .login-page");
    assert.ok(cssContent.includes(".login-card"), "CSS deve conter .login-card");
    assert.ok(cssContent.includes(".login-tabs"), "CSS deve conter .login-tabs");
    assert.ok(cssContent.includes(".user-dropdown"), "CSS deve conter .user-dropdown");
    console.log("✅ CSS de login e auth adicionado");
  });

  after(() => {
    console.log("✅ Testes da Fase 2 concluídos!");
  });
});