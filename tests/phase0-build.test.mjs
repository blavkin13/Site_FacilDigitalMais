import {
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

describe(
  "Fase 0 - Compatibilidade Next.js e build",
  () => {
    test(
      "sitemap deve ser importavel pelo runtime",
      async () => {
        const sitemapModule =
          await import("../app/sitemap.ts");

        assert.equal(
          typeof sitemapModule.default,
          "function",
          "app/sitemap.ts deve possuir export default"
        );

        const routes =
          sitemapModule.default();

        assert.ok(
          Array.isArray(routes),
          "sitemap deve retornar uma lista de rotas"
        );

        assert.ok(
          routes.length > 0,
          "sitemap deve possuir pelo menos uma rota"
        );
      }
    );

    test(
      "sitemap deve utilizar alias absoluto para lib/products",
      () => {
        const sitemapPath = join(
          process.cwd(),
          "app",
          "sitemap.ts"
        );

        const content = readFileSync(
          sitemapPath,
          "utf8"
        );

        assert.doesNotMatch(
          content,
          /from\s+["']\.\/lib\/products["']/,
          "app/sitemap.ts não pode procurar app/lib/products"
        );

        assert.match(
          content,
          /from\s+["']@\/lib\/products["']/,
          "sitemap deve importar products através de @/lib/products"
        );
      }
    );

    test(
      "middleware legado deve ter sido removido",
      () => {
        const middlewarePath = join(
          process.cwd(),
          "middleware.ts"
        );

        assert.equal(
          existsSync(middlewarePath),
          false,
          "middleware.ts é deprecated no Next.js 16"
        );
      }
    );

    test(
      "proxy do Next.js deve existir",
      () => {
        const proxyPath = join(
          process.cwd(),
          "proxy.ts"
        );

        assert.ok(
          existsSync(proxyPath),
          "proxy.ts deve existir na raiz do projeto"
        );

        const content = readFileSync(
          proxyPath,
          "utf8"
        );

        assert.match(
          content,
          /export\s+async\s+function\s+proxy\s*\(/,
          "proxy.ts deve exportar a função proxy"
        );
      }
    );

    test(
      "proxy deve proteger toda a area administrativa",
      () => {
        const proxyPath = join(
          process.cwd(),
          "proxy.ts"
        );

        const content = readFileSync(
          proxyPath,
          "utf8"
        );

        assert.match(
          content,
          /["']\/admin["']/,
          "proxy deve manter /admin entre as rotas protegidas"
        );

        assert.match(
          content,
          /role\s*!==\s*["']admin["']/,
          "proxy deve validar role admin"
        );
      }
    );

    test(
      "db/index não deve resolver DATABASE_PATH relativo a partir de toda a raiz",
      () => {
        const dbIndexPath = join(
          process.cwd(),
          "db",
          "index.ts"
        );

        const content = readFileSync(
          dbIndexPath,
          "utf8"
        );

        assert.doesNotMatch(
          content,
          /resolve\s*\(\s*process\.cwd\(\)\s*,\s*configuredPath/,
          "DATABASE_PATH relativo não deve permitir tracing da raiz inteira"
        );

        assert.match(
          content,
          /join\s*\(\s*process\.cwd\(\)\s*,\s*["']data["']/,
          "SQLite local deve ficar estaticamente limitado à pasta data/"
        );
      }
    );

    test(
      "DATABASE_PATH relativo deve ficar dentro de data",
      async () => {
        const previousDatabasePath =
          process.env.DATABASE_PATH;

        try {
          process.env.DATABASE_PATH =
            "phase0-build.db";

          const {
            getDatabasePath,
          } = await import("../db/index.ts");

          const resolvedPath =
            getDatabasePath();

          assert.equal(
            resolvedPath,
            join(
              process.cwd(),
              "data",
              "phase0-build.db"
            )
          );
        } finally {
          if (
            previousDatabasePath ===
            undefined
          ) {
            delete process.env.DATABASE_PATH;
          } else {
            process.env.DATABASE_PATH =
              previousDatabasePath;
          }
        }
      }
    );

    test(
      "DATABASE_PATH legado ./data deve continuar compativel",
      async () => {
        const previousDatabasePath =
          process.env.DATABASE_PATH;

        try {
          process.env.DATABASE_PATH =
            "./data/dev.db";

          const {
            getDatabasePath,
          } = await import("../db/index.ts");

          const resolvedPath =
            getDatabasePath();

          assert.equal(
            resolvedPath,
            join(
              process.cwd(),
              "data",
              "dev.db"
            )
          );
        } finally {
          if (
            previousDatabasePath ===
            undefined
          ) {
            delete process.env.DATABASE_PATH;
          } else {
            process.env.DATABASE_PATH =
              previousDatabasePath;
          }
        }
      }
    );

    test(
      "sitemap nao deve publicar paginas administrativas",
      async () => {
        const sitemapModule =
          await import("../app/sitemap.ts");

        const routes =
          sitemapModule.default();

        const adminRoute =
          routes.find((route) =>
            new URL(route.url).pathname.startsWith(
              "/admin"
            )
          );

        assert.equal(
          adminRoute,
          undefined,
          "rotas administrativas nunca devem aparecer no sitemap"
        );
      }
    );
  }
);