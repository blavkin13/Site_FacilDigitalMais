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
  utimesSync,
  writeFileSync,
} from "node:fs";

import {
  tmpdir,
} from "node:os";

import {
  dirname,
  join,
} from "node:path";

import {
  PDFDocument,
} from "pdf-lib";


describe(
  "Fase 4 - Checkout e Proteção de PDFs",
  () => {
    let temporaryDirectory;
    let protectedDirectory;
    let previousProtectedDirectory;


    before(
      () => {
        console.log(
          "🧪 Preparando testes isolados da Fase 4..."
        );


        temporaryDirectory =
          mkdtempSync(
            join(
              tmpdir(),
              "facildigital-pdf-"
            )
          );


        protectedDirectory =
          join(
            temporaryDirectory,
            "protected"
          );


        previousProtectedDirectory =
          process.env
            .PROTECTED_PDF_DIR;


        process.env.PROTECTED_PDF_DIR =
          protectedDirectory;


        console.log(
          `🧪 PDFs isolados: ${protectedDirectory}`
        );
      }
    );


    test(
      "lib/mercadopago.ts existe",
      () => {
        assert.ok(
          existsSync(
            join(
              process.cwd(),
              "lib",
              "mercadopago.ts"
            )
          )
        );
      }
    );


    test(
      "lib/pdf-protection.ts existe",
      () => {
        assert.ok(
          existsSync(
            join(
              process.cwd(),
              "lib",
              "pdf-protection.ts"
            )
          )
        );
      }
    );


    test(
      "API checkout/create existe",
      () => {
        assert.ok(
          existsSync(
            join(
              process.cwd(),
              "app",
              "api",
              "checkout",
              "create",
              "route.ts"
            )
          )
        );
      }
    );


    test(
      "API webhook mercadopago existe",
      () => {
        assert.ok(
          existsSync(
            join(
              process.cwd(),
              "app",
              "api",
              "webhooks",
              "mercadopago",
              "route.ts"
            )
          )
        );
      }
    );


    test(
      "API download/[token] existe",
      () => {
        assert.ok(
          existsSync(
            join(
              process.cwd(),
              "app",
              "api",
              "download",
              "[token]",
              "route.ts"
            )
          )
        );
      }
    );


    test(
      "API download/generate existe",
      () => {
        assert.ok(
          existsSync(
            join(
              process.cwd(),
              "app",
              "api",
              "download",
              "generate",
              "route.ts"
            )
          )
        );
      }
    );


    test(
      "CheckoutReal existe",
      () => {
        assert.ok(
          existsSync(
            join(
              process.cwd(),
              "components",
              "checkout-real.tsx"
            )
          )
        );
      }
    );


    test(
      "CheckoutSuccess existe",
      () => {
        assert.ok(
          existsSync(
            join(
              process.cwd(),
              "components",
              "checkout-success.tsx"
            )
          )
        );
      }
    );


    test(
      "Página de sucesso existe",
      () => {
        assert.ok(
          existsSync(
            join(
              process.cwd(),
              "app",
              "checkout",
              "success",
              "page.tsx"
            )
          )
        );
      }
    );


    test(
      "mercadopago.ts tem funções essenciais",
      () => {
        const content =
          readFileSync(
            join(
              process.cwd(),
              "lib",
              "mercadopago.ts"
            ),
            "utf8"
          );


        for (
          const value of [
            "createPaymentPreference",
            "getPaymentStatus",
            "verifyWebhookSignature",
          ]
        ) {
          assert.ok(
            content.includes(
              value
            )
          );
        }
      }
    );


    test(
      "pdf-protection.ts tem funções essenciais",
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


        for (
          const value of [
            "addWatermarkToPdf",
            "generateProtectedPdf",
            "validateCpf",
            "cleanupExpiredPdfs",
            "getProtectedPdfByToken",
            "PROTECTED_PDF_DIR",
          ]
        ) {
          assert.ok(
            content.includes(
              value
            )
          );
        }
      }
    );


    test(
      "API checkout cria preferência e pedido",
      () => {
        const routeContent =
          readFileSync(
            join(
              process.cwd(),
              "app",
              "api",
              "checkout",
              "create",
              "route.ts"
            ),
            "utf8"
          );


        const handlerContent =
          readFileSync(
            join(
              process.cwd(),
              "lib",
              "checkout-route-handler.ts"
            ),
            "utf8"
          );


        assert.match(
          routeContent,
          /createCheckoutPostHandler/
        );


        assert.match(
          handlerContent,
          /createPaymentPreference/
        );


        assert.match(
          handlerContent,
          /pending/
        );


        assert.match(
          handlerContent,
          /externalReference/
        );
      }
    );


    test(
      "Webhook processa pagamentos",
      () => {
        const content =
          readFileSync(
            join(
              process.cwd(),
              "app",
              "api",
              "webhooks",
              "mercadopago",
              "route.ts"
            ),
            "utf8"
          );


        assert.match(
          content,
          /verifyWebhookSignature/
        );


        assert.match(
          content,
          /statusMap/
        );


        assert.match(
          content,
          /approved/
        );
      }
    );


    test(
      "Checkout real substitui demo",
      () => {
        const content =
          readFileSync(
            join(
              process.cwd(),
              "app",
              "checkout",
              "page.tsx"
            ),
            "utf8"
          );


        assert.match(
          content,
          /CheckoutReal/
        );


        assert.doesNotMatch(
          content,
          /CheckoutDemo/
        );
      }
    );


    test(
      "Dashboard tem botão de download funcional",
      () => {
        const content =
          readFileSync(
            join(
              process.cwd(),
              "components",
              "student-dashboard.tsx"
            ),
            "utf8"
          );


        assert.match(
          content,
          /DownloadButton/
        );


        assert.match(
          content,
          /\/api\/download\/generate/
        );
      }
    );


    test(
      "Validação de CPF funciona",
      async () => {
        const {
          formatCpf,
          validateCpf,
        } =
          await import(
            "../lib/pdf-protection.ts"
          );


        assert.equal(
          validateCpf(
            "52998224725"
          ),
          true
        );


        assert.equal(
          validateCpf(
            "11144477735"
          ),
          true
        );


        assert.equal(
          validateCpf(
            "11111111111"
          ),
          false
        );


        assert.equal(
          validateCpf(
            "12345678900"
          ),
          false
        );


        assert.equal(
          validateCpf(
            "123"
          ),
          false
        );


        assert.equal(
          formatCpf(
            "52998224725"
          ),
          "529.982.247-25"
        );


        console.log(
          "✅ Validação de CPF funciona"
        );
      }
    );


    test(
      "Geração de PDF protegido fica exclusivamente em /tmp",
      async () => {
        const {
          addWatermarkToPdf,
          cleanupExpiredPdfs,
          generateProtectedPdf,
          getProtectedPdfByToken,
          getProtectedPdfDirectory,
        } =
          await import(
            "../lib/pdf-protection.ts"
          );


        assert.equal(
          getProtectedPdfDirectory(),
          protectedDirectory
        );


        const pdfDocument =
          await PDFDocument.create();


        pdfDocument.addPage([
          595,
          842,
        ]);


        const pdfBytes =
          await pdfDocument.save();


        const sourcePath =
          join(
            temporaryDirectory,
            "source.pdf"
          );


        writeFileSync(
          sourcePath,
          pdfBytes
        );


        const watermarked =
          await addWatermarkToPdf(
            pdfBytes,
            "52998224725"
          );


        assert.ok(
          watermarked.length >
            0
        );


        const checkDocument =
          await PDFDocument.load(
            watermarked
          );


        assert.equal(
          checkDocument.getPageCount(),
          1
        );


        const generated =
          await generateProtectedPdf(
            sourcePath,
            "52998224725",
            999
          );


        assert.equal(
          dirname(
            generated.protectedPath
          ),
          protectedDirectory
        );


        assert.ok(
          existsSync(
            generated.protectedPath
          )
        );


        const located =
          await getProtectedPdfByToken(
            generated.downloadToken
          );


        assert.ok(
          located
        );


        assert.equal(
          located.filePath,
          generated.protectedPath
        );


        /**
         * Envelhece o arquivo artificialmente para testar
         * o cleanup sem esperar 12 horas.
         */
        const expiredDate =
          new Date(
            Date.now() -
              13 *
                60 *
                60 *
                1000
          );


        utimesSync(
          generated.protectedPath,
          expiredDate,
          expiredDate
        );


        const removed =
          await cleanupExpiredPdfs();


        assert.ok(
          removed >= 1
        );


        assert.equal(
          existsSync(
            generated.protectedPath
          ),
          false
        );


        console.log(
          "✅ PDF protegido criado e removido apenas no diretório temporário"
        );
      }
    );


    test(
      "CSS de checkout foi adicionado",
      () => {
        const content =
          readFileSync(
            join(
              process.cwd(),
              "app",
              "extra.css"
            ),
            "utf8"
          );


        for (
          const className of [
            ".checkout-auth-required",
            ".checkout-success-page",
            ".success-icon",
            ".cpf-warning",
          ]
        ) {
          assert.ok(
            content.includes(
              className
            )
          );
        }
      }
    );


    test(
      "Fases anteriores preservadas",
      () => {
        for (
          const path of [
            "lib/auth.ts",
            "components/auth-provider.tsx",
            "components/student-dashboard.tsx",
            "components/simulation-quiz.tsx",
            "app/api/orders/route.ts",
            "app/api/simulations/route.ts",
          ]
        ) {
          assert.ok(
            existsSync(
              join(
                process.cwd(),
                path
              )
            ),
            `${path} deve existir`
          );
        }
      }
    );


    after(
      () => {
        if (
          previousProtectedDirectory ===
          undefined
        ) {
          delete process.env
            .PROTECTED_PDF_DIR;
        } else {
          process.env.PROTECTED_PDF_DIR =
            previousProtectedDirectory;
        }


        rmSync(
          temporaryDirectory,
          {
            recursive: true,
            force: true,
          }
        );


        console.log(
          "✅ Testes da Fase 4 concluídos sem resíduos persistentes!"
        );
      }
    );
  }
);