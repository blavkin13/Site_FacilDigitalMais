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
 * Remove comentários antes de verificações que procuram
 * conteúdo hardcoded na interface.
 *
 * Assim, documentação técnica dentro do arquivo não gera
 * falso positivo nos testes.
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
          /import\s*\{\s*products\s*\}\s*from/,
          "Home não pode importar catálogo hardcoded"
        );


        assert.doesNotMatch(
          content,
          /lib\/products/,
          "Home não pode depender do módulo legado removido"
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


        assert.doesNotMatch(
          content,
          /lib\/products/,
          "Página do catálogo não pode depender do módulo legado"
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
      "Catalog client deve receber produtos por props",
      () => {
        const content =
          readProjectFile(
            "components",
            "catalog.tsx"
          );


        assert.doesNotMatch(
          content,
          /import\s*\{\s*products\s*\}\s*from/,
          "Catalog não deve importar array products"
        );


        assert.doesNotMatch(
          content,
          /lib\/products/,
          "Catalog não pode depender do módulo legado"
        );


        assert.match(
          content,
          /products:\s*Product\[\]/,
          "Catalog deve receber produtos por props"
        );


        assert.match(
          content,
          /lib\/product-types/,
          "Catalog deve utilizar o contrato Product independente"
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
      "ProductCard deve utilizar somente o modelo Product independente",
      () => {
        const content =
          readProjectFile(
            "components",
            "product-card.tsx"
          );


        assert.doesNotMatch(
          content,
          /lib\/products/,
          "ProductCard não pode depender de lib/products"
        );


        assert.match(
          content,
          /import\s+type\s*\{[\s\S]*?\bProduct\b[\s\S]*?\}\s*from\s*["'][^"']*lib\/product-types["']/,
          "ProductCard deve importar Product de product-types"
        );


        assert.match(
          content,
          /function\s+formatPrice\s*\(/,
          "ProductCard pode manter formatador local enquanto não depende do catálogo"
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
  }
);