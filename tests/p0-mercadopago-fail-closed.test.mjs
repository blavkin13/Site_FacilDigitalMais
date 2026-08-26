import assert from "node:assert/strict";

import {
  readFileSync,
} from "node:fs";

import {
  join,
} from "node:path";

import {
  describe,
  test,
} from "node:test";

import {
  getAppBaseUrl,
  getMercadoPagoAccessToken,
  PaymentConfigurationError,
} from "../lib/payment-config.ts";

import {
  MercadoPagoProviderError,
  parsePaymentPreferenceResponse,
} from "../lib/mercadopago.ts";


function readCheckoutRuntimeSource() {
  const routeSource =
    readFileSync(
      join(
        process.cwd(),
        "app/api/checkout/create/route.ts"
      ),
      "utf8"
    );


  const handlerSource =
    readFileSync(
      join(
        process.cwd(),
        "lib/checkout-route-handler.ts"
      ),
      "utf8"
    );


  return `${routeSource}\n${handlerSource}`;
}


describe(
  "P0 - Mercado Pago fail-closed",
  () => {
    test(
      "token ausente deve falhar fechado",
      () => {
        assert.throws(
          () => {
            getMercadoPagoAccessToken(
              {}
            );
          },
          PaymentConfigurationError
        );


        assert.throws(
          () => {
            getMercadoPagoAccessToken(
              {
                MERCADO_PAGO_ACCESS_TOKEN:
                  "   ",
              }
            );
          },
          PaymentConfigurationError
        );
      }
    );


    test(
      "placeholder conhecido nao pode funcionar como credencial",
      () => {
        for (
          const token
          of [
            "TEST-ACCESS-TOKEN-FAKE",
            "CHANGE_ME",
            "YOUR_ACCESS_TOKEN",
            "SEU_TOKEN",
            "TOKEN_AQUI",
            "<access-token>",
          ]
        ) {
          assert.throws(
            () => {
              getMercadoPagoAccessToken(
                {
                  MERCADO_PAGO_ACCESS_TOKEN:
                    token,
                }
              );
            },
            PaymentConfigurationError,
            `Placeholder deve ser rejeitado: ${token}`
          );
        }
      }
    );


    test(
      "credencial de teste real nao deve ser rejeitada apenas pelo prefixo TEST",
      () => {
        const token =
          getMercadoPagoAccessToken(
            {
              MERCADO_PAGO_ACCESS_TOKEN:
                "TEST-123456789-valid-format-for-test",
            }
          );


        assert.equal(
          token,
          "TEST-123456789-valid-format-for-test"
        );
      }
    );


    test(
      "APP_BASE_URL de producao deve exigir HTTPS publico",
      () => {
        assert.throws(
          () => {
            getAppBaseUrl(
              {
                NODE_ENV:
                  "production",

                APP_BASE_URL:
                  "http://facildigitalmais.com",
              }
            );
          },
          PaymentConfigurationError
        );


        assert.throws(
          () => {
            getAppBaseUrl(
              {
                NODE_ENV:
                  "production",

                APP_BASE_URL:
                  "https://localhost:3000",
              }
            );
          },
          PaymentConfigurationError
        );


        assert.throws(
          () => {
            getAppBaseUrl(
              {
                NODE_ENV:
                  "production",

                APP_BASE_URL:
                  "https://127.0.0.1:3000",
              }
            );
          },
          PaymentConfigurationError
        );
      }
    );


    test(
      "APP_BASE_URL HTTPS publica deve ser normalizada para origin",
      () => {
        const result =
          getAppBaseUrl(
            {
              NODE_ENV:
                "production",

              APP_BASE_URL:
                "https://facildigitalmais.com/",
            }
          );


        assert.equal(
          result,
          "https://facildigitalmais.com"
        );
      }
    );


    test(
      "localhost HTTP deve ser permitido somente fora de producao",
      () => {
        const development =
          getAppBaseUrl(
            {
              NODE_ENV:
                "development",

              APP_BASE_URL:
                "http://localhost:5173/",
            }
          );


        assert.equal(
          development,
          "http://localhost:5173"
        );


        assert.throws(
          () => {
            getAppBaseUrl(
              {
                NODE_ENV:
                  "development",

                APP_BASE_URL:
                  "http://example.com",
              }
            );
          },
          PaymentConfigurationError
        );
      }
    );


    test(
      "APP_BASE_URL deve rejeitar credenciais query fragmento e caminho",
      () => {
        for (
          const value
          of [
            "https://user:password@example.com",
            "https://example.com?source=test",
            "https://example.com#fragment",
            "https://example.com/aplicacao",
          ]
        ) {
          assert.throws(
            () => {
              getAppBaseUrl(
                {
                  NODE_ENV:
                    "production",

                  APP_BASE_URL:
                    value,
                }
              );
            },
            PaymentConfigurationError,
            `APP_BASE_URL deve ser rejeitada: ${value}`
          );
        }
      }
    );


    test(
      "resposta valida da preferencia deve ser aceita",
      () => {
        const result =
          parsePaymentPreferenceResponse(
            {
              id:
                "123456789",

              init_point:
                "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=123456789",
            }
          );


        assert.equal(
          result.preference_id,
          "123456789"
        );


        assert.equal(
          result.init_point,
          "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=123456789"
        );
      }
    );


    test(
      "preferencia sem id deve falhar fechado",
      () => {
        assert.throws(
          () => {
            parsePaymentPreferenceResponse(
              {
                init_point:
                  "https://www.mercadopago.com.br/checkout",
              }
            );
          },
          MercadoPagoProviderError
        );


        assert.throws(
          () => {
            parsePaymentPreferenceResponse(
              {
                id:
                  "   ",

                init_point:
                  "https://www.mercadopago.com.br/checkout",
              }
            );
          },
          MercadoPagoProviderError
        );
      }
    );


    test(
      "preferencia sem init_point deve falhar fechado",
      () => {
        assert.throws(
          () => {
            parsePaymentPreferenceResponse(
              {
                id:
                  "123456789",
              }
            );
          },
          MercadoPagoProviderError
        );


        assert.throws(
          () => {
            parsePaymentPreferenceResponse(
              {
                id:
                  "123456789",

                init_point:
                  "",
              }
            );
          },
          MercadoPagoProviderError
        );
      }
    );


    test(
      "checkout URL do provedor deve obrigatoriamente usar HTTPS",
      () => {
        assert.throws(
          () => {
            parsePaymentPreferenceResponse(
              {
                id:
                  "123456789",

                init_point:
                  "http://www.mercadopago.com.br/checkout",
              }
            );
          },
          MercadoPagoProviderError
        );


        assert.throws(
          () => {
            parsePaymentPreferenceResponse(
              {
                id:
                  "123456789",

                init_point:
                  "/checkout/123456789",
              }
            );
          },
          MercadoPagoProviderError
        );
      }
    );


    test(
      "SDK deve ser inicializado de forma lazy e sem token fake",
      () => {
        const source =
          readFileSync(
            join(
              process.cwd(),
              "lib/mercadopago.ts"
            ),
            "utf8"
          );


        assert.doesNotMatch(
          source,
          /TEST-ACCESS-TOKEN-FAKE/
        );


        assert.match(
          source,
          /getMercadoPagoAccessToken/
        );


        assert.match(
          source,
          /createMercadoPagoClient/
        );


        assert.doesNotMatch(
          source,
          /const\s+client\s*=\s*new\s+MercadoPagoConfig/
        );


        assert.doesNotMatch(
          source,
          /const\s+preference\s*=\s*new\s+Preference/
        );


        assert.doesNotMatch(
          source,
          /const\s+payment\s*=\s*new\s+Payment/
        );
      }
    );


    test(
      "importar modulo Mercado Pago nao deve exigir credencial",
      async () => {
        const previousToken =
          process.env
            .MERCADO_PAGO_ACCESS_TOKEN;


        try {
          delete process.env
            .MERCADO_PAGO_ACCESS_TOKEN;


          const module =
            await import(
              `../lib/mercadopago.ts?lazy-test=${Date.now()}`
            );


          assert.equal(
            typeof module
              .createPaymentPreference,
            "function"
          );


          assert.equal(
            typeof module
              .getPaymentStatus,
            "function"
          );
        } finally {
          if (
            previousToken ===
            undefined
          ) {
            delete process.env
              .MERCADO_PAGO_ACCESS_TOKEN;
          } else {
            process.env
              .MERCADO_PAGO_ACCESS_TOKEN =
              previousToken;
          }
        }
      }
    );


    test(
      "rota de checkout nao pode possuir fallback demo",
      () => {
        const source =
          readCheckoutRuntimeSource();


        assert.doesNotMatch(
          source,
          /demo=true/i
        );


        assert.doesNotMatch(
          source,
          /DEMO-/
        );


        assert.doesNotMatch(
          source,
          /modo demo/i
        );


        assert.doesNotMatch(
          source,
          /usando modo demo/i
        );


        assert.doesNotMatch(
          source,
          /request\.nextUrl\.origin/
        );
      }
    );


    test(
      "rota deve usar configuracao canonica e respostas fail-closed",
      () => {
        const source =
          readCheckoutRuntimeSource();


        assert.match(
          source,
          /getAppBaseUrl/
        );


        assert.match(
          source,
          /getMercadoPagoAccessToken/
        );


        assert.match(
          source,
          /PaymentConfigurationError/
        );


        assert.match(
          source,
          /MercadoPagoProviderError/
        );


        assert.match(
          source,
          /status:\s*503/
        );


        assert.match(
          source,
          /status:\s*502/
        );
      }
    );


    test(
      "success do checkout so pode ocorrer depois da persistencia da preference",
      () => {
        const source =
          readCheckoutRuntimeSource();


        const attachIndex =
          source.indexOf(
            "attachPaymentPreference"
          );


        const successIndex =
          source.lastIndexOf(
            "success:"
          );


        assert.ok(
          attachIndex >= 0,
          "Rota deve persistir preference_id"
        );


        assert.ok(
          successIndex >
            attachIndex,
          "success deve ocorrer somente depois de persistir preference_id"
        );
      }
    );


    test(
      "frontend deve aceitar somente checkout URL HTTPS absoluta",
      () => {
        const source =
          readFileSync(
            join(
              process.cwd(),
              "components/checkout-real.tsx"
            ),
            "utf8"
          );


        assert.match(
          source,
          /new URL/
        );


        assert.match(
          source,
          /protocol\s*!==\s*["']https:["']/
        );


        assert.match(
          source,
          /window\.location\.assign/
        );


        assert.doesNotMatch(
          source,
          /startsWith\(["']http["']\)/
        );


        assert.doesNotMatch(
          source,
          /Modo demo/i
        );


        assert.doesNotMatch(
          source,
          /router\.push\(data\.checkoutUrl\)/
        );
      }
    );


    test(
      "consulta de pagamento não pode possuir fallbacks financeiros permissivos",
      () => {
        const source =
          readFileSync(
            join(
              process.cwd(),
              "lib/mercadopago.ts"
            ),
            "utf8"
          );


        assert.match(
          source,
          /parseMercadoPagoPaymentResponse/
        );


        assert.match(
          source,
          /currency_id/
        );


        assert.doesNotMatch(
          source,
          /response\.status\s*\|\|\s*["']unknown["']/
        );


        assert.doesNotMatch(
          source,
          /response\.external_reference\s*\|\|\s*["']["']/
        );


        assert.doesNotMatch(
          source,
          /response\.transaction_amount\s*\|\|\s*0/
        );
      }
    );
  }
);