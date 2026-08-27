import assert from "node:assert/strict";

import {
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

import {
  after,
  beforeEach,
  describe,
  test,
} from "node:test";


const temporaryDirectory =
  mkdtempSync(
    join(
      tmpdir(),
      "fd-p0-entitlement-"
    )
  );


const databasePath =
  join(
    temporaryDirectory,
    "entitlement.db"
  );


const previousDatabasePath =
  process.env
    .DATABASE_PATH;


process.env.DATABASE_PATH =
  databasePath;


const {
  closeDatabase,
  getSqliteConnection,
} =
  await import(
    "../db/index.ts"
  );


const {
  getUserPurchasedProducts,
  userHasPurchases,
  userOwnsProduct,
} =
  await import(
    "../lib/orders.ts"
  );


const sqlite =
  getSqliteConnection();


sqlite.exec(`
  CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
      DEFAULT (datetime('now'))
  );

  CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    short_title TEXT,
    cover TEXT,
    cover_class TEXT
  );

  CREATE TABLE order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL
  );
`);


function clearDatabase() {
  sqlite.exec(`
    DELETE FROM order_items;
    DELETE FROM orders;
    DELETE FROM products;
  `);
}


function createProduct(
  slug
) {
  const result =
    sqlite
      .prepare(`
        INSERT INTO products (
          slug,
          title,
          short_title,
          cover,
          cover_class
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?
        )
      `)
      .run(
        slug,
        `Produto ${slug}`,
        `Curto ${slug}`,
        null,
        null
      );


  return Number(
    result.lastInsertRowid
  );
}


function createOrder({
  userId,
  status,
}) {
  const result =
    sqlite
      .prepare(`
        INSERT INTO orders (
          user_id,
          status,
          created_at
        )
        VALUES (
          ?,
          ?,
          datetime('now')
        )
      `)
      .run(
        userId,
        status
      );


  return Number(
    result.lastInsertRowid
  );
}


function attachProduct(
  orderId,
  productId
) {
  sqlite
    .prepare(`
      INSERT INTO order_items (
        order_id,
        product_id
      )
      VALUES (
        ?,
        ?
      )
    `)
    .run(
      orderId,
      productId
    );
}


function createPurchase({
  userId,
  status,
  slug,
}) {
  const productId =
    createProduct(
      slug
    );


  const orderId =
    createOrder({
      userId,
      status,
    });


  attachProduct(
    orderId,
    productId
  );


  return {
    orderId,
    productId,
  };
}


beforeEach(
  () => {
    clearDatabase();
  }
);


after(
  () => {
    closeDatabase();


    if (
      previousDatabasePath ===
      undefined
    ) {
      delete process.env
        .DATABASE_PATH;
    } else {
      process.env.DATABASE_PATH =
        previousDatabasePath;
    }


    rmSync(
      temporaryDirectory,
      {
        recursive:
          true,

        force:
          true,
      }
    );
  }
);


describe(
  "P0 - autoridade de entitlement",
  () => {
    test(
      "userHasPurchases aceita somente pedido approved",
      async () => {
        for (
          const status
          of [
            "pending",
            "rejected",
            "refunded",
            "charged_back",
          ]
        ) {
          clearDatabase();


          createPurchase({
            userId:
              1,

            status,

            slug:
              `produto-${status}`,
          });


          assert.equal(
            await userHasPurchases(
              1
            ),
            false,
            `${status} não pode representar compra ativa`
          );
        }


        clearDatabase();


        createPurchase({
          userId:
            1,

          status:
            "approved",

          slug:
            "produto-approved",
        });


        assert.equal(
          await userHasPurchases(
            1
          ),
          true
        );
      }
    );


    test(
      "userOwnsProduct exige usuário, approved e slug exatos",
      async () => {
        createPurchase({
          userId:
            1,

          status:
            "approved",

          slug:
            "apostila-a",
        });


        createPurchase({
          userId:
            1,

          status:
            "pending",

          slug:
            "apostila-b",
        });


        createPurchase({
          userId:
            2,

          status:
            "approved",

          slug:
            "apostila-c",
        });


        assert.equal(
          await userOwnsProduct(
            1,
            "apostila-a"
          ),
          true,
          "produto approved do próprio usuário deve liberar"
        );


        assert.equal(
          await userOwnsProduct(
            1,
            "apostila-b"
          ),
          false,
          "produto pending não pode liberar"
        );


        assert.equal(
          await userOwnsProduct(
            1,
            "apostila-c"
          ),
          false,
          "produto approved de outro usuário não pode liberar"
        );


        assert.equal(
          await userOwnsProduct(
            1,
            "produto-inexistente"
          ),
          false,
          "outro slug não pode ser aceito"
        );
      }
    );


    test(
      "userOwnsProduct não confunde outro produto do mesmo pedido",
      async () => {
        const productA =
          createProduct(
            "produto-a"
          );


        const productB =
          createProduct(
            "produto-b"
          );


        const orderId =
          createOrder({
            userId:
              1,

            status:
              "approved",
          });


        attachProduct(
          orderId,
          productA
        );


        assert.equal(
          await userOwnsProduct(
            1,
            "produto-a"
          ),
          true
        );


        assert.equal(
          await userOwnsProduct(
            1,
            "produto-b"
          ),
          false,
          "existência do produto no catálogo não significa que ele foi comprado"
        );
      }
    );


    test(
      "getUserPurchasedProducts retorna apenas entitlement aprovado",
      async () => {
        createPurchase({
          userId:
            1,

          status:
            "approved",

          slug:
            "apostila-approved",
        });


        createPurchase({
          userId:
            1,

          status:
            "pending",

          slug:
            "apostila-pending",
        });


        createPurchase({
          userId:
            1,

          status:
            "refunded",

          slug:
            "apostila-refunded",
        });


        createPurchase({
          userId:
            1,

          status:
            "charged_back",

          slug:
            "apostila-chargeback",
        });


        createPurchase({
          userId:
            2,

          status:
            "approved",

          slug:
            "apostila-outro-usuario",
        });


        const result =
          await getUserPurchasedProducts(
            1
          );


        assert.deepEqual(
          result.map(
            (
              item
            ) =>
              item.slug
          ),
          [
            "apostila-approved",
          ]
        );


        assert.ok(
          result.every(
            (
              item
            ) =>
              item.status ===
              "approved"
          )
        );
      }
    );


    test(
      "inputs inválidos falham fechados",
      async () => {
        assert.equal(
          await userHasPurchases(
            0
          ),
          false
        );


        assert.equal(
          await userHasPurchases(
            -1
          ),
          false
        );


        assert.equal(
          await userOwnsProduct(
            0,
            "apostila"
          ),
          false
        );


        assert.equal(
          await userOwnsProduct(
            1,
            "   "
          ),
          false
        );


        assert.deepEqual(
          await getUserPurchasedProducts(
            0
          ),
          []
        );
      }
    );


    test(
      "geração de download exige pedido approved e produto exato",
      () => {
        const source =
          readFileSync(
            join(
              process.cwd(),
              "app",
              "api",
              "download",
              "generate",
              "route.ts"
            ),
            "utf8"
          );


        assert.match(
          source,
          /orders\.status[\s\S]{0,100}["']approved["']/
        );


        assert.match(
          source,
          /orders\.userId[\s\S]{0,100}user\.id/
        );


        assert.match(
          source,
          /products\.slug[\s\S]{0,120}productSlug\.trim/
        );
      }
    );


    test(
      "download já emitido revalida pedido, usuário, status e produto",
      () => {
        const source =
          readFileSync(
            join(
              process.cwd(),
              "app",
              "api",
              "download",
              "[token]",
              "route.ts"
            ),
            "utf8"
          );


        for (
          const contract
          of [
            /orders\.id[\s\S]{0,120}downloadRecord\.orderId/,
            /orders\.userId[\s\S]{0,120}user\.id/,
            /orders\.status[\s\S]{0,120}["']approved["']/,
            /orderItems\.productId[\s\S]{0,120}downloadRecord\.productId/,
          ]
        ) {
          assert.match(
            source,
            contract
          );
        }
      }
    );


    test(
      "simulado exige vínculo com produto de pedido approved",
      () => {
        const source =
          readFileSync(
            join(
              process.cwd(),
              "lib",
              "simulation-access.ts"
            ),
            "utf8"
          );


        assert.match(
          source,
          /simulationProducts/
        );


        assert.match(
          source,
          /orderItems/
        );


        assert.match(
          source,
          /orders\.userId[\s\S]{0,120}userId/
        );


        assert.match(
          source,
          /orders\.status[\s\S]{0,120}["']approved["']/
        );


        assert.match(
          source,
          /no_approved_purchase/
        );
      }
    );


    test(
      "tentativas revalidam entitlement durante uso",
      () => {
        const source =
          readFileSync(
            join(
              process.cwd(),
              "lib",
              "simulation-attempts.ts"
            ),
            "utf8"
          );


        const matches =
          source.match(
            /resolveSimulationAccess\s*\(/g
          ) ??
          [];


        assert.ok(
          matches.length >=
            2,
          "entitlement deve ser verificado ao iniciar/retomar e durante tentativa ativa"
        );


        assert.match(
          source,
          /access_revoked/
        );


        assert.match(
          source,
          /status\s*=\s*'revoked'|["']revoked["']/
        );
      }
    );


    test(
      "rotas comerciais não concedem bypass por role admin",
      () => {
        const criticalSources = [
          [
            "app",
            "api",
            "download",
            "generate",
            "route.ts",
          ],

          [
            "app",
            "api",
            "download",
            "[token]",
            "route.ts",
          ],

          [
            "lib",
            "simulation-access.ts",
          ],

          [
            "lib",
            "simulation-attempts.ts",
          ],
        ];


        for (
          const parts
          of criticalSources
        ) {
          const source =
            readFileSync(
              join(
                process.cwd(),
                ...parts
              ),
              "utf8"
            );


          assert.doesNotMatch(
            source,
            /(?:user\.)?role\s*===?\s*["']admin["']/,
            `${parts.join("/")} não pode transformar role admin em entitlement comercial`
          );
        }
      }
    );


    test(
      "helpers legados não podem voltar a aceitar qualquer pedido",
      () => {
        const source =
          readFileSync(
            join(
              process.cwd(),
              "lib",
              "orders.ts"
            ),
            "utf8"
          );


        assert.match(
          source,
          /userHasPurchases[\s\S]*?orders\.status[\s\S]*?["']approved["']/
        );


        assert.match(
          source,
          /userOwnsProduct[\s\S]*?orders\.status[\s\S]*?["']approved["'][\s\S]*?products\.slug/
        );


        assert.doesNotMatch(
          source,
          /return\s+result\.some\s*\([\s\S]{0,200}return\s+true/
        );
      }
    );


    test(
      "suite participa do gate completo",
      () => {
        const pkg =
          JSON.parse(
            readFileSync(
              join(
                process.cwd(),
                "package.json"
              ),
              "utf8"
            )
          );


        assert.equal(
          pkg.scripts[
            "test:p0-entitlement-authority"
          ],
          "NODE_NO_WARNINGS=1 tsx --test --test-isolation=none --no-warnings tests/p0-entitlement-authority.test.mjs"
        );


        assert.match(
          pkg.scripts[
            "test:all"
          ],
          /\btest:p0-entitlement-authority\b/
        );
      }
    );
  }
);