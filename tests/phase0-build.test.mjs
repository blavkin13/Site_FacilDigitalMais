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


function readProjectFile(
  ...segments
) {
  return readFileSync(
    join(
      process.cwd(),
      ...segments
    ),
    "utf8"
  );
}


describe(
  "Fase 0 - Compatibilidade Next.js e build",
  () => {
    test(
      "sitemap deve ser importavel pelo runtime",
      async () => {
        const sitemapModule =
          await import(
            "../app/sitemap.ts"
          );


        assert.equal(
          typeof sitemapModule.default,
          "function",
          "app/sitemap.ts deve possuir export default"
        );


        /**
         * O sitemap agora consulta SQLite e,
         * portanto, deve ser assíncrono.
         *
         * Não executamos a função aqui para manter
         * este teste completamente independente
         * do banco data/dev.db.
         */
        assert.equal(
          sitemapModule
            .default
            .constructor
            .name,
          "AsyncFunction",
          "sitemap deve ser assíncrono"
        );
      }
    );


    test(
      "sitemap deve utilizar repository SQLite",
      () => {
        const content =
          readProjectFile(
            "app",
            "sitemap.ts"
          );


        assert.match(
          content,
          /@\/lib\/product-repository/,
          "sitemap deve importar product-repository"
        );


        assert.match(
          content,
          /getActiveProducts/,
          "sitemap deve consultar produtos ativos"
        );


        assert.match(
          content,
          /getActiveContestSlugs/,
          "sitemap deve consultar concursos derivados do banco"
        );


        assert.doesNotMatch(
          content,
          /@\/lib\/products/,
          "sitemap não pode utilizar catálogo legado"
        );
      }
    );


    test(
      "sitemap deve ser dinamico",
      () => {
        const content =
          readProjectFile(
            "app",
            "sitemap.ts"
          );


        assert.match(
          content,
          /dynamic\s*=\s*["']force-dynamic["']/,
          "sitemap deve refletir alterações do SQLite sem rebuild"
        );
      }
    );


    test(
      "middleware legado deve ter sido removido",
      () => {
        const middlewarePath =
          join(
            process.cwd(),
            "middleware.ts"
          );


        assert.equal(
          existsSync(
            middlewarePath
          ),
          false,
          "middleware.ts é deprecated no Next.js 16"
        );
      }
    );


    test(
      "proxy do Next.js deve existir",
      () => {
        const proxyPath =
          join(
            process.cwd(),
            "proxy.ts"
          );


        assert.ok(
          existsSync(
            proxyPath
          ),
          "proxy.ts deve existir na raiz do projeto"
        );


        const content =
          readFileSync(
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
        const content =
          readProjectFile(
            "proxy.ts"
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
        const content =
          readProjectFile(
            "db",
            "index.ts"
          );


        assert.doesNotMatch(
          content,
          /resolve\s*\(\s*process\.cwd\(\)\s*,\s*configuredPath/,
          "DATABASE_PATH relativo não deve permitir tracing da raiz inteira"
        );


        assert.match(
          content,
          /join\s*\(\s*process\.cwd\(\)\s*,\s*["']data["']/,
          "SQLite local deve ficar limitado à pasta data/"
        );
      }
    );


    test(
      "DATABASE_PATH relativo deve ficar dentro de data",
      async () => {
        const previousDatabasePath =
          process.env
            .DATABASE_PATH;


        try {
          process.env
            .DATABASE_PATH =
            "phase0-build.db";


          const {
            getDatabasePath,
          } =
            await import(
              "../db/index.ts"
            );


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
            delete process.env
              .DATABASE_PATH;
          } else {
            process.env
              .DATABASE_PATH =
              previousDatabasePath;
          }
        }
      }
    );


    test(
      "DATABASE_PATH legado ./data deve continuar compativel",
      async () => {
        const previousDatabasePath =
          process.env
            .DATABASE_PATH;


        try {
          process.env
            .DATABASE_PATH =
            "./data/dev.db";


          const {
            getDatabasePath,
          } =
            await import(
              "../db/index.ts"
            );


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
            delete process.env
              .DATABASE_PATH;
          } else {
            process.env
              .DATABASE_PATH =
              previousDatabasePath;
          }
        }
      }
    );


    test(
      "sitemap nao deve publicar paginas administrativas",
      () => {
        const content =
          readProjectFile(
            "app",
            "sitemap.ts"
          );


        assert.doesNotMatch(
          content,
          /`\$\{baseUrl\}\/admin/,
          "rotas administrativas nunca devem aparecer no sitemap"
        );


        assert.doesNotMatch(
          content,
          /url\s*:\s*["'][^"']*\/admin/,
          "sitemap não pode possuir URL administrativa"
        );
      }
    );
  }
);