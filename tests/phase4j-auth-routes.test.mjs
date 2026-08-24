import {
  after,
  before,
  describe,
  test,
} from "node:test";

import assert from "node:assert/strict";

import {
  readFile,
} from "node:fs/promises";

import {
  join,
} from "node:path";

import {
  NextRequest,
} from "next/server";

import {
  createIsolatedDatabase,
} from "./helpers/isolated-database.mjs";


function request({
  path,
  method = "GET",
  token = null,
  body = undefined,
}) {
  const headers =
    new Headers();


  if (
    token
  ) {
    headers.set(
      "cookie",
      `fd-session=${token}`
    );
  }


  if (
    body !==
    undefined
  ) {
    headers.set(
      "content-type",
      "application/json"
    );
  }


  return new NextRequest(
    `http://localhost${path}`,
    {
      method,
      headers,

      body:
        body ===
        undefined
          ? undefined
          : JSON.stringify(
              body
            ),
    }
  );
}


function extractSessionToken(
  response
) {
  const setCookie =
    response.headers.get(
      "set-cookie"
    );


  assert.ok(
    setCookie,
    "Resposta deve possuir Set-Cookie"
  );


  const match =
    setCookie.match(
      /(?:^|,\s*)fd-session=([^;]+)/
    );


  assert.ok(
    match,
    "Cookie fd-session deve existir"
  );


  return decodeURIComponent(
    match[1]
  );
}


function assertNoStore(
  response
) {
  const cacheControl =
    response.headers.get(
      "cache-control"
    );


  assert.ok(
    cacheControl
  );


  assert.match(
    cacheControl,
    /no-store/
  );
}


