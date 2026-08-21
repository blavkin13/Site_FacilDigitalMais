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
  spawnSync,
} from "node:child_process";

import {
  tmpdir,
} from "node:os";

import {
  join,
} from "node:path";

import Database from "better-sqlite3";


let temporaryDirectory;
let databasePath;


/**
 * ============================================================
 * FASE 1A
 * TESTE DO COMANDO CLI DE CARGA DE PRODUTOS
 * ============================================================
 *
 * Este teste executa literalmente:
 *
 *   npm run db:load-products
 *
 * mas aponta DATABASE_PATH para um banco temporário.
 *
 * Portanto:
 *
 * - data/dev.db nunca é alterado;
 * - validamos o mesmo comando usado manualmente;
 * - erros de tsx / CLI / imports são detectados;
 * - validamos o banco criado pelo processo filho.
 */

describe(
  "Fase 1A - CLI de carga de produtos",
  () => {
    before(() => {
      temporaryDirectory =
        mkdtempSync(
          join(
            tmpdir(),
            "facildigital-loader-cli-"
          )
        );

      databasePath =
        join(
          temporaryDirectory,
          "loader-cli-test.db"
        );
    });


    after(() => {
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
    });


    test(
      "script CLI deve existir",
      () => {
        const scriptPath =
          join(
            process.cwd(),
            "scripts",
            "load-products.ts"
          );

        assert.ok(
          existsSync(
            scriptPath
          ),
          "scripts/load-products.ts deve existir"
        );
      }
    );


    test(
      "package.json deve executar arquivo CLI sem tsx -e",
      () => {
        const packagePath =
          join(
            process.cwd(),
            "package.json"
          );

        const packageJson =
          JSON.parse(
            readFileSync(
              packagePath,
              "utf8"
            )
          );

        assert.equal(
          packageJson
            .scripts[
              "db:load-products"
            ],
          "tsx scripts/load-products.ts",
          "db:load-products deve utilizar o wrapper CLI"
        );

        assert.doesNotMatch(
          packageJson
            .scripts[
              "db:load-products"
            ],
          /\btsx\s+-e\b/,
          "db:load-products não deve utilizar tsx -e"
        );

        assert.doesNotMatch(
          packageJson
            .scripts[
              "db:load-products"
            ],
          /\bawait\b/,
          "package.json não deve conter top-level await no comando"
        );
      }
    );


    test(
      "comando npm run db:load-products deve executar com sucesso",
      () => {
        const result =
          spawnSync(
            "npm",
            [
              "run",
              "db:load-products",
            ],
            {
              cwd:
                process.cwd(),

              env: {
                ...process.env,

                DATABASE_PATH:
                  databasePath,

                NODE_ENV:
                  "test",

                NODE_NO_WARNINGS:
                  "1",
              },

              encoding:
                "utf8",

              timeout:
                30_000,
            }
          );


        if (
          result.error
        ) {
          throw result.error;
        }


        const output = [
          result.stdout,
          result.stderr,
        ]
          .filter(Boolean)
          .join("\n");


        assert.equal(
          result.status,
          0,
          [
            "db:load-products deveria finalizar com exit code 0.",
            "",
            output,
          ].join("\n")
        );


        assert.ok(
          existsSync(
            databasePath
          ),
          "O comando deve criar o SQLite temporário"
        );


        assert.match(
          output,
          /Produtos carregados:/,
          "CLI deve informar resultado da carga"
        );


        assert.doesNotMatch(
          output,
          /Top-level await is currently not supported/i,
          "CLI não pode apresentar erro de top-level await"
        );
      }
    );


    test(
      "CLI deve inserir os produtos completos no SQLite temporário",
      () => {
        assert.ok(
          existsSync(
            databasePath
          ),
          "Banco temporário deveria existir"
        );


        const db =
          new Database(
            databasePath,
            {
              readonly: true,
            }
          );


        try {
          const products =
            db
              .prepare(`
                SELECT
                  id,
                  slug,
                  title,
                  active,
                  cover,
                  highlights,
                  syllabus,
                  testimonial
                FROM products
                ORDER BY id
              `)
              .all();


          assert.ok(
            products.length >= 3,
            "CLI deve importar pelo menos três produtos"
          );


          for (
            const product of products
          ) {
            assert.ok(
              product.slug,
              "Produto deve possuir slug"
            );


            assert.ok(
              product.title,
              "Produto deve possuir título"
            );


            assert.equal(
              product.active,
              1,
              `${product.slug} deve estar ativo`
            );


            assert.match(
              product.cover,
              /^\/covers\//,
              `${product.slug} deve utilizar capa local`
            );


            assert.ok(
              product.highlights,
              `${product.slug} deve possuir highlights`
            );


            assert.ok(
              product.syllabus,
              `${product.slug} deve possuir syllabus`
            );


            assert.ok(
              product.testimonial,
              `${product.slug} deve possuir testimonial`
            );


            assert.ok(
              Array.isArray(
                JSON.parse(
                  product.highlights
                )
              ),
              `${product.slug}: highlights deve ser JSON válido`
            );


            assert.ok(
              Array.isArray(
                JSON.parse(
                  product.syllabus
                )
              ),
              `${product.slug}: syllabus deve ser JSON válido`
            );


            const testimonial =
              JSON.parse(
                product.testimonial
              );


            assert.equal(
              typeof testimonial,
              "object",
              `${product.slug}: testimonial deve ser JSON válido`
            );
          }


          const integrity =
            db.pragma(
              "integrity_check",
              {
                simple: true,
              }
            );


          assert.equal(
            integrity,
            "ok",
            "SQLite temporário deve permanecer íntegro"
          );
        } finally {
          db.close();
        }
      }
    );


    test(
      "executar CLI novamente não deve duplicar produtos",
      () => {
        const beforeDb =
          new Database(
            databasePath,
            {
              readonly: true,
            }
          );


        let beforeCount;


        try {
          beforeCount =
            beforeDb
              .prepare(`
                SELECT COUNT(*) AS total
                FROM products
              `)
              .get()
              .total;
        } finally {
          beforeDb.close();
        }


        const result =
          spawnSync(
            "npm",
            [
              "run",
              "db:load-products",
            ],
            {
              cwd:
                process.cwd(),

              env: {
                ...process.env,

                DATABASE_PATH:
                  databasePath,

                NODE_ENV:
                  "test",

                NODE_NO_WARNINGS:
                  "1",
              },

              encoding:
                "utf8",

              timeout:
                30_000,
            }
          );


        const output = [
          result.stdout,
          result.stderr,
        ]
          .filter(Boolean)
          .join("\n");


        assert.equal(
          result.status,
          0,
          output
        );


        const afterDb =
          new Database(
            databasePath,
            {
              readonly: true,
            }
          );


        try {
          const afterCount =
            afterDb
              .prepare(`
                SELECT COUNT(*) AS total
                FROM products
              `)
              .get()
              .total;


          assert.equal(
            afterCount,
            beforeCount,
            "Segunda execução não deve duplicar produtos"
          );
        } finally {
          afterDb.close();
        }
      }
    );
  }
);