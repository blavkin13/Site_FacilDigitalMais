import assert from "node:assert/strict";

import {
  createHmac,
} from "node:crypto";

import {
  describe,
  test,
} from "node:test";

import {
  PaymentConfigurationError,
} from "../lib/payment-config.ts";

import {
  MercadoPagoWebhookRequestError,
  parseMercadoPagoWebhookNotification,
  validateMercadoPagoWebhookSignature,
} from "../lib/mercadopago-webhook.ts";


function createSignature(
  {
    dataId,
    requestId,
    secret,
    timestamp =
      "1742505638683",
  }
) {
  /**
   * Manifesto documentado pelo Mercado Pago:
   *
   * id:<data.id>;
   * request-id:<x-request-id>;
   * ts:<ts>;
   */
  const manifest =
    `id:${dataId};` +
    `request-id:${requestId};` +
    `ts:${timestamp};`;


  const hash =
    createHmac(
      "sha256",
      secret
    )
      .update(
        manifest
      )
      .digest(
        "hex"
      );


  return (
    `ts=${timestamp},` +
    `v1=${hash}`
  );
}


describe(
  "P0 - autenticacao do webhook Mercado Pago",
  () => {
    test(
      "assinatura oficial valida deve ser aceita",
      () => {
        const secret =
          "webhook-secret-for-test";

        const dataId =
          "123456789";

        const requestId =
          "request-id-123";


        const xSignature =
          createSignature(
            {
              dataId,
              requestId,
              secret,
            }
          );


        const valid =
          validateMercadoPagoWebhookSignature(
            {
              xSignature,

              xRequestId:
                requestId,

              dataId,

              environment: {
                MERCADO_PAGO_WEBHOOK_SECRET:
                  secret,
              },
            }
          );


        assert.equal(
          valid,
          true
        );
      }
    );


    test(
      "alterar data.id deve invalidar a assinatura",
      () => {
        const secret =
          "webhook-secret-for-test";

        const requestId =
          "request-id-123";


        const xSignature =
          createSignature(
            {
              dataId:
                "123456789",

              requestId,

              secret,
            }
          );


        const valid =
          validateMercadoPagoWebhookSignature(
            {
              xSignature,

              xRequestId:
                requestId,

              dataId:
                "999999999",

              environment: {
                MERCADO_PAGO_WEBHOOK_SECRET:
                  secret,
              },
            }
          );


        assert.equal(
          valid,
          false
        );
      }
    );


    test(
      "alterar x-request-id deve invalidar a assinatura",
      () => {
        const secret =
          "webhook-secret-for-test";

        const dataId =
          "123456789";


        const xSignature =
          createSignature(
            {
              dataId,

              requestId:
                "request-original",

              secret,
            }
          );


        const valid =
          validateMercadoPagoWebhookSignature(
            {
              xSignature,

              xRequestId:
                "request-adulterado",

              dataId,

              environment: {
                MERCADO_PAGO_WEBHOOK_SECRET:
                  secret,
              },
            }
          );


        assert.equal(
          valid,
          false
        );
      }
    );


    test(
      "headers ou data.id ausentes devem falhar fechado",
      () => {
        const environment = {
          MERCADO_PAGO_WEBHOOK_SECRET:
            "webhook-secret-for-test",
        };


        assert.equal(
          validateMercadoPagoWebhookSignature(
            {
              xSignature:
                null,

              xRequestId:
                "request-1",

              dataId:
                "123",

              environment,
            }
          ),
          false
        );


        assert.equal(
          validateMercadoPagoWebhookSignature(
            {
              xSignature:
                "ts=1,v1=abc",

              xRequestId:
                null,

              dataId:
                "123",

              environment,
            }
          ),
          false
        );


        assert.equal(
          validateMercadoPagoWebhookSignature(
            {
              xSignature:
                "ts=1,v1=abc",

              xRequestId:
                "request-1",

              dataId:
                null,

              environment,
            }
          ),
          false
        );
      }
    );


    test(
      "secret ausente deve ser erro de configuracao",
      () => {
        assert.throws(
          () => {
            validateMercadoPagoWebhookSignature(
              {
                xSignature:
                  "ts=1,v1=abc",

                xRequestId:
                  "request-1",

                dataId:
                  "123",

                environment: {},
              }
            );
          },
          PaymentConfigurationError
        );
      }
    );


    test(
      "secret placeholder deve ser rejeitado",
      () => {
        for (
          const secret
          of [
            "YOUR_WEBHOOK_SECRET",
            "SEU_WEBHOOK_SECRET",
            "<webhook-secret>",
          ]
        ) {
          assert.throws(
            () => {
              validateMercadoPagoWebhookSignature(
                {
                  xSignature:
                    "ts=1,v1=abc",

                  xRequestId:
                    "request-1",

                  dataId:
                    "123",

                  environment: {
                    MERCADO_PAGO_WEBHOOK_SECRET:
                      secret,
                  },
                }
              );
            },
            PaymentConfigurationError
          );
        }
      }
    );


    test(
      "payload payment consistente deve ser aceito",
      () => {
        const result =
          parseMercadoPagoWebhookNotification(
            {
              signedDataId:
                "999999999",

              queryType:
                "payment",

              rawBody:
                JSON.stringify(
                  {
                    id:
                      12345,

                    type:
                      "payment",

                    action:
                      "payment.updated",

                    data: {
                      id:
                        "999999999",
                    },
                  }
                ),
            }
          );


        assert.deepEqual(
          result,
          {
            type:
              "payment",

            dataId:
              "999999999",

            action:
              "payment.updated",
          }
        );
      }
    );


    test(
      "payload oficial topic_chargebacks_wh com actions deve ser aceito sem confiar em data.payment_id",
      () => {
        const result =
          parseMercadoPagoWebhookNotification(
            {
              /**
               * Este é o identificador autenticado
               * utilizado na assinatura do webhook.
               *
               * Para topic_chargebacks_wh ele
               * representa a CONTESTAÇÃO.
               */
              signedDataId:
                "CHARGEBACK-123",

              queryType:
                "topic_chargebacks_wh",

              rawBody:
                JSON.stringify(
                  {
                    type:
                      "topic_chargebacks_wh",

                    /**
                     * Chargebacks podem utilizar
                     * actions em vez do campo
                     * singular action.
                     *
                     * O parser não precisa interpretar
                     * essas ações para determinar
                     * autoridade financeira.
                     */
                    actions: [
                      "changed_case_status",
                    ],

                    data: {
                      id:
                        "CHARGEBACK-123",

                      /**
                       * Valor propositalmente falso.
                       *
                       * O parser de notificação não
                       * promove este campo a dataId
                       * nem o utiliza como identidade
                       * financeira.
                       *
                       * O payment_id canônico será
                       * obtido posteriormente por
                       * GET /v1/chargebacks/{id}.
                       */
                      payment_id:
                        "PAYMENT-FORGED",
                    },
                  }
                ),
            }
          );


        assert.deepEqual(
          result,
          {
            type:
              "topic_chargebacks_wh",

            /**
             * Deve continuar sendo o ID da
             * contestação autenticada.
             */
            dataId:
              "CHARGEBACK-123",

            /**
             * actions[] não deve ser convertido
             * artificialmente para action.
             */
            action:
              null,
          }
        );


        /**
         * Defesa estrutural adicional:
         * o payment_id não faz parte da estrutura
         * devolvida pelo parser de notificação.
         */
        assert.equal(
          Object.hasOwn(
            result,
            "paymentId"
          ),
          false
        );
      }
    );


    test(
      "data.id do body deve coincidir com data.id autenticado",
      () => {
        assert.throws(
          () => {
            parseMercadoPagoWebhookNotification(
              {
                signedDataId:
                  "111",

                queryType:
                  "payment",

                rawBody:
                  JSON.stringify(
                    {
                      type:
                        "payment",

                      data: {
                        id:
                          "222",
                      },
                    }
                  ),
              }
            );
          },
          MercadoPagoWebhookRequestError
        );
      }
    );


    test(
      "type da query e payload devem coincidir",
      () => {
        assert.throws(
          () => {
            parseMercadoPagoWebhookNotification(
              {
                signedDataId:
                  "123",

                queryType:
                  "payment",

                rawBody:
                  JSON.stringify(
                    {
                      type:
                        "merchant_order",

                      data: {
                        id:
                          "123",
                      },
                    }
                  ),
              }
            );
          },
          MercadoPagoWebhookRequestError
        );
      }
    );


    test(
      "JSON malformado deve ser rejeitado",
      () => {
        assert.throws(
          () => {
            parseMercadoPagoWebhookNotification(
              {
                signedDataId:
                  "123",

                queryType:
                  "payment",

                rawBody:
                  "{invalid-json",
              }
            );
          },
          MercadoPagoWebhookRequestError
        );
      }
    );


    test(
      "payload sem data deve ser rejeitado",
      () => {
        assert.throws(
          () => {
            parseMercadoPagoWebhookNotification(
              {
                signedDataId:
                  "123",

                queryType:
                  "payment",

                rawBody:
                  JSON.stringify(
                    {
                      type:
                        "payment",
                    }
                  ),
              }
            );
          },
          MercadoPagoWebhookRequestError
        );
      }
    );


    test(
      "endpoint real deve usar autenticacao oficial e correlacao exata",
      async () => {
        const {
          readFileSync,
        } =
          await import(
            "node:fs"
          );


        const {
          join,
        } =
          await import(
            "node:path"
          );


        const source =
          readFileSync(
            join(
              process.cwd(),
              "lib",
              "mercadopago-webhook-handler.ts"
            ),
            "utf8"
          );


        assert.match(
          source,
          /validateMercadoPagoWebhookSignature/
        );


        assert.match(
          source,
          /parseMercadoPagoWebhookNotification/
        );


        assert.match(
          source,
          /locateMercadoPagoOrder/
        );


        assert.doesNotMatch(
          source,
          /correlateMercadoPagoPayment/
        );


        assert.match(
          source,
          /getPaymentStatus/
        );


        assert.match(
          source,
          /getMercadoPagoChargebackPaymentId/,
          "Webhook deve resolver contestação pelo recurso canônico do Mercado Pago"
        );


        assert.match(
          source,
          /topic_chargebacks_wh/,
          "Webhook deve reconhecer notificações oficiais de chargeback"
        );


        assert.doesNotMatch(
          source,
          /simula aprova/i
        );


        assert.doesNotMatch(
          source,
          /modo demo/i
        );


        assert.doesNotMatch(
          source,
          /pendingOrders/
        );


        assert.doesNotMatch(
          source,
          /latestOrder/
        );


        assert.doesNotMatch(
          source,
          /statusMap/
        );


        assert.doesNotMatch(
          source,
          /authorized:\s*["']approved["']/
        );


        assert.doesNotMatch(
          source,
          /return NextResponse\.json\(\{\s*received:\s*true\s*\}\);\s*\/\/ Sempre 200/
        );
      }
    );


    test(
      "endpoint deve delegar aprovacao somente para a maquina financeira",
      async () => {
        const {
          readFileSync,
        } =
          await import(
            "node:fs"
          );


        const {
          join,
        } =
          await import(
            "node:path"
          );


        const source =
          readFileSync(
            join(
              process.cwd(),
              "lib",
              "mercadopago-webhook-handler.ts"
            ),
            "utf8"
          );


        assert.match(
          source,
          /locateMercadoPagoOrder/
        );


        assert.match(
          source,
          /applyMercadoPagoPaymentState/
        );


        const lookupIndex =
          source.indexOf(
            ".locateOrder("
          );


        const stateIndex =
          source.indexOf(
            ".applyPaymentState("
          );


        assert.ok(
          lookupIndex >=
            0
        );


        assert.ok(
          stateIndex >
            lookupIndex,
          "Máquina de estados deve executar somente após correlação do pedido"
        );


        /**
         * A rota HTTP não pode implementar
         * atualização financeira diretamente.
         */
        assert.doesNotMatch(
          source,
          /\.update\s*\(\s*orders\s*\)/
        );


        assert.doesNotMatch(
          source,
          /mpPaymentId\s*:/
        );
      }
    );


    test(
      "camada de localizacao do webhook deve ser somente leitura",
      async () => {
        const {
          readFileSync,
        } =
          await import(
            "node:fs"
          );


        const {
          join,
        } =
          await import(
            "node:path"
          );


        const source =
          readFileSync(
            join(
              process.cwd(),
              "lib/mercadopago-webhook-order.ts"
            ),
            "utf8"
          );


        assert.match(
          source,
          /locateMercadoPagoOrder/
        );


        assert.doesNotMatch(
          source,
          /\.update\s*\(/
        );


        assert.doesNotMatch(
          source,
          /\.insert\s*\(/
        );


        assert.doesNotMatch(
          source,
          /\.delete\s*\(/
        );


        assert.doesNotMatch(
          source,
          /\.set\s*\(/
        );
      }
    );


    test(
      "maquina financeira deve validar valor antes de persistir approved",
      async () => {
        const {
          readFileSync,
        } =
          await import(
            "node:fs"
          );


        const {
          join,
        } =
          await import(
            "node:path"
          );


        const source =
          readFileSync(
            join(
              process.cwd(),
              "lib/payment-order-state.ts"
            ),
            "utf8"
          );


        assert.match(
          source,
          /validatePaymentFinancials/
        );


        assert.match(
          source,
          /const\s+mayChangeFinancialState\s*=/
        );


        assert.match(
          source,
          /paymentStatus\s*===\s*["']approved["']/
        );


        assert.match(
          source,
          /\bhasRefund\b/
        );


        assert.match(
          source,
          /\bisChargeback\b/
        );


        assert.match(
          source,
          /status:\s*["']approved["']/
        );


        assert.match(
          source,
          /mpPaymentId\s*:/
        );


        const validationIndex =
          source.indexOf(
            "validatePaymentFinancials("
          );


        const updateIndex =
          source.indexOf(
            ".update("
          );


        assert.ok(
          validationIndex >=
            0
        );


        assert.ok(
          updateIndex >
            validationIndex,
          "Valor e moeda precisam ser validados antes da escrita"
        );
      }
    );


    test(
      "rota real do webhook deve ser apenas adaptador para o handler testado",
      async () => {
        const {
          readFileSync,
        } =
          await import(
            "node:fs"
          );


        const {
          join,
        } =
          await import(
            "node:path"
          );


        const source =
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
          source,
          /createMercadoPagoWebhookPostHandler/
        );


        assert.doesNotMatch(
          source,
          /getPaymentStatus/
        );


        assert.doesNotMatch(
          source,
          /locateMercadoPagoOrder/
        );


        assert.doesNotMatch(
          source,
          /applyMercadoPagoPaymentState/
        );


        assert.doesNotMatch(
          source,
          /\.update\s*\(/
        );
      }
    );
  }
);