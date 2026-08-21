import {
  after,
  before,
  describe,
  test,
} from "node:test";

import assert from "node:assert/strict";

import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";

import {
  tmpdir,
} from "node:os";

import {
  join,
} from "node:path";


let temporaryDirectory;
let databasePath;


/**
 * ============================================================
 * FASE 1A
 * REPOSITÓRIO OFICIAL DE PRODUTOS
 * ============================================================
 *
 * IMPORTANTE:
 *
 * Este teste nunca utiliza data/dev.db.
 *
 * Toda a validação acontece em um SQLite temporário.
 */

describe(
  "Fase 1A - Repositorio SQLite de produtos",
  () => {
    before(async () => {
      temporaryDirectory =
        mkdtempSync(
          join(
            tmpdir(),
            "facildigital-products-"
          )
        );

      databasePath =
        join(
          temporaryDirectory,
          "products-test.db"
        );

      process.env.DATABASE_PATH =
        databasePath;

      const {
        initDatabase,
      } = await import(
        "../db/init.ts"
      );

      await initDatabase();

      /**
       * Fazemos a carga através do loader oficial.
       *
       * Isso valida:
       *
       * products.json
       *      ↓
       * loader
       *      ↓
       * SQLite temporário
       */
      const {
        loadProductsToDb,
      } = await import(
        "../lib/json-loader-runtime.ts"
      );

      const loaded =
        await loadProductsToDb();

      assert.ok(
        loaded >= 3,
        "Carga inicial deve possuir pelo menos três apostilas"
      );

      /**
       * Adicionamos também um produto inativo para garantir
       * que o storefront não o exponha.
       */
      const {
        getDb,
      } = await import(
        "../db/index.ts"
      );

      const {
        products,
      } = await import(
        "../db/schema.ts"
      );

      const db = getDb();

      await db
        .insert(products)
        .values({
          slug:
            "produto-inativo-teste",

          title:
            "Produto Inativo — Teste",

          shortTitle:
            "Produto Inativo",

          category:
            "Teste",

          bank:
            "Teste",

          level:
            "Teste",

          pages:
            10,

          questions:
            5,

          oldPrice:
            100,

          price:
            50,

          pixPrice:
            47.5,

          updated:
            "Teste",

          cover:
            "/covers/cover-ambiental.png",

          coverClass:
            "environment",

          kicker:
            "Produto utilizado somente pela suíte automatizada.",

          description:
            "Este registro não pode aparecer no storefront.",

          highlights:
            JSON.stringify([
              "Não publicar",
            ]),

          syllabus:
            JSON.stringify([]),

          testimonial:
            JSON.stringify({
              name: "Teste",
              role: "Teste",
              quote: "Teste",
              score: "Teste",
            }),

          active:
            false,
        });
    });


    after(async () => {
      try {
        const {
          closeDatabase,
        } = await import(
          "../db/index.ts"
        );

        closeDatabase();
      } finally {
        delete process.env
          .DATABASE_PATH;

        if (
          temporaryDirectory &&
          existsSync(
            temporaryDirectory
          )
        ) {
          rmSync(
            temporaryDirectory,
            {
              recursive: true,
              force: true,
            }
          );
        }
      }
    });


    test(
      "product-repository.ts deve existir",
      () => {
        const repositoryPath =
          join(
            process.cwd(),
            "lib",
            "product-repository.ts"
          );

        assert.ok(
          existsSync(
            repositoryPath
          ),
          "lib/product-repository.ts deve existir"
        );
      }
    );


    test(
      "catalogo inicial deve utilizar imagens locais",
      () => {
        const productsPath =
          join(
            process.cwd(),
            "data",
            "products.json"
          );

        const content =
          readFileSync(
            productsPath,
            "utf8"
          );

        assert.doesNotMatch(
          content,
          /via\.placeholder\.com/i,
          "products.json não deve depender de via.placeholder.com"
        );

        assert.doesNotMatch(
          content,
          /exemplo\.com/i,
          "products.json não deve possuir URLs fictícias de exemplo"
        );

        const parsed =
          JSON.parse(content);

        assert.ok(
          Array.isArray(parsed)
        );

        assert.ok(
          parsed.length >= 3,
          "Carga inicial deve possuir pelo menos três produtos"
        );

        for (
          const product of parsed
        ) {
          assert.match(
            product.cover,
            /^\/covers\//,
            `Capa de ${product.slug} deve utilizar arquivo local`
          );
        }
      }
    );


    test(
      "deve listar somente produtos ativos",
      async () => {
        const {
          getActiveProducts,
        } = await import(
          "../lib/product-repository.ts"
        );

        const products =
          await getActiveProducts();

        assert.ok(
          products.length >= 3,
          "Devem existir produtos públicos"
        );

        assert.equal(
          products.some(
            (product) =>
              product.slug ===
              "produto-inativo-teste"
          ),
          false,
          "Produto inativo nunca deve aparecer no storefront"
        );
      }
    );


    test(
      "deve desserializar corretamente campos JSON",
      async () => {
        const {
          getActiveProductBySlug,
        } = await import(
          "../lib/product-repository.ts"
        );

        const product =
          await getActiveProductBySlug(
            "transpetro-auxiliar-de-saude"
          );

        assert.ok(
          product,
          "Produto deveria existir"
        );

        assert.ok(
          Array.isArray(
            product.highlights
          )
        );

        assert.ok(
          product.highlights.length >
            0
        );

        assert.ok(
          Array.isArray(
            product.syllabus
          )
        );

        assert.ok(
          product.syllabus.length >
            0
        );

        assert.equal(
          typeof product
            .testimonial.quote,
          "string"
        );
      }
    );


    test(
      "produto inativo nao pode ser acessado por slug",
      async () => {
        const {
          getActiveProductBySlug,
        } = await import(
          "../lib/product-repository.ts"
        );

        const product =
          await getActiveProductBySlug(
            "produto-inativo-teste"
          );

        assert.equal(
          product,
          null
        );
      }
    );


    test(
      "deve localizar apostilas por concurso",
      async () => {
        const {
          getProductsByContest,
        } = await import(
          "../lib/product-repository.ts"
        );

        const products =
          await getProductsByContest(
            "transpetro"
          );

        assert.ok(
          products.length >= 3,
          "Transpetro deve possuir as apostilas da carga inicial"
        );

        for (
          const product of products
        ) {
          assert.match(
            product.title,
            /Transpetro/i
          );
        }
      }
    );


    test(
      "deve derivar concursos a partir dos produtos",
      async () => {
        const {
          getActiveContestSlugs,
        } = await import(
          "../lib/product-repository.ts"
        );

        const contests =
          await getActiveContestSlugs();

        assert.ok(
          contests.includes(
            "transpetro"
          ),
          "Concurso Transpetro deve ser identificado"
        );
      }
    );


    test(
      "produtos relacionados nao devem incluir o produto atual",
      async () => {
        const {
          getRelatedProducts,
        } = await import(
          "../lib/product-repository.ts"
        );

        const related =
          await getRelatedProducts(
            "transpetro-contabilidade",
            2
          );

        assert.ok(
          related.length <= 2
        );

        assert.equal(
          related.some(
            (product) =>
              product.slug ===
              "transpetro-contabilidade"
          ),
          false
        );
      }
    );


    test(
      "loader deve ser idempotente e nao duplicar produtos",
      async () => {
        const {
          getDb,
        } = await import(
          "../db/index.ts"
        );

        const {
          products,
        } = await import(
          "../db/schema.ts"
        );

        const {
          loadProductsToDb,
        } = await import(
          "../lib/json-loader-runtime.ts"
        );

        const db = getDb();

        const beforeRows =
          await db
            .select()
            .from(products)
            .all();

        await loadProductsToDb();

        const afterRows =
          await db
            .select()
            .from(products)
            .all();

        assert.equal(
          afterRows.length,
          beforeRows.length,
          "Executar o loader novamente não pode duplicar produtos"
        );
      }
    );


    test(
      "repository deve expor as funcoes publicas essenciais",
      async () => {
        const repository =
          await import(
            "../lib/product-repository.ts"
          );

        const requiredFunctions = [
          "mapDatabaseProduct",
          "getActiveProducts",
          "getActiveProductBySlug",
          "getRelatedProducts",
          "getProductsByContest",
          "getActiveContestSlugs",
          "getContestSlugFromProduct",
          "productMatchesContest",
        ];

        for (
          const functionName of
          requiredFunctions
        ) {
          assert.equal(
            typeof repository[
              functionName
            ],
            "function",
            `${functionName} deve ser uma função`
          );
        }
      }
    );
  }
);