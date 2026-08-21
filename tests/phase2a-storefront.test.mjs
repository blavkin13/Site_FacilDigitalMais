import {
  describe,
  test,
} from "node:test";

import assert from "node:assert/strict";

import {
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


/**
 * Remove comentários do código antes de verificações
 * que procuram conteúdo renderizável/hardcoded.
 *
 * Isso evita falsos positivos como:
 *
 *   // removemos "18 apostilas"
 *
 * ou:
 *
 *   /*
 *    * "18 apostilas" era um valor antigo
 *    *\/
 *
 * O teste deve analisar comportamento do código,
 * e não palavras presentes na documentação.
 */
function stripComments(
  source
) {
  return source
    .replace(
      /\/\*[\s\S]*?\*\//g,
      ""
    )
    .replace(
      /(^|[^:])\/\/.*$/gm,
      "$1"
    );
}


describe(
  "Fase 2A - Storefront alimentado pelo SQLite",
  () => {
    test(
      "Home deve buscar produtos pelo repository",
      () => {
        const content =
          readProjectFile(
            "app",
            "page.tsx"
          );


        assert.match(
          content,
          /getActiveProducts/,
          "Home deve utilizar getActiveProducts"
        );


        assert.match(
          content,
          /await\s+getActiveProducts\s*\(\s*\)/,
          "Home deve consultar o repository"
        );


        assert.doesNotMatch(
          content,
          /import\s*\{\s*products\s*\}\s*from\s*["'][^"']*lib\/products["']/,
          "Home não pode importar o catálogo hardcoded"
        );
      }
    );


    test(
      "Home deve ser dinâmica para refletir alterações administrativas",
      () => {
        const content =
          readProjectFile(
            "app",
            "page.tsx"
          );


        assert.match(
          content,
          /dynamic\s*=\s*["']force-dynamic["']/,
          "Home não deve congelar o catálogo no build"
        );
      }
    );


    test(
      "pagina do catálogo deve buscar produtos no servidor",
      () => {
        const content =
          readProjectFile(
            "app",
            "apostilas",
            "page.tsx"
          );


        assert.match(
          content,
          /getActiveProducts/,
          "Página /apostilas deve usar o repository"
        );


        assert.match(
          content,
          /await\s+Promise\.all/,
          "Página deve resolver produtos e searchParams no servidor"
        );


        assert.match(
          content,
          /products=\{/,
          "Produtos devem ser enviados ao Catalog por props"
        );
      }
    );


    test(
      "catálogo deve ser dinâmico",
      () => {
        const content =
          readProjectFile(
            "app",
            "apostilas",
            "page.tsx"
          );


        assert.match(
          content,
          /dynamic\s*=\s*["']force-dynamic["']/,
          "Catálogo deve refletir ativações e novas apostilas sem rebuild"
        );
      }
    );


    test(
      "Catalog client não pode importar array hardcoded",
      () => {
        const content =
          readProjectFile(
            "components",
            "catalog.tsx"
          );


        assert.doesNotMatch(
          content,
          /import\s*\{\s*products\s*\}\s*from/,
          "Catalog não deve importar products"
        );


        assert.match(
          content,
          /products:\s*Product\[\]/,
          "Catalog deve receber produtos por props"
        );
      }
    );


    test(
      "Catalog deve aceitar filtros vindos da URL",
      () => {
        const content =
          readProjectFile(
            "components",
            "catalog.tsx"
          );


        assert.match(
          content,
          /initialQuery/,
          "Catalog deve aceitar busca inicial"
        );


        assert.match(
          content,
          /initialLevel/,
          "Catalog deve aceitar nível inicial"
        );


        assert.match(
          content,
          /initialCategory/,
          "Catalog deve aceitar categoria inicial"
        );
      }
    );


    test(
      "ProductCard não deve importar valores runtime de lib/products",
      () => {
        const content =
          readProjectFile(
            "components",
            "product-card.tsx"
          );


        assert.doesNotMatch(
          content,
          /import\s*\{\s*formatPrice[^}]*\}\s*from\s*["'][^"']*lib\/products["']/,
          "ProductCard não deve carregar lib/products em runtime"
        );


        assert.match(
          content,
          /import\s+type\s*\{\s*Product/,
          "ProductCard pode utilizar somente o tipo Product"
        );
      }
    );


    test(
      "categorias da Home não devem possuir quantidades fictícias",
      () => {
        const rawContent =
          readProjectFile(
            "app",
            "page.tsx"
          );


        /**
         * Comentários não fazem parte da interface renderizada
         * e não devem influenciar este teste.
         */
        const content =
          stripComments(
            rawContent
          );


        assert.doesNotMatch(
          content,
          /18\s+apostilas/i,
          "Home não deve possuir contagem fictícia de 18 apostilas"
        );


        assert.doesNotMatch(
          content,
          /24\s+apostilas/i,
          "Home não deve possuir contagem fictícia de 24 apostilas"
        );


        assert.doesNotMatch(
          content,
          /31\s+apostilas/i,
          "Home não deve possuir contagem fictícia de 31 apostilas"
        );


        assert.match(
          content,
          /categoryCounts/,
          "Contagens devem ser derivadas dos produtos publicados"
        );


        assert.match(
          content,
          /product\.category/,
          "Categorias devem ser derivadas dos produtos do banco"
        );


        assert.match(
          content,
          /category\.count/,
          "Quantidade exibida deve utilizar a contagem calculada"
        );
      }
    );


    test(
      "esta etapa não deve migrar ainda ProductDetail",
      () => {
        const content =
          readProjectFile(
            "components",
            "product-detail.tsx"
          );


        assert.match(
          content,
          /products/,
          "ProductDetail continua legado até a Fase 2B"
        );
      }
    );
  }
);