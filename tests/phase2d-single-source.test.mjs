import {
  describe,
  test,
} from "node:test";

import assert from "node:assert/strict";

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";

import {
  join,
  relative,
} from "node:path";


const projectRoot =
  process.cwd();


function readProjectFile(
  ...segments
) {
  return readFileSync(
    join(
      projectRoot,
      ...segments
    ),
    "utf8"
  );
}


function collectSourceFiles(
  directory
) {
  const absoluteDirectory =
    join(
      projectRoot,
      directory
    );


  if (
    !existsSync(
      absoluteDirectory
    )
  ) {
    return [];
  }


  const files = [];


  for (
    const entry of readdirSync(
      absoluteDirectory
    )
  ) {
    const absolutePath =
      join(
        absoluteDirectory,
        entry
      );


    const stats =
      statSync(
        absolutePath
      );


    if (
      stats.isDirectory()
    ) {
      files.push(
        ...collectSourceFiles(
          relative(
            projectRoot,
            absolutePath
          )
        )
      );

      continue;
    }


    if (
      entry.endsWith(".ts") ||
      entry.endsWith(".tsx")
    ) {
      files.push(
        absolutePath
      );
    }
  }


  return files;
}


function productionSourceFiles() {
  return [
    "app",
    "components",
    "lib",
    "db",
    "scripts",
  ].flatMap(
    collectSourceFiles
  );
}


