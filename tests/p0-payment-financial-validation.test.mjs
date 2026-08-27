import assert from "node:assert/strict";

import {
  describe,
  test,
} from "node:test";

import {
  MercadoPagoProviderError,
  parseMercadoPagoPaymentResponse,
} from "../lib/mercadopago.ts";

import {
  financialValueToCents,
  PaymentFinancialValidationError,
  validatePaymentFinancials,
} from "../lib/payment-financial-validation.ts";


function validPayment(
  overrides =
    {}
) {
  return {
    id:
      123456789,

    status:
      "approved",

    status_detail:
      "accredited",

    external_reference:
      "FD-ORDER-123",

    transaction_amount:
      39.9,

    currency_id:
      "BRL",

    ...overrides,
  };
}


describe(
  "P0.8-B/C - validacao financeira Mercado Pago",
  () => {
    test(
      "resposta válida deve preservar identidade e dados financeiros",
      () => {
        const payment =
          parseMercadoPagoPaymentResponse(
            validPayment(),
            "123456789"
          );


        assert.deepEqual(
          payment,
          {
            id:
              "123456789",

            status:
              "approved",

            status_detail:
              "accredited",

            external_reference:
              "FD-ORDER-123",

            transaction_amount:
              39.9,

            transaction_amount_refunded:
              0,

            currency_id:
              "BRL",
          }
        );
      }
    );


    test(
      "payment_id retornado deve coincidir exatamente com o solicitado",
      () => {
        assert.throws(
          () => {
            parseMercadoPagoPaymentResponse(
              validPayment(
                {
                  id:
                    999999999,
                }
              ),
              "123456789"
            );
          },
          MercadoPagoProviderError
        );
      }
    );


    test(
      "resposta sem payment_id deve ser rejeitada",
      () => {
        assert.throws(
          () => {
            parseMercadoPagoPaymentResponse(
              validPayment(
                {
                  id:
                    null,
                }
              ),
              "123456789"
            );
          },
          MercadoPagoProviderError
        );
      }
    );


    test(
      "status ausente ou desconhecido deve ser rejeitado",
      () => {
        for (
          const status
          of [
            "",
            null,
            "unknown",
            "invented_status",
          ]
        ) {
          assert.throws(
            () => {
              parseMercadoPagoPaymentResponse(
                validPayment(
                  {
                    status,
                  }
                ),
                "123456789"
              );
            },
            MercadoPagoProviderError
          );
        }
      }
    );


    test(
      "authorized deve permanecer distinto de approved",
      () => {
        const payment =
          parseMercadoPagoPaymentResponse(
            validPayment(
              {
                status:
                  "authorized",
              }
            ),
            "123456789"
          );


        assert.equal(
          payment.status,
          "authorized"
        );


        assert.notEqual(
          payment.status,
          "approved"
        );
      }
    );


    test(
      "external_reference ausente deve ser rejeitada",
      () => {
        for (
          const externalReference
          of [
            "",
            "   ",
            null,
          ]
        ) {
          assert.throws(
            () => {
              parseMercadoPagoPaymentResponse(
                validPayment(
                  {
                    external_reference:
                      externalReference,
                  }
                ),
                "123456789"
              );
            },
            MercadoPagoProviderError
          );
        }
      }
    );


    test(
      "transaction_amount ausente zero negativo ou não finito deve ser rejeitado",
      () => {
        for (
          const transactionAmount
          of [
            null,
            0,
            -1,
            NaN,
            Infinity,
          ]
        ) {
          assert.throws(
            () => {
              parseMercadoPagoPaymentResponse(
                validPayment(
                  {
                    transaction_amount:
                      transactionAmount,
                  }
                ),
                "123456789"
              );
            },
            MercadoPagoProviderError
          );
        }
      }
    );


    test(
      "currency_id ausente deve ser rejeitada",
      () => {
        for (
          const currencyId
          of [
            "",
            "   ",
            null,
          ]
        ) {
          assert.throws(
            () => {
              parseMercadoPagoPaymentResponse(
                validPayment(
                  {
                    currency_id:
                      currencyId,
                  }
                ),
                "123456789"
              );
            },
            MercadoPagoProviderError
          );
        }
      }
    );


    test(
      "moeda deve ser normalizada para maiúsculas",
      () => {
        const payment =
          parseMercadoPagoPaymentResponse(
            validPayment(
              {
                currency_id:
                  "brl",
              }
            ),
            "123456789"
          );


        assert.equal(
          payment.currency_id,
          "BRL"
        );
      }
    );


    test(
      "valor financeiro deve ser comparado em centavos",
      () => {
        assert.equal(
          financialValueToCents(
            39.9,
            "Valor"
          ),
          3990
        );


        assert.equal(
          financialValueToCents(
            39.90,
            "Valor"
          ),
          3990
        );


        assert.equal(
          financialValueToCents(
            49.9,
            "Valor"
          ),
          4990
        );
      }
    );


    test(
      "valor exatamente igual em BRL deve ser aceito",
      () => {
        const result =
          validatePaymentFinancials(
            {
              transactionAmount:
                39.9,

              currencyId:
                "BRL",

              expectedTotal:
                39.90,
            }
          );


        assert.deepEqual(
          result,
          {
            transactionAmountCents:
              3990,

            expectedTotalCents:
              3990,

            currencyId:
              "BRL",
          }
        );
      }
    );


    test(
      "diferença positiva de um centavo deve ser rejeitada",
      () => {
        assert.throws(
          () => {
            validatePaymentFinancials(
              {
                transactionAmount:
                  39.91,

                currencyId:
                  "BRL",

                expectedTotal:
                  39.9,
              }
            );
          },
          PaymentFinancialValidationError
        );
      }
    );


    test(
      "diferença negativa de um centavo deve ser rejeitada",
      () => {
        assert.throws(
          () => {
            validatePaymentFinancials(
              {
                transactionAmount:
                  39.89,

                currencyId:
                  "BRL",

                expectedTotal:
                  39.9,
              }
            );
          },
          PaymentFinancialValidationError
        );
      }
    );


    test(
      "moeda diferente de BRL deve ser rejeitada",
      () => {
        assert.throws(
          () => {
            validatePaymentFinancials(
              {
                transactionAmount:
                  39.9,

                currencyId:
                  "USD",

                expectedTotal:
                  39.9,
              }
            );
          },
          PaymentFinancialValidationError
        );
      }
    );


    test(
      "precisão além de centavos deve ser rejeitada",
      () => {
        for (
          const value
          of [
            39.901,
            39.999,
            0.001,
          ]
        ) {
          assert.throws(
            () => {
              financialValueToCents(
                value,
                "Valor"
              );
            },
            PaymentFinancialValidationError
          );
        }
      }
    );


    test(
      "refund parcial válido deve ser normalizado e preservado",
      () => {
        const result =
          parseMercadoPagoPaymentResponse(
            {
              id:
                "123456789",

              status:
                "approved",

              status_detail:
                "accredited",

              external_reference:
                "FD-ORDER-123",

              transaction_amount:
                39.9,

              transaction_amount_refunded:
                10,

              currency_id:
                "BRL",
            },
            "123456789"
          );


        assert.equal(
          result
            .transaction_amount_refunded,
          10
        );
      }
    );


    test(
      "transaction_amount_refunded negativo deve ser rejeitado",
      () => {
        assert.throws(
          () => {
            parseMercadoPagoPaymentResponse(
              {
                id:
                  "123456789",

                status:
                  "refunded",

                status_detail:
                  "refunded",

                external_reference:
                  "FD-ORDER-123",

                transaction_amount:
                  39.9,

                transaction_amount_refunded:
                  -1,

                currency_id:
                  "BRL",
              },
              "123456789"
            );
          },
          /transaction_amount_refunded inválido/
        );
      }
    );


    test(
      "transaction_amount_refunded acima do pagamento deve ser rejeitado",
      () => {
        assert.throws(
          () => {
            parseMercadoPagoPaymentResponse(
              {
                id:
                  "123456789",

                status:
                  "refunded",

                status_detail:
                  "refunded",

                external_reference:
                  "FD-ORDER-123",

                transaction_amount:
                  39.9,

                transaction_amount_refunded:
                  39.91,

                currency_id:
                  "BRL",
              },
              "123456789"
            );
          },
          /transaction_amount_refunded excede transaction_amount/
        );
      }
    );


    test(
      "transaction_amount_refunded com precisão além de centavos deve ser rejeitado",
      () => {
        assert.throws(
          () => {
            parseMercadoPagoPaymentResponse(
              {
                id:
                  "123456789",

                status:
                  "approved",

                status_detail:
                  "accredited",

                external_reference:
                  "FD-ORDER-123",

                transaction_amount:
                  39.9,

                transaction_amount_refunded:
                  10.001,

                currency_id:
                  "BRL",
              },
              "123456789"
            );
          },
          /precisão monetária inválida/
        );
      }
    );
  }
);