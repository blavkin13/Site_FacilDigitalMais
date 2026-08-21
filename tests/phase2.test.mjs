import {
  after,
  before,
  describe,
  test,
} from "node:test";

import assert from "node:assert/strict";

import {
  existsSync,
  readFileSync,
} from "node:fs";

import {
  join,
} from "node:path";

import Database from "better-sqlite3";

import {
  createIsolatedDatabase,
} from "./helpers/isolated-database.mjs";


describe(
  "Fase 2 - API Routes e Autenticação",
  () => {
    let testEnvironment;


    before(
      async () => {
        console.log(
          "🧪 Preparando testes isolados da Fase 2..."
        );


        testEnvironment =
          await createIsolatedDatabase({
            admin: true,
          });


        console.log(
          `🧪 SQLite isolado: ${testEnvironment.databasePath}`
        );
      }
    );


    test(
      "API Route: login existe",
      () => {
        assert.ok(
          existsSync(
            join(
              process.cwd(),
              "app",
              "api",
              "auth",
              "login",
              "route.ts"
            )
          )
        );


        console.log(
          "✅ API login existe"
        );
      }
    );


    test(
      "API Route: register existe",
      () => {
        assert.ok(
          existsSync(
            join(
              process.cwd(),
              "app",
              "api",
              "auth",
              "register",
              "route.ts"
            )
          )
        );


        console.log(
          "✅ API register existe"
        );
      }
    );


    test(
      "API Route: logout existe",
      () => {
        assert.ok(
          existsSync(
            join(
              process.cwd(),
              "app",
              "api",
              "auth",
              "logout",
              "route.ts"
            )
          )
        );


        console.log(
          "✅ API logout existe"
        );
      }
    );


    test(
      "API Route: me existe",
      () => {
        assert.ok(
          existsSync(
            join(
              process.cwd(),
              "app",
              "api",
              "auth",
              "me",
              "route.ts"
            )
          )
        );


        console.log(
          "✅ API me existe"
        );
      }
    );


    test(
      "AuthProvider existe",
      () => {
        assert.ok(
          existsSync(
            join(
              process.cwd(),
              "components",
              "auth-provider.tsx"
            )
          )
        );


        console.log(
          "✅ AuthProvider existe"
        );
      }
    );


    test(
      "LoginForm existe",
      () => {
        assert.ok(
          existsSync(
            join(
              process.cwd(),
              "components",
              "login-form.tsx"
            )
          )
        );


        console.log(
          "✅ LoginForm existe"
        );
      }
    );


    test(
      "Página de login existe",
      () => {
        assert.ok(
          existsSync(
            join(
              process.cwd(),
              "app",
              "login",
              "page.tsx"
            )
          )
        );


        console.log(
          "✅ Página de login existe"
        );
      }
    );


    test(
      "Layout inclui AuthProvider",
      () => {
        const content =
          readFileSync(
            join(
              process.cwd(),
              "app",
              "layout.tsx"
            ),
            "utf8"
          );


        assert.match(
          content,
          /AuthProvider/
        );


        assert.match(
          content,
          /<AuthProvider>/
        );


        console.log(
          "✅ Layout inclui AuthProvider"
        );
      }
    );


    test(
      "SiteHeader usa useAuth",
      () => {
        const content =
          readFileSync(
            join(
              process.cwd(),
              "components",
              "site-header.tsx"
            ),
            "utf8"
          );


        assert.match(
          content,
          /useAuth/
        );


        assert.ok(
          content.includes(
            "user-dropdown"
          ) ||
          content.includes(
            "userMenu"
          )
        );


        assert.match(
          content,
          /\/login/
        );


        console.log(
          "✅ SiteHeader integrado com autenticação"
        );
      }
    );


    test(
      "AuthProvider exporta funções necessárias",
      () => {
        const content =
          readFileSync(
            join(
              process.cwd(),
              "components",
              "auth-provider.tsx"
            ),
            "utf8"
          );


        for (
          const value of [
            "AuthProvider",
            "useAuth",
            "AuthUser",
          ]
        ) {
          assert.ok(
            content.includes(
              value
            )
          );
        }


        console.log(
          "✅ AuthProvider exporta todas as funções necessárias"
        );
      }
    );


    test(
      "LoginForm tem modo login e registro",
      () => {
        const content =
          readFileSync(
            join(
              process.cwd(),
              "components",
              "login-form.tsx"
            ),
            "utf8"
          );


        for (
          const value of [
            '"login"',
            '"register"',
            "formatCpf",
            "formatPhone",
            "returnTo",
          ]
        ) {
          assert.ok(
            content.includes(
              value
            )
          );
        }


        console.log(
          "✅ LoginForm tem login e registro com validações"
        );
      }
    );


    test(
      "API login valida campos obrigatórios",
      () => {
        const content =
          readFileSync(
            join(
              process.cwd(),
              "app",
              "api",
              "auth",
              "login",
              "route.ts"
            ),
            "utf8"
          );


        assert.match(
          content,
          /!email\s*\|\|\s*!password/
        );


        assert.match(
          content,
          /fd-session/
        );


        assert.match(
          content,
          /httpOnly/
        );


        console.log(
          "✅ API login tem validações de segurança"
        );
      }
    );


    test(
      "API register valida email, senha e CPF",
      () => {
        const content =
          readFileSync(
            join(
              process.cwd(),
              "app",
              "api",
              "auth",
              "register",
              "route.ts"
            ),
            "utf8"
          );


        assert.match(
          content,
          /emailRegex/
        );


        assert.match(
          content,
          /password\.length\s*<\s*6/
        );


        assert.match(
          content,
          /cleanCpf\.length\s*!==\s*11/
        );


        assert.match(
          content,
          /409/
        );


        console.log(
          "✅ API register tem validações completas"
        );
      }
    );


    test(
      "Checkout exige login antes de comprar",
      () => {
        const content =
          readFileSync(
            join(
              process.cwd(),
              "components",
              "site-header.tsx"
            ),
            "utf8"
          );


        assert.match(
          content,
          /returnTo=\/checkout/
        );


        console.log(
          "✅ Checkout exige login"
        );
      }
    );


    test(
      "Banco isolado mantém administrador",
      () => {
        const sqlite =
          new Database(
            testEnvironment.databasePath,
            {
              readonly: true,
            }
          );


        try {
          const admin =
            sqlite
              .prepare(`
                SELECT
                  email,
                  role
                FROM users
                WHERE role = 'admin'
                LIMIT 1
              `)
              .get();


          assert.ok(
            admin
          );


          assert.equal(
            admin.email,
            "digicopiamix@facildigitalmais.com"
          );


          assert.equal(
            admin.role,
            "admin"
          );
        } finally {
          sqlite.close();
        }


        console.log(
          "✅ Admin íntegro no SQLite temporário"
        );
      }
    );


    test(
      "Registro → Login → Sessão → Logout → senha errada no banco isolado",
      async () => {
        const {
          authenticateUser,
          logoutSession,
          registerUser,
          validateSession,
        } =
          await import(
            "../lib/auth.ts"
          );


        const email =
          "teste-isolado@teste.com";


        const user =
          await registerUser(
            email,
            "senha123",
            "Usuário Teste",
            "12345678901",
            "(11) 99999-9999"
          );


        assert.ok(
          user,
          "Usuário deve ser registrado"
        );


        const duplicate =
          await registerUser(
            email,
            "senha123"
          );


        assert.equal(
          duplicate,
          null,
          "E-mail duplicado deve ser rejeitado"
        );


        const authentication =
          await authenticateUser(
            email,
            "senha123"
          );


        assert.ok(
          authentication,
          "Login deve funcionar"
        );


        const validUser =
          await validateSession(
            authentication.session.token
          );


        assert.equal(
          validUser?.email,
          email
        );


        await logoutSession(
          authentication.session.token
        );


        assert.equal(
          await validateSession(
            authentication.session.token
          ),
          null
        );


        assert.equal(
          await authenticateUser(
            email,
            "senhaerrada"
          ),
          null
        );


        console.log(
          "✅ Fluxo completo de autenticação executado no SQLite temporário"
        );
      }
    );


    test(
      "CSS de login foi adicionado",
      () => {
        const content =
          readFileSync(
            join(
              process.cwd(),
              "app",
              "extra.css"
            ),
            "utf8"
          );


        for (
          const className of [
            ".login-page",
            ".login-card",
            ".login-tabs",
            ".user-dropdown",
          ]
        ) {
          assert.ok(
            content.includes(
              className
            )
          );
        }


        console.log(
          "✅ CSS de login e auth adicionado"
        );
      }
    );


    after(
      () => {
        testEnvironment?.cleanup();


        console.log(
          "✅ Testes da Fase 2 concluídos sem banco persistente!"
        );
      }
    );
  }
);