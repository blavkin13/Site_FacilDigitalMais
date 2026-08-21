import {
  after,
  before,
  describe,
  test,
} from "node:test";

import assert from "node:assert/strict";

import {
  existsSync,
  readFileSync,
} from "node:fs";

import {
  join,
} from "node:path";

import {
  NextRequest,
} from "next/server";

import {
  eq,
} from "drizzle-orm";

import {
  createIsolatedDatabase,
} from "./helpers/isolated-database.mjs";


function createMultipartRequest({
  method =
    "POST",

  productId,

  token =
    null,

  kind =
    null,

  file =
    null,

  query =
    "",
}) {
  const headers =
    new Headers();


  if (
    token
  ) {
    headers.set(
      "cookie",
      `fd-session=${token}`
    );
  }


  let body;


  if (
    method ===
    "POST"
  ) {
    const formData =
      new FormData();


    if (
      kind !==
      null
    ) {
      formData.set(
        "kind",
        kind
      );
    }


    if (
      file !==
      null
    ) {
      formData.set(
        "file",
        file
      );
    }


    body =
      formData;
  }


  return new NextRequest(
    `http://localhost/api/admin/products/${productId}/assets${query}`,
    {
      method,
      headers,
      body,
    }
  );
}


function routeContext(
  productId
) {
  return {
    params:
      Promise.resolve({
        id:
          String(
            productId
          ),
      }),
  };
}


function pngBytes() {
  return new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,

    0x00,
    0x00,
    0x00,
    0x00,
  ]);
}


function pdfBytes() {
  return new TextEncoder()
    .encode(
      [
        "%PDF-1.4",
        "1 0 obj",
        "<< /Type /Catalog >>",
        "endobj",
        "%%EOF",
      ].join(
        "\n"
      )
    );
}


