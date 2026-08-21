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
 * Remove imports exclusivamente de tipo.
 *
 * Exemplo:
 *
 * import type {
 *   Product,
 * } from "../lib/products";
 *
 * Esse import desaparece na compilação TypeScript e,
 * portanto, não representa dependência runtime do
 * catálogo legado.
 *
 * Os testes que procuram imports runtime devem analisar
 * somente o código restante.
 */
function stripTypeImports(
  source
) {
  return source.replace(
    /import\s+type\s*\{[\s\S]*?\}\s*from\s*["'][^"']+["'];?/g,
    ""
  );
}


describe(
  "Fase 2C - Concurso alimentado pelo SQLite",
  () => {
    test(
      "pagina de concurso deve consultar repository",
      () => {
        const content =
          readProjectFile(
            "app",
            "concurso",
            "[slug]",
            "page.tsx"
          );


        assert.match(
          content,
          /getProductsByContest/,
          "Página de concurso deve buscar produtos pelo repository"
        );


        assert.doesNotMatch(
          content,
          /import\s*\{\s*products\s*\}/,
          "Página não pode importar catálogo hardcoded"
        );
      }
    );


    test(
      "pagina de concurso deve ser dinamica",
      () => {
        const content =
          readProjectFile(
            "app",
            "concurso",
            "[slug]",
            "page.tsx"
          );


        assert.match(
          content,
          /dynamic\s*=\s*["']force-dynamic["']/,
          "Concurso deve refletir alterações do banco sem rebuild"
        );
      }
    );


    test(
      "concurso sem produtos ativos deve responder 404",
      () => {
        const content =
          readProjectFile(
            "app",
            "concurso",
            "[slug]",
            "page.tsx"
          );


        assert.match(
          content,
          /products\.length\s*===\s*0/,
          "Página deve verificar se o concurso possui produtos"
        );


        assert.match(
          content,
          /notFound\s*\(\s*\)/,
          "Concurso inexistente deve gerar 404"
        );
      }
    );


    test(
      "metadata deve ser derivada dos produtos do concurso",
      () => {
        const content =
          readProjectFile(
            "app",
            "concurso",
            "[slug]",
            "page.tsx"
          );


        assert.match(
          content,
          /generateMetadata/,
          "Página deve possuir metadata"
        );


        assert.match(
          content,
          /getContestName/,
          "Metadata deve utilizar nome derivado do concurso"
        );


        assert.match(
          content,
          /robots/,
          "Concurso inexistente deve impedir indexação"
        );
      }
    );


    test(
      "ContestLanding deve receber produtos por props",
      () => {
        const content =
          readProjectFile(
            "components",
            "contest-landing.tsx"
          );


        assert.match(
          content,
          /products:\s*Product\[\]/,
          "ContestLanding deve receber Product[]"
        );


        assert.match(
          content,
          /contestName:\s*string/,
          "ContestLanding deve receber nome do concurso"
        );
      }
    );


    test(
      "ContestLanding nao pode importar array hardcoded em runtime",
      () => {
        const rawContent =
          readProjectFile(
            "components",
            "contest-landing.tsx"
          );


        /**
         * import type é permitido nesta etapa.
         *
         * Ele existe apenas para tipagem e desaparece
         * completamente do JavaScript produzido.
         */
        const runtimeContent =
          stripTypeImports(
            rawContent
          );


        assert.doesNotMatch(
          runtimeContent,
          /import\s*\{\s*[^}]*\bproducts\b[^}]*\}\s*from\s*["'][^"']*lib\/products["']/,
          "ContestLanding não pode importar o array products em runtime"
        );


        assert.doesNotMatch(
          runtimeContent,
          /from\s*["'][^"']*lib\/products["']/,
          "ContestLanding não pode depender de lib/products em runtime"
        );


        /**
         * Nesta etapa ainda permitimos usar Product
         * exclusivamente como tipo.
         *
         * A remoção definitiva de lib/products.ts acontecerá
         * na Fase 2D.
         */
        assert.match(
          rawContent,
          /import\s+type\s*\{[\s\S]*?\bProduct\b[\s\S]*?\}\s*from\s*["'][^"']*lib\/products["']/,
          "Product pode permanecer temporariamente como import type"
        );
      }
    );


    test(
      "ContestLanding nao deve depender de hooks client-side",
      () => {
        const content =
          readProjectFile(
            "components",
            "contest-landing.tsx"
          );


        assert.doesNotMatch(
          content,
          /["']use client["']/,
          "Landing de concurso não precisa ser Client Component"
        );


        assert.doesNotMatch(
          content,
          /\buseEffect\b/,
          "Landing não deve usar useEffect"
        );


        assert.doesNotMatch(
          content,
          /\buseState\b/,
          "Landing não deve usar useState"
        );
      }
    );


    test(
      "ContestLanding deve manter filtro defensivo por concurso",
      () => {
        const content =
          readProjectFile(
            "components",
            "contest-landing.tsx"
          );


        assert.match(
          content,
          /products\.filter/,
          "Produtos recebidos devem passar pela validação do concurso"
        );


        assert.match(
          content,
          /productMatchesContest/,
          "Filtro deve utilizar a regra centralizada do repository"
        );
      }
    );


    test(
      "ContestLanding deve continuar utilizando ProductCard",
      () => {
        const content =
          readProjectFile(
            "components",
            "contest-landing.tsx"
          );


        assert.match(
          content,
          /ProductCard/,
          "Apostilas devem continuar utilizando o componente padrão"
        );


        assert.match(
          content,
          /contestProducts\.map/,
          "Produtos filtrados devem ser renderizados"
        );
      }
    );


    test(
      "ContestLanding nao deve utilizar any para produtos",
      () => {
        const content =
          readProjectFile(
            "components",
            "contest-landing.tsx"
          );


        assert.doesNotMatch(
          content,
          /useState\s*<\s*any\[\]/,
          "Produtos não podem utilizar any[]"
        );


        assert.doesNotMatch(
          content,
          /products\s*:\s*any/,
          "Props de produtos devem ser tipadas"
        );
      }
    );
  }
);