describe(
  "Fase 4.4B.1B - Rotas e sessão endurecidas",
  () => {
    let isolated;

    let sqlite;

    let loginRoute;
    let registerRoute;
    let logoutRoute;
    let meRoute;

    let auth;

    let userToken;


    before(
      async () => {
        isolated =
          await createIsolatedDatabase({
            admin:
              true,
          });


        const database =
          await import(
            "../db/index.ts"
          );


        sqlite =
          database
            .getSqliteConnection();


        auth =
          await import(
            "../lib/auth.ts"
          );


        loginRoute =
          await import(
            "../app/api/auth/login/route.ts"
          );


        registerRoute =
          await import(
            "../app/api/auth/register/route.ts"
          );


        logoutRoute =
          await import(
            "../app/api/auth/logout/route.ts"
          );


        meRoute =
          await import(
            "../app/api/auth/me/route.ts"
          );
      }
    );


    test(
      "registro deve criar cookie HttpOnly e sessão fingerprinted",
      async () => {
        const response =
          await registerRoute.POST(
            request({
              path:
                "/api/auth/register",

              method:
                "POST",

              body: {
                email:
                  "cliente-route@teste.local",

                password:
                  "ClienteSeguro123!",

                name:
                  "Cliente Seguro",

                cpf:
                  "12345678901",

                phone:
                  "(11) 99999-9999",
              },
            })
          );


        assert.equal(
          response.status,
          201
        );


        assertNoStore(
          response
        );


        const setCookie =
          response.headers.get(
            "set-cookie"
          );


        assert.ok(
          setCookie
        );


        assert.match(
          setCookie,
          /HttpOnly/i
        );


        assert.match(
          setCookie,
          /SameSite=Lax/i
        );


        assert.match(
          setCookie,
          /Path=\//i
        );


        assert.match(
          setCookie,
          /Max-Age=604800/i
        );


        userToken =
          extractSessionToken(
            response
          );


        assert.match(
          userToken,
          /^[a-f0-9]{64}$/
        );


        const user =
          sqlite
            .prepare(`
              SELECT id
              FROM users
              WHERE email = ?
            `)
            .get(
              "cliente-route@teste.local"
            );


        assert.ok(
          user
        );


        const stored =
          sqlite
            .prepare(`
              SELECT token
              FROM sessions
              WHERE user_id = ?
              ORDER BY id DESC
              LIMIT 1
            `)
            .get(
              user.id
            );


        assert.ok(
          stored
        );


        assert.notEqual(
          stored.token,
          userToken
        );


        assert.match(
          stored.token,
          /^sha256:[a-f0-9]{64}$/
        );
      }
    );


    test(
      "me deve resolver sessão moderna e nunca permitir cache",
      async () => {
        const response =
          await meRoute.GET(
            request({
              path:
                "/api/auth/me",

              token:
                userToken,
            })
          );


        assert.equal(
          response.status,
          200
        );


        assertNoStore(
          response
        );


        const data =
          await response.json();


        assert.equal(
          data.authenticated,
          true
        );


        assert.equal(
          data.user.email,
          "cliente-route@teste.local"
        );


        assert.equal(
          Object.hasOwn(
            data.user,
            "passwordHash"
          ),
          false
        );
      }
    );


    test(
      "login inválido deve manter mensagem genérica e no-store",
      async () => {
        const response =
          await loginRoute.POST(
            request({
              path:
                "/api/auth/login",

              method:
                "POST",

              body: {
                email:
                  "cliente-route@teste.local",

                password:
                  "SenhaIncorreta!",
              },
            })
          );


        assert.equal(
          response.status,
          401
        );


        assertNoStore(
          response
        );


        const data =
          await response.json();


        assert.equal(
          data.error,
          "Email ou senha incorretos."
        );
      }
    );


    test(
      "login válido deve emitir novo bearer e armazenar somente fingerprint",
      async () => {
        const response =
          await loginRoute.POST(
            request({
              path:
                "/api/auth/login",

              method:
                "POST",

              body: {
                email:
                  "cliente-route@teste.local",

                password:
                  "ClienteSeguro123!",
              },
            })
          );


        assert.equal(
          response.status,
          200
        );


        assertNoStore(
          response
        );


        const token =
          extractSessionToken(
            response
          );


        assert.match(
          token,
          /^[a-f0-9]{64}$/
        );


        const rawStored =
          sqlite
            .prepare(`
              SELECT COUNT(*) AS total
              FROM sessions
              WHERE token = ?
            `)
            .get(
              token
            );


        assert.equal(
          Number(
            rawStored.total
          ),
          0
        );
      }
    );


    test(
      "logout deve invalidar sessão e apagar cookie",
      async () => {
        const response =
          await logoutRoute.POST(
            request({
              path:
                "/api/auth/logout",

              method:
                "POST",

              token:
                userToken,
            })
          );


        assert.equal(
          response.status,
          200
        );


        assertNoStore(
          response
        );


        const setCookie =
          response.headers.get(
            "set-cookie"
          );


        assert.ok(
          setCookie
        );


        assert.match(
          setCookie,
          /fd-session=/i
        );


        assert.match(
          setCookie,
          /Max-Age=0/i
        );


        assert.equal(
          await auth.validateSession(
            userToken
          ),
          null
        );
      }
    );


    test(
      "me deve limpar cookie inválido",
      async () => {
        const invalidToken =
          "a".repeat(
            64
          );


        const response =
          await meRoute.GET(
            request({
              path:
                "/api/auth/me",

              token:
                invalidToken,
            })
          );


        assert.equal(
          response.status,
          200
        );


        const data =
          await response.json();


        assert.equal(
          data.authenticated,
          false
        );


        const setCookie =
          response.headers.get(
            "set-cookie"
          );


        assert.ok(
          setCookie
        );


        assert.match(
          setCookie,
          /Max-Age=0/i
        );
      }
    );


    test(
      "rotação administrativa deve trocar senha e revogar sessões",
      async () => {
        const admin =
          sqlite
            .prepare(`
              SELECT
                id,
                email
              FROM users
              WHERE role = 'admin'
              LIMIT 1
            `)
            .get();


        assert.ok(
          admin
        );


        const oldPassword =
          "TestOnly_Admin_2026!";


        const beforeRotation =
          await auth.authenticateUser(
            admin.email,
            oldPassword
          );


        assert.ok(
          beforeRotation
        );


        const oldSessionToken =
          beforeRotation
            .session
            .token;


        assert.equal(
          (
            await auth.validateSession(
              oldSessionToken
            )
          )?.id,
          admin.id
        );


        const {
          rotateAdminPassword,
        } =
          await import(
            "../scripts/set-admin-password.ts"
          );


        const newPassword =
          "NovaSenhaAdmin_2026!";


        const rotation =
          await rotateAdminPassword({
            email:
              admin.email,

            password:
              newPassword,
          });


        assert.equal(
          rotation.userId,
          admin.id
        );


        assert.ok(
          rotation.revokedSessions >=
            1
        );


        assert.equal(
          await auth.validateSession(
            oldSessionToken
          ),
          null
        );


        assert.equal(
          await auth.authenticateUser(
            admin.email,
            oldPassword
          ),
          null
        );


        const newLogin =
          await auth.authenticateUser(
            admin.email,
            newPassword
          );


        assert.ok(
          newLogin
        );


        const storedAdmin =
          sqlite
            .prepare(`
              SELECT password_hash AS passwordHash
              FROM users
              WHERE id = ?
            `)
            .get(
              admin.id
            );


        assert.match(
          storedAdmin.passwordHash,
          /^scrypt\$v1\$/
        );
      }
    );


    test(
      "política de cookie deve estar centralizada",
      async () => {
        const source =
          await readFile(
            join(
              process.cwd(),
              "lib",
              "session-cookie.ts"
            ),
            "utf8"
          );


        assert.match(
          source,
          /SESSION_COOKIE_NAME/
        );


        assert.match(
          source,
          /fd-session/
        );


        assert.match(
          source,
          /httpOnly:\s*true/
        );


        assert.match(
          source,
          /secure:\s*[\r\n\s]*process\.env\.NODE_ENV\s*===\s*[\r\n\s]*["']production["']/
        );


        assert.match(
          source,
          /sameSite:\s*[\r\n\s]*["']lax["']/
        );


        assert.match(
          source,
          /priority:\s*[\r\n\s]*["']high["']/
        );


        assert.match(
          source,
          /SESSION_TTL_SECONDS/
        );


        assert.match(
          source,
          /private, no-store/
        );
      }
    );


    test(
      "rotação CLI não deve receber senha por argumento",
      async () => {
        const source =
          await readFile(
            join(
              process.cwd(),
              "scripts",
              "set-admin-password.ts"
            ),
            "utf8"
          );


        assert.match(
          source,
          /readHiddenInput/
        );


        assert.match(
          source,
          /setRawMode/
        );


        assert.match(
          source,
          /ADMIN_SEED_PASSWORD/
        );


        assert.doesNotMatch(
          source,
          /process\.argv\[[23]\].*password/i
        );


        assert.doesNotMatch(
          source,
          /console\.log\([^)]*password/i
        );
      }
    );


    after(
      () => {
        isolated
          ?.cleanup();
      }
    );
  }
);