describe(
  "Fase 2D - Fonte unica de produtos",
  () => {
    test(
      "modelo Product deve existir em modulo independente",
      () => {
        const path =
          join(
            projectRoot,
            "lib",
            "product-types.ts"
          );


        assert.ok(
          existsSync(
            path
          ),
          "lib/product-types.ts deve existir"
        );


        const content =
          readFileSync(
            path,
            "utf8"
          );


        assert.match(
          content,
          /export\s+type\s+Product\s*=/,
          "Product deve possuir contrato próprio"
        );


        assert.match(
          content,
          /syllabus:\s*ProductSyllabusItem\[\]/,
          "Product deve tipar o conteúdo programático"
        );


        assert.match(
          content,
          /testimonial:\s*ProductTestimonial/,
          "Product deve tipar depoimentos"
        );
      }
    );


    test(
      "formatPrice deve existir em modulo independente",
      () => {
        const path =
          join(
            projectRoot,
            "lib",
            "currency.ts"
          );


        assert.ok(
          existsSync(
            path
          ),
          "lib/currency.ts deve existir"
        );


        const content =
          readFileSync(
            path,
            "utf8"
          );


        assert.match(
          content,
          /export\s+function\s+formatPrice/,
          "currency.ts deve exportar formatPrice"
        );


        assert.doesNotMatch(
          content,
          /\bproducts\b/,
          "formatador monetário não deve depender do catálogo"
        );
      }
    );


    test(
      "lib/products.ts deve ter sido removido definitivamente",
      () => {
        const legacyPath =
          join(
            projectRoot,
            "lib",
            "products.ts"
          );


        assert.equal(
          existsSync(
            legacyPath
          ),
          false,
          "lib/products.ts não deve mais existir"
        );
      }
    );


    test(
      "nenhum codigo de producao pode referenciar lib/products",
      () => {
        const failures = [];


        for (
          const file of productionSourceFiles()
        ) {
          const content =
            readFileSync(
              file,
              "utf8"
            );


          if (
            /lib\/products/.test(
              content
            )
          ) {
            failures.push(
              relative(
                projectRoot,
                file
              )
            );
          }
        }


        assert.deepEqual(
          failures,
          [],
          `Referências legadas encontradas: ${failures.join(", ")}`
        );
      }
    );


    test(
      "nenhum codigo de producao pode importar ./products legado",
      () => {
        const failures = [];


        for (
          const file of productionSourceFiles()
        ) {
          const content =
            readFileSync(
              file,
              "utf8"
            );


          if (
            /from\s*["']\.\/products["']/.test(
              content
            )
          ) {
            failures.push(
              relative(
                projectRoot,
                file
              )
            );
          }
        }


        assert.deepEqual(
          failures,
          [],
          `Imports ./products encontrados: ${failures.join(", ")}`
        );
      }
    );


    test(
      "repository deve utilizar Product do modulo de tipos",
      () => {
        const content =
          readProjectFile(
            "lib",
            "product-repository.ts"
          );


        assert.match(
          content,
          /from\s*["']\.\/product-types["']/,
          "repository deve depender de product-types"
        );


        assert.doesNotMatch(
          content,
          /from\s*["']\.\/products["']/,
          "repository não deve depender do módulo removido"
        );
      }
    );


    test(
      "consumidores de Product devem utilizar product-types",
      () => {
        const expectedConsumers = [
          "app/concurso/[slug]/page.tsx",
          "components/product-card.tsx",
          "components/catalog.tsx",
          "components/shop-provider.tsx",
          "components/contest-landing.tsx",
          "components/product-detail.tsx",
        ];


        for (
          const file of expectedConsumers
        ) {
          const content =
            readFileSync(
              join(
                projectRoot,
                file
              ),
              "utf8"
            );


          assert.match(
            content,
            /lib\/product-types/,
            `${file} deve importar Product de product-types`
          );


          assert.doesNotMatch(
            content,
            /lib\/products/,
            `${file} não pode utilizar lib/products`
          );
        }
      }
    );


    test(
      "consumidores de moeda devem utilizar currency",
      () => {
        const expectedConsumers = [
          "components/student-dashboard.tsx",
          "components/checkout-real.tsx",
          "components/site-header.tsx",
          "components/admin-dashboard.tsx",
        ];


        for (
          const file of expectedConsumers
        ) {
          const content =
            readFileSync(
              join(
                projectRoot,
                file
              ),
              "utf8"
            );


          assert.match(
            content,
            /lib\/currency/,
            `${file} deve importar formatPrice de currency`
          );


          assert.doesNotMatch(
            content,
            /lib\/products/,
            `${file} não pode utilizar lib/products`
          );
        }
      }
    );


    test(
      "sitemap deve consultar SQLite",
      () => {
        const content =
          readProjectFile(
            "app",
            "sitemap.ts"
          );


        assert.match(
          content,
          /getActiveProducts/,
          "sitemap deve utilizar produtos ativos"
        );


        assert.match(
          content,
          /getActiveContestSlugs/,
          "sitemap deve utilizar concursos ativos"
        );


        assert.match(
          content,
          /await\s+Promise\.all/,
          "consultas devem ocorrer antes de gerar as rotas"
        );


        assert.doesNotMatch(
          content,
          /lib\/products/,
          "sitemap não pode depender do módulo removido"
        );
      }
    );


    test(
      "sitemap nao pode conter concursos hardcoded",
      () => {
        const content =
          readProjectFile(
            "app",
            "sitemap.ts"
          );


        assert.doesNotMatch(
          content,
          /\[\s*["']transpetro["']\s*,/,
          "Transpetro não deve estar em uma lista fixa"
        );


        assert.doesNotMatch(
          content,
          /["']ebserh["']/,
          "EBSERH não deve estar hardcoded no sitemap"
        );


        assert.doesNotMatch(
          content,
          /["']marinha["']/,
          "Marinha não deve estar hardcoded no sitemap"
        );


        assert.match(
          content,
          /contestSlugs\.map/,
          "concursos devem ser derivados dinamicamente"
        );
      }
    );


    test(
      "products.json deve permanecer somente como bootstrap",
      () => {
        const loader =
          readProjectFile(
            "lib",
            "json-loader-runtime.ts"
          );


        assert.match(
          loader,
          /products\.json/,
          "loader deve continuar aceitando a carga inicial"
        );


        const repository =
          readProjectFile(
            "lib",
            "product-repository.ts"
          );


        assert.doesNotMatch(
          repository,
          /products\.json/,
          "storefront não pode ler products.json"
        );
      }
    );
  }
);