describe(
  "Fase 3C-A - Upload seguro de capas e PDFs",
  () => {
    let isolated;
    let previousUploadRoot;

    let adminToken;
    let userToken;
    let productId;

    let assetRoute;
    let mediaRoute;
    let storage;

    let getDb;
    let products;


    before(
      async () => {
        isolated =
          await createIsolatedDatabase({
            admin:
              true,

            products:
              true,
          });


        previousUploadRoot =
          process.env
            .UPLOAD_ROOT_DIR;


        process.env
          .UPLOAD_ROOT_DIR =
          join(
            isolated.rootDirectory,
            "uploads"
          );


        const auth =
          await import(
            "../lib/auth.ts"
          );


        await auth.registerUser(
          "admin-3c@teste.local",
          "SenhaAdmin3C123",
          "Administrador 3C",
          undefined,
          undefined,
          "admin"
        );


        await auth.registerUser(
          "aluno-3c@teste.local",
          "SenhaAluno3C123",
          "Aluno 3C"
        );


        const adminLogin =
          await auth.authenticateUser(
            "admin-3c@teste.local",
            "SenhaAdmin3C123"
          );


        const userLogin =
          await auth.authenticateUser(
            "aluno-3c@teste.local",
            "SenhaAluno3C123"
          );


        assert.ok(
          adminLogin
        );


        assert.ok(
          userLogin
        );


        adminToken =
          adminLogin.session.token;


        userToken =
          userLogin.session.token;


        ({
          getDb,
        } =
          await import(
            "../db/index.ts"
          ));


        ({
          products,
        } =
          await import(
            "../db/schema.ts"
          ));


        const product =
          await getDb()
            .select()
            .from(
              products
            )
            .limit(
              1
            )
            .get();


        assert.ok(
          product
        );


        productId =
          product.id;


        assetRoute =
          await import(
            "../app/api/admin/products/[id]/assets/route.ts"
          );


        mediaRoute =
          await import(
            "../app/api/media/covers/[filename]/route.ts"
          );


        storage =
          await import(
            "../lib/admin-product-storage.ts"
          );
      }
    );


    test(
      "storage deve utilizar diretório temporário configurável",
      () => {
        assert.equal(
          storage
            .getUploadRootDirectory(),
          join(
            isolated.rootDirectory,
            "uploads"
          )
        );


        assert.notEqual(
          storage
            .getUploadRootDirectory(),
          join(
            process.cwd(),
            "data",
            "uploads"
          )
        );
      }
    );


    test(
      "API deve bloquear upload sem sessão",
      async () => {
        const response =
          await assetRoute.POST(
            createMultipartRequest({
              productId,

              kind:
                "cover",

              file:
                new File(
                  [
                    pngBytes(),
                  ],
                  "capa.png",
                  {
                    type:
                      "image/png",
                  }
                ),
            }),

            routeContext(
              productId
            )
          );


        assert.equal(
          response.status,
          401
        );
      }
    );


    test(
      "API deve bloquear aluno autenticado",
      async () => {
        const response =
          await assetRoute.POST(
            createMultipartRequest({
              productId,

              token:
                userToken,

              kind:
                "cover",

              file:
                new File(
                  [
                    pngBytes(),
                  ],
                  "capa.png",
                  {
                    type:
                      "image/png",
                  }
                ),
            }),

            routeContext(
              productId
            )
          );


        assert.equal(
          response.status,
          403
        );
      }
    );


    test(
      "upload deve rejeitar extensão e MIME inconsistentes",
      async () => {
        const response =
          await assetRoute.POST(
            createMultipartRequest({
              productId,

              token:
                adminToken,

              kind:
                "cover",

              file:
                new File(
                  [
                    pngBytes(),
                  ],
                  "capa.jpg",
                  {
                    type:
                      "image/png",
                  }
                ),
            }),

            routeContext(
              productId
            )
          );


        assert.equal(
          response.status,
          415
        );
      }
    );


    test(
      "upload deve rejeitar arquivo falso mesmo com extensão PDF",
      async () => {
        const response =
          await assetRoute.POST(
            createMultipartRequest({
              productId,

              token:
                adminToken,

              kind:
                "pdf",

              file:
                new File(
                  [
                    "<html>não é pdf</html>",
                  ],
                  "apostila.pdf",
                  {
                    type:
                      "application/pdf",
                  }
                ),
            }),

            routeContext(
              productId
            )
          );


        assert.equal(
          response.status,
          415
        );
      }
    );


    test(
      "capa deve receber nome seguro e ser servida pela rota pública",
      async () => {
        const originalName =
          "../../tentativa-traversal.png";


        const response =
          await assetRoute.POST(
            createMultipartRequest({
              productId,

              token:
                adminToken,

              kind:
                "cover",

              file:
                new File(
                  [
                    pngBytes(),
                  ],
                  originalName,
                  {
                    type:
                      "image/png",
                  }
                ),
            }),

            routeContext(
              productId
            )
          );


        assert.equal(
          response.status,
          200
        );


        const data =
          await response.json();


        assert.equal(
          data.success,
          true
        );


        assert.equal(
          data.kind,
          "cover"
        );


        assert.match(
          data.product.cover,
          /^\/api\/media\/covers\/\d+-[0-9a-f-]+\.png$/i
        );


        assert.doesNotMatch(
          data.product.cover,
          /tentativa-traversal/
        );


        assert.doesNotMatch(
          data.product.cover,
          /\.\./
        );


        const filename =
          storage
            .managedCoverFilenameFromReference(
              data.product.cover
            );


        assert.ok(
          filename
        );


        const absolutePath =
          storage
            .resolveManagedCoverPath(
              data.product.cover
            );


        assert.ok(
          absolutePath
        );


        assert.ok(
          existsSync(
            absolutePath
          )
        );


        assert.ok(
          absolutePath.startsWith(
            join(
              isolated.rootDirectory,
              "uploads",
              "covers"
            )
          )
        );


        const mediaResponse =
          await mediaRoute.GET(
            new NextRequest(
              `http://localhost/api/media/covers/${filename}`
            ),
            {
              params:
                Promise.resolve({
                  filename,
                }),
            }
          );


        assert.equal(
          mediaResponse.status,
          200
        );


        assert.equal(
          mediaResponse.headers.get(
            "content-type"
          ),
          "image/png"
        );


        assert.equal(
          mediaResponse.headers.get(
            "x-content-type-options"
          ),
          "nosniff"
        );
      }
    );


    test(
      "substituição de capa deve remover arquivo gerenciado anterior",
      async () => {
        const before =
          await getDb()
            .select()
            .from(
              products
            )
            .where(
              eq(
                products.id,
                productId
              )
            )
            .get();


        assert.ok(
          before?.cover
        );


        const previousPath =
          storage
            .resolveManagedCoverPath(
              before.cover
            );


        assert.ok(
          previousPath
        );


        assert.ok(
          existsSync(
            previousPath
          )
        );


        const response =
          await assetRoute.POST(
            createMultipartRequest({
              productId,

              token:
                adminToken,

              kind:
                "cover",

              file:
                new File(
                  [
                    pngBytes(),
                  ],
                  "nova-capa.png",
                  {
                    type:
                      "image/png",
                  }
                ),
            }),

            routeContext(
              productId
            )
          );


        assert.equal(
          response.status,
          200
        );


        assert.equal(
          existsSync(
            previousPath
          ),
          false
        );


        const data =
          await response.json();


        assert.notEqual(
          data.product.cover,
          before.cover
        );
      }
    );


    test(
      "PDF deve ficar privado e banco deve armazenar somente referência gerenciada",
      async () => {
        const response =
          await assetRoute.POST(
            createMultipartRequest({
              productId,

              token:
                adminToken,

              kind:
                "pdf",

              file:
                new File(
                  [
                    pdfBytes(),
                  ],
                  "../../apostila-secreta.pdf",
                  {
                    type:
                      "application/pdf",
                  }
                ),
            }),

            routeContext(
              productId
            )
          );


        assert.equal(
          response.status,
          200
        );


        const data =
          await response.json();


        assert.match(
          data.product.pdfPath,
          /^managed-pdf:\d+-[0-9a-f-]+\.pdf$/i
        );


        assert.equal(
          data.asset.url,
          null
        );


        assert.doesNotMatch(
          data.product.pdfPath,
          /apostila-secreta/
        );


        const pdfPath =
          storage
            .resolveManagedPdfPath(
              data.product.pdfPath
            );


        assert.ok(
          pdfPath
        );


        assert.ok(
          existsSync(
            pdfPath
          )
        );


        assert.ok(
          pdfPath.startsWith(
            join(
              isolated.rootDirectory,
              "uploads",
              "pdfs"
            )
          )
        );
      }
    );


    test(
      "remover arquivo deve despublicar produto e apagar apenas arquivo gerenciado",
      async () => {
        const before =
          await getDb()
            .select()
            .from(
              products
            )
            .where(
              eq(
                products.id,
                productId
              )
            )
            .get();


        assert.ok(
          before?.cover
        );


        const coverPath =
          storage
            .resolveManagedCoverPath(
              before.cover
            );


        assert.ok(
          coverPath
        );


        const response =
          await assetRoute.DELETE(
            createMultipartRequest({
              method:
                "DELETE",

              productId,

              token:
                adminToken,

              query:
                "?kind=cover",
            }),

            routeContext(
              productId
            )
          );


        assert.equal(
          response.status,
          200
        );


        const data =
          await response.json();


        assert.equal(
          data.product.cover,
          null
        );


        assert.equal(
          data.product.active,
          false
        );


        assert.equal(
          existsSync(
            coverPath
          ),
          false
        );
      }
    );


    test(
      "rota pública não deve aceitar traversal ou nomes arbitrários",
      async () => {
        const invalidNames = [
          "../dev.db",
          "arquivo.png",
          "../../segredo.webp",
          "1-nao-e-uuid.png",
        ];


        for (
          const filename of invalidNames
        ) {
          const response =
            await mediaRoute.GET(
              new NextRequest(
                "http://localhost/api/media/covers/test"
              ),
              {
                params:
                  Promise.resolve({
                    filename,
                  }),
              }
            );


          assert.equal(
            response.status,
            404,
            `Nome inválido deve retornar 404: ${filename}`
          );
        }
      }
    );


    test(
      "implementação não pode gravar upload em public/",
      () => {
        const storageSource =
          readFileSync(
            join(
              process.cwd(),
              "lib",
              "admin-product-storage.ts"
            ),
            "utf8"
          );


        assert.doesNotMatch(
          storageSource,
          /join\s*\(\s*process\.cwd\(\)\s*,\s*["']public["']/,
          "Uploads de runtime não devem ser armazenados dentro de public/"
        );


        assert.match(
          storageSource,
          /UPLOAD_ROOT_DIR/
        );


        assert.match(
          storageSource,
          /randomUUID/
        );


        assert.match(
          storageSource,
          /MAX_COVER_UPLOAD_BYTES/
        );


        assert.match(
          storageSource,
          /MAX_PDF_UPLOAD_BYTES/
        );
      }
    );


    after(
      () => {
        if (
          previousUploadRoot ===
          undefined
        ) {
          delete process.env
            .UPLOAD_ROOT_DIR;
        } else {
          process.env
            .UPLOAD_ROOT_DIR =
            previousUploadRoot;
        }


        isolated?.cleanup();


        console.log(
          "✅ Fase 3C-A concluída sem tocar armazenamento persistente."
        );
      }
    );
  }
);