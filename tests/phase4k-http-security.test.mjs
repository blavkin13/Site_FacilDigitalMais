import {
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
  validateSameOriginMutation,
} from "../lib/request-security.ts";


function request({
  url =
    "https://facildigitalmais.com/api/checkout/create",

  method =
    "POST",

  origin =
    undefined,

  fetchSite =
    undefined,
}) {
  const headers =
    new Headers();


  if (
    origin !==
    undefined
  ) {
    headers.set(
      "origin",
      origin
    );
  }


  if (
    fetchSite !==
    undefined
  ) {
    headers.set(
      "sec-fetch-site",
      fetchSite
    );
  }


  return new NextRequest(
    url,
    {
      method,
      headers,
    }
  );
}


describe(
  "Fase 4.4B.2A - CSRF e segurança HTTP",
  () => {
    test(
      "GET não deve exigir proteção CSRF",
      () => {
        const decision =
          validateSameOriginMutation(
            request({
              method:
                "GET",

              origin:
                "https://site-malicioso.example",
            })
          );


        assert.equal(
          decision.allowed,
          true
        );
      }
    );


    test(
      "POST same-origin deve ser permitido",
      () => {
        const decision =
          validateSameOriginMutation(
            request({
              origin:
                "https://facildigitalmais.com",

              fetchSite:
                "same-origin",
            })
          );


        assert.equal(
          decision.allowed,
          true
        );
      }
    );


    test(
      "POST com Origin externo deve ser rejeitado",
      () => {
        const decision =
          validateSameOriginMutation(
            request({
              origin:
                "https://site-malicioso.example",

              fetchSite:
                "cross-site",
            })
          );


        assert.equal(
          decision.allowed,
          false
        );


        assert.equal(
          decision.reason,
          "origin_mismatch"
        );
      }
    );


    test(
      "subdomínio diferente não deve ser tratado como same-origin",
      () => {
        const decision =
          validateSameOriginMutation(
            request({
              url:
                "https://app.facildigitalmais.com/api/checkout/create",

              origin:
                "https://malicioso.facildigitalmais.com",

              fetchSite:
                "same-site",
            })
          );


        assert.equal(
          decision.allowed,
          false
        );
      }
    );


    test(
      "Sec-Fetch-Site cross-site sem Origin deve ser rejeitado",
      () => {
        const decision =
          validateSameOriginMutation(
            request({
              fetchSite:
                "cross-site",
            })
          );


        assert.equal(
          decision.allowed,
          false
        );


        assert.equal(
          decision.reason,
          "cross_site"
        );
      }
    );


    test(
      "cliente server-side sem Fetch Metadata deve continuar possível",
      () => {
        const decision =
          validateSameOriginMutation(
            request({})
          );


        assert.equal(
          decision.allowed,
          true
        );
      }
    );


    test(
      "webhook Mercado Pago deve ser explicitamente isento",
      () => {
        const decision =
          validateSameOriginMutation(
            request({
              url:
                "https://facildigitalmais.com/api/webhooks/mercadopago",

              origin:
                "https://external-service.example",

              fetchSite:
                "cross-site",
            })
          );


        assert.equal(
          decision.allowed,
          true
        );
      }
    );


    test(
      "Proxy deve bloquear POST cross-site antes da API",
      async () => {
        const {
          proxy,
        } =
          await import(
            "../proxy.ts"
          );


        const response =
          await proxy(
            request({
              origin:
                "https://site-malicioso.example",

              fetchSite:
                "cross-site",
            })
          );


        assert.equal(
          response.status,
          403
        );


        const data =
          await response.json();


        assert.equal(
          data.reason,
          "csrf_rejected"
        );


        assert.match(
          response.headers.get(
            "cache-control"
          ) ||
            "",
          /no-store/
        );
      }
    );


    test(
      "Proxy deve deixar webhook externo seguir",
      async () => {
        const {
          proxy,
        } =
          await import(
            "../proxy.ts"
          );


        const response =
          await proxy(
            request({
              url:
                "https://facildigitalmais.com/api/webhooks/mercadopago",

              origin:
                "https://external-service.example",

              fetchSite:
                "cross-site",
            })
          );


        assert.equal(
          response.status,
          200
        );
      }
    );


    test(
      "matcher do Proxy deve incluir APIs",
      async () => {
        const source =
          await readFile(
            join(
              process.cwd(),
              "proxy.ts"
            ),
            "utf8"
          );


        assert.match(
          source,
          /validateSameOriginMutation/
        );


        assert.match(
          source,
          /pathname\.startsWith\([\s\S]*["']\/api\/["']/
        );


        /**
         * A antiga expressão possuía:
         *
         * (?!api|_next...)
         *
         * e portanto pulava toda a proteção HTTP.
         */
        assert.doesNotMatch(
          source,
          /\(\?!api\|/
        );
      }
    );


    test(
      "Proxy administrativo deve validar sessão diretamente e falhar fechado",
      async () => {
        const source =
          await readFile(
            join(
              process.cwd(),
              "proxy.ts"
            ),
            "utf8"
          );


        /**
         * Testes estáticos não devem interpretar
         * comentários como código executável.
         */
        const executableSource =
          source
            .replace(
              /\/\*[\s\S]*?\*\//g,
              ""
            )
            .replace(
              /\/\/[^\n\r]*/g,
              ""
            );


        assert.match(
          executableSource,
          /validateSession/
        );


        assert.match(
          executableSource,
          /await\s+initDatabase\(\)/
        );


        assert.match(
          executableSource,
          /await\s+validateSession\(\s*sessionToken\s*\)/
        );


        assert.match(
          executableSource,
          /user\.role\s*!==\s*["']admin["']/
        );


        /**
         * A verificação administrativa deve acontecer
         * diretamente no SQLite.
         *
         * Nenhum self-fetch para /api/auth/me deve
         * existir no código executável.
         */
        assert.doesNotMatch(
          executableSource,
          /\/api\/auth\/me/
        );


        assert.doesNotMatch(
          executableSource,
          /\bfetch\s*\(/
        );


        /**
         * Qualquer falha de banco/autenticação deve
         * resultar em bloqueio do painel.
         */
        assert.match(
          executableSource,
          /catch[\s\S]*redirectToLogin/
        );
      }
    );


    test(
      "next.config deve possuir headers essenciais",
      async () => {
        const source =
          await readFile(
            join(
              process.cwd(),
              "next.config.ts"
            ),
            "utf8"
          );


        const expected = [
          "Content-Security-Policy",
          "X-Content-Type-Options",
          "Referrer-Policy",
          "X-Frame-Options",
          "Permissions-Policy",
          "Strict-Transport-Security",
          "frame-ancestors 'none'",
          "object-src 'none'",
          "upgrade-insecure-requests",
        ];


        for (
          const value of
            expected
        ) {
          assert.ok(
            source.includes(
              value
            ),
            `${value} deve existir no next.config.ts`
          );
        }
      }
    );


    test(
      "CSP não deve liberar unsafe-eval em produção",
      async () => {
        const source =
          await readFile(
            join(
              process.cwd(),
              "next.config.ts"
            ),
            "utf8"
          );


        assert.match(
          source,
          /isProduction[\s\S]*unsafe-eval/
        );


        /**
         * A ocorrência precisa estar no ramo de
         * desenvolvimento, não numa diretiva
         * incondicional.
         */
        assert.doesNotMatch(
          source,
          /script-src\s+'self'\s+'unsafe-inline'\s+'unsafe-eval'["']/
        );
      }
    );


    test(
      "APIs sensíveis devem receber no-store",
      async () => {
        const source =
          await readFile(
            join(
              process.cwd(),
              "next.config.ts"
            ),
            "utf8"
          );


        assert.match(
          source,
          /\/api\/auth\/:path\*/
        );


        assert.match(
          source,
          /\/api\/admin\/:path\*/
        );


        assert.match(
          source,
          /\/api\/simulations\/:path\*/
        );


        assert.match(
          source,
          /\/api\/orders\/:path\*/
        );


        assert.match(
          source,
          /private, no-store/
        );
      }
    );


    test(
      "Codespaces HTTPS deve ser reconhecido através de headers forwarded",
      () => {
        const headers =
          new Headers();


        headers.set(
          "origin",
          "https://meu-codespace-5173.app.github.dev"
        );


        headers.set(
          "host",
          "localhost:5173"
        );


        headers.set(
          "x-forwarded-host",
          "meu-codespace-5173.app.github.dev"
        );


        headers.set(
          "x-forwarded-proto",
          "https"
        );


        headers.set(
          "sec-fetch-site",
          "same-origin"
        );


        const codespacesRequest =
          new NextRequest(
            "http://localhost:5173/api/auth/login",
            {
              method:
                "POST",

              headers,
            }
          );


        const decision =
          validateSameOriginMutation(
            codespacesRequest
          );


        assert.equal(
          decision.allowed,
          true
        );
      }
    );


    test(
      "reverse proxy HTTPS deve aceitar Origin correspondente ao Host externo",
      () => {
        const headers =
          new Headers();


        headers.set(
          "origin",
          "https://facildigitalmais.com"
        );


        headers.set(
          "host",
          "facildigitalmais.com"
        );


        headers.set(
          "x-forwarded-proto",
          "https"
        );


        headers.set(
          "sec-fetch-site",
          "same-origin"
        );


        const proxiedRequest =
          new NextRequest(
            "http://127.0.0.1:3000/api/auth/login",
            {
              method:
                "POST",

              headers,
            }
          );


        const decision =
          validateSameOriginMutation(
            proxiedRequest
          );


        assert.equal(
          decision.allowed,
          true
        );
      }
    );


    test(
      "forwarded host diferente do Origin deve continuar bloqueado",
      () => {
        const headers =
          new Headers();


        headers.set(
          "origin",
          "https://site-malicioso.example"
        );


        headers.set(
          "host",
          "localhost:5173"
        );


        headers.set(
          "x-forwarded-host",
          "meu-codespace-5173.app.github.dev"
        );


        headers.set(
          "x-forwarded-proto",
          "https"
        );


        headers.set(
          "sec-fetch-site",
          "cross-site"
        );


        const maliciousRequest =
          new NextRequest(
            "http://localhost:5173/api/auth/login",
            {
              method:
                "POST",

              headers,
            }
          );


        const decision =
          validateSameOriginMutation(
            maliciousRequest
          );


        assert.equal(
          decision.allowed,
          false
        );


        assert.equal(
          decision.reason,
          "origin_mismatch"
        );
      }
    );


    test(
      "Host não deve permitir injeção de URL na origem",
      () => {
        const headers =
          new Headers();


        headers.set(
          "origin",
          "https://evil.example"
        );


        headers.set(
          "host",
          "facildigitalmais.com/evil"
        );


        headers.set(
          "x-forwarded-proto",
          "https"
        );


        const maliciousRequest =
          new NextRequest(
            "http://localhost:5173/api/auth/login",
            {
              method:
                "POST",

              headers,
            }
          );


        const decision =
          validateSameOriginMutation(
            maliciousRequest
          );


        assert.equal(
          decision.allowed,
          false
        );
      }
    );
  }
);