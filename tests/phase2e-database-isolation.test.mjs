import {
  after,
  before,
  describe,
  test,
} from "node:test";

import assert from "node:assert/strict";

import {
  createHash,
} from "node:crypto";

import {
  existsSync,
  readFileSync,
} from "node:fs";

import {
  join,
} from "node:path";

import Database from "better-sqlite3";

import {
  createIsolatedDatabase,
} from "./helpers/isolated-database.mjs";


function fileHash(
  path
) {
  if (
    !existsSync(
      path
    )
  ) {
    return null;
  }


  return createHash(
    "sha256"
  )
    .update(
      readFileSync(
        path
      )
    )
    .digest(
      "hex"
    );
}


function readTest(
  filename
) {
  return readFileSync(
    join(
      process.cwd(),
      "tests",
      filename
    ),
    "utf8"
  );
}


function assertNoPersistentDatabaseAccess(
  content,
  filename
) {
  assert.doesNotMatch(
    content,
    /join\s*\([\s\S]{0,150}["']data["'][\s\S]{0,80}["']dev\.db["']/,
    `${filename} não pode montar caminho para data/dev.db`
  );


  assert.doesNotMatch(
    content,
    /new\s+Database\s*\([\s\S]{0,120}dev\.db/,
    `${filename} não pode abrir dev.db diretamente`
  );
}


describe(
  "Fase 2E - Isolamento completo dos testes",
  () => {
    const developmentDatabase =
      join(
        process.cwd(),
        "data",
        "dev.db"
      );


    let developmentHashBefore;
    let isolated;


    before(
      async () => {
        developmentHashBefore =
          fileHash(
            developmentDatabase
          );


        isolated =
          await createIsolatedDatabase({
            simulations: true,
          });
      }
    );


    test(
      "banco de teste deve estar fora do projeto persistente",
      () => {
        assert.notEqual(
          isolated.databasePath,
          developmentDatabase
        );


        assert.match(
          isolated.databasePath,
          /facildigital-test-/
        );


        assert.ok(
          existsSync(
            isolated.databasePath
          )
        );
      }
    );


    test(
      "fixtures completas devem existir no SQLite isolado",
      () => {
        const sqlite =
          new Database(
            isolated.databasePath,
            {
              readonly: true,
            }
          );


        try {
          for (
            const table of [
              "users",
              "products",
              "orders",
              "questions",
              "simulations",
            ]
          ) {
            const result =
              sqlite
                .prepare(
                  `SELECT COUNT(*) AS total FROM ${table}`
                )
                .get();


            assert.ok(
              Number(
                result.total
              ) > 0,
              `${table} deve possuir fixtures`
            );
          }


          assert.equal(
            sqlite.pragma(
              "integrity_check",
              {
                simple: true,
              }
            ),
            "ok"
          );
        } finally {
          sqlite.close();
        }
      }
    );


    test(
      "Fase 1 deve utilizar banco isolado",
      () => {
        const content =
          readTest(
            "auth.test.mjs"
          );


        assert.match(
          content,
          /createIsolatedDatabase/
        );


        assertNoPersistentDatabaseAccess(
          content,
          "auth.test.mjs"
        );
      }
    );


    test(
      "Fase 2 deve utilizar banco isolado sem subprocesso temporário",
      () => {
        const content =
          readTest(
            "phase2.test.mjs"
          );


        assert.match(
          content,
          /createIsolatedDatabase/
        );


        assert.doesNotMatch(
          content,
          /_tmp_auth_test/
        );


        assert.doesNotMatch(
          content,
          /execSync/
        );


        assertNoPersistentDatabaseAccess(
          content,
          "phase2.test.mjs"
        );
      }
    );


    test(
      "Fase 3A deve utilizar banco isolado",
      () => {
        const content =
          readTest(
            "phase3.test.mjs"
          );


        assert.match(
          content,
          /createIsolatedDatabase/
        );


        assert.doesNotMatch(
          content,
          /npx\s+tsx\s+db\/seed-orders/
        );


        assertNoPersistentDatabaseAccess(
          content,
          "phase3.test.mjs"
        );
      }
    );


    test(
      "Fase 3B deve utilizar banco isolado",
      () => {
        const content =
          readTest(
            "phase3b.test.mjs"
          );


        assert.match(
          content,
          /createIsolatedDatabase/
        );


        assert.doesNotMatch(
          content,
          /npx\s+tsx\s+db\/seed-simulations/
        );


        assertNoPersistentDatabaseAccess(
          content,
          "phase3b.test.mjs"
        );
      }
    );


    test(
      "Fase 4 deve utilizar diretório temporário para PDFs",
      () => {
        const content =
          readTest(
            "phase4.test.mjs"
          );


        assert.match(
          content,
          /mkdtempSync/
        );


        assert.match(
          content,
          /PROTECTED_PDF_DIR/
        );


        assert.doesNotMatch(
          content,
          /_tmp_pdf_test/
        );


        assert.doesNotMatch(
          content,
          /_tmp_cpf_test/
        );
      }
    );


    test(
      "runtime de PDF deve respeitar PROTECTED_PDF_DIR",
      () => {
        const content =
          readFileSync(
            join(
              process.cwd(),
              "lib",
              "pdf-protection.ts"
            ),
            "utf8"
          );


        assert.match(
          content,
          /process\.env[\s\S]*PROTECTED_PDF_DIR/
        );


        assert.match(
          content,
          /getProtectedPdfDirectory/
        );
      }
    );


    test(
      "test:all deve utilizar guard global",
      () => {
        const packageJson =
          JSON.parse(
            readFileSync(
              join(
                process.cwd(),
                "package.json"
              ),
              "utf8"
            )
          );


        assert.match(
          packageJson.scripts[
            "test:all"
          ],
          /run-test-all\.mjs/
        );


        assert.match(
          packageJson.scripts[
            "test:all"
          ],
          /test:phase0/
        );


        assert.match(
          packageJson.scripts[
            "test:all"
          ],
          /test:phase2e/
        );
      }
    );


    test(
      "guard global deve proteger o diretório data",
      () => {
        const content =
          readFileSync(
            join(
              process.cwd(),
              "scripts",
              "run-test-all.mjs"
            ),
            "utf8"
          );


        assert.match(
          content,
          /snapshotDataDirectory/
        );


        assert.match(
          content,
          /dataDirectory/
        );


        assert.match(
          content,
          /createHash/
        );


        assert.match(
          content,
          /spawnSync/
        );
      }
    );


    after(
      () => {
        isolated?.cleanup();


        const developmentHashAfter =
          fileHash(
            developmentDatabase
          );


        assert.equal(
          developmentHashAfter,
          developmentHashBefore,
          "A Fase 2E não pode modificar data/dev.db"
        );


        console.log(
          "✅ SQLite persistente permaneceu inalterado."
        );
      }
    );
  }
);