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
  "Fase 2B - Landing individual alimentada pelo SQLite",
  () => {
    test(
      "pagina individual deve consultar repository",
      () => {
        const content =
          readProjectFile(
            "app",
            "apostilas",
            "[slug]",
            "page.tsx"
          );


        assert.match(
          content,
          /getActiveProductBySlug/,
          "Landing deve consultar produto ativo no SQLite"
        );


        assert.doesNotMatch(
          content,
          /\bgetProduct\b/,
          "Landing não pode utilizar getProduct legado"
        );


        assert.doesNotMatch(
          content,
          /from\s*["'][^"']*lib\/products["']/,
          "Landing não pode importar catálogo hardcoded"
        );
      }
    );


    test(
      "pagina individual deve ser dinamica",
      () => {
        const content =
          readProjectFile(
            "app",
            "apostilas",
            "[slug]",
            "page.tsx"
          );


        assert.match(
          content,
          /dynamic\s*=\s*["']force-dynamic["']/,
          "Landing deve funcionar para slugs criados após o build"
        );


        assert.doesNotMatch(
          content,
          /generateStaticParams/,
          "Landing não deve limitar slugs aos conhecidos no build"
        );
      }
    );


    test(
      "produto inexistente ou inativo deve gerar 404",
      () => {
        const content =
          readProjectFile(
            "app",
            "apostilas",
            "[slug]",
            "page.tsx"
          );


        assert.match(
          content,
          /if\s*\(\s*!product\s*\)/,
          "Landing deve testar ausência do produto"
        );


        assert.match(
          content,
          /notFound\s*\(\s*\)/,
          "Landing deve responder com 404"
        );
      }
    );


    test(
      "metadata deve utilizar produto do SQLite",
      () => {
        const content =
          readProjectFile(
            "app",
            "apostilas",
            "[slug]",
            "page.tsx"
          );


        assert.match(
          content,
          /generateMetadata/,
          "Landing deve possuir metadata dinâmica"
        );


        assert.match(
          content,
          /product\.title/,
          "Título SEO deve vir do produto"
        );


        assert.match(
          content,
          /product\.description/,
          "Descrição SEO deve vir do produto"
        );


        assert.match(
          content,
          /product\.cover/,
          "Imagem social deve vir do produto"
        );
      }
    );


    test(
      "relacionados devem ser consultados pelo repository",
      () => {
        const content =
          readProjectFile(
            "app",
            "apostilas",
            "[slug]",
            "page.tsx"
          );


        assert.match(
          content,
          /getRelatedProducts/,
          "Produtos relacionados devem vir do repository"
        );


        assert.match(
          content,
          /relatedProducts=\{/,
          "Relacionados devem ser enviados ao Client Component"
        );
      }
    );


    test(
      "ProductDetail deve receber relacionados por props",
      () => {
        const content =
          readProjectFile(
            "components",
            "product-detail.tsx"
          );


        assert.match(
          content,
          /relatedProducts:\s*Product\[\]/,
          "ProductDetail deve declarar relatedProducts"
        );


        assert.match(
          content,
          /relatedProducts\.map/,
          "ProductDetail deve renderizar os relacionados recebidos"
        );
      }
    );


    test(
      "ProductDetail não pode consultar catálogo hardcoded em runtime",
      () => {
        const content =
          readProjectFile(
            "components",
            "product-detail.tsx"
          );


        assert.doesNotMatch(
          content,
          /import\s*\{\s*[^}]*\bproducts\b[^}]*\}\s*from/,
          "ProductDetail não pode importar products"
        );


        assert.doesNotMatch(
          content,
          /\bproducts\.filter\s*\(/,
          "ProductDetail não pode calcular relacionados pelo array legado"
        );


        assert.doesNotMatch(
          content,
          /import\s*\{\s*[^}]*formatPrice[^}]*\}\s*from\s*["'][^"']*lib\/products["']/,
          "ProductDetail não pode carregar formatPrice do catálogo legado"
        );
      }
    );


    test(
      "contagem de disciplinas deve refletir syllabus real",
      () => {
        const content =
          readProjectFile(
            "components",
            "product-detail.tsx"
          );


        assert.match(
          content,
          /product[\s\S]*\.syllabus[\s\S]*\.length/,
          "Landing deve utilizar quantidade real de disciplinas"
        );


        assert.doesNotMatch(
          content,
          /syllabus\s*\.\s*length\s*\+\s*4/,
          "Landing não pode adicionar disciplinas fictícias"
        );
      }
    );


    test(
      "ProductDetail ainda pode utilizar apenas o tipo Product legado",
      () => {
        const content =
          readProjectFile(
            "components",
            "product-detail.tsx"
          );


        assert.match(
          content,
          /import\s+type\s*\{\s*Product/,
          "Nesta etapa o tipo Product pode permanecer em lib/products"
        );
      }
    );
  }
);