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
          /lib\/products/,
          "Página não pode depender do catálogo legado"
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
      "pagina de concurso deve utilizar Product do modulo de tipos",
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
          /from\s*["'][^"']*lib\/product-types["']/,
          "Product deve vir de product-types"
        );


        assert.doesNotMatch(
          content,
          /lib\/products/,
          "Página não pode importar o módulo removido"
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
      "ContestLanding deve utilizar product-types",
      () => {
        const content =
          readProjectFile(
            "components",
            "contest-landing.tsx"
          );


        assert.match(
          content,
          /from\s*["'][^"']*lib\/product-types["']/,
          "ContestLanding deve importar Product de product-types"
        );


        assert.doesNotMatch(
          content,
          /lib\/products/,
          "ContestLanding não pode depender do módulo legado"
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