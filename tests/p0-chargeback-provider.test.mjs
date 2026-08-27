import assert
  from "node:assert/strict";

import {
  describe,
  test,
} from "node:test";

import {
  MercadoPagoProviderError,
  parseMercadoPagoChargebackResponse,
} from "../lib/mercadopago.ts";


function expectProviderError(
  callback,
  messagePattern
) {
  assert.throws(
    callback,
    (
      error
    ) => {
      assert.ok(
        error instanceof
          MercadoPagoProviderError
      );

      assert.match(
        error.message,
        messagePattern
      );

      return true;
    }
  );
}


describe(
  "P0.14 - Mercado Pago chargeback provider",
  () => {
    test(
      "aceita payment_id retornado pelo SDK 3.4.0",
      () => {
        const parsed =
          parseMercadoPagoChargebackResponse(
            {
              id:
                "CB-123",

              payment_id:
                987654321,

              status:
                "in_review",
            },
            "CB-123"
          );


        assert.deepEqual(
          parsed,
          {
            chargebackId:
              "CB-123",

            paymentId:
              "987654321",
          }
        );
      }
    );


    test(
      "aceita payments documentado pela API",
      () => {
        const parsed =
          parseMercadoPagoChargebackResponse(
            {
              id:
                "CB-123",

              payments: [
                987654321,
              ],
            },
            "CB-123"
          );


        assert.deepEqual(
          parsed,
          {
            chargebackId:
              "CB-123",

            paymentId:
              "987654321",
          }
        );
      }
    );


    test(
      "aceita representação escalar compatível de payments",
      () => {
        const parsed =
          parseMercadoPagoChargebackResponse(
            {
              id:
                "CB-123",

              payments:
                "987654321",
            },
            "CB-123"
          );


        assert.equal(
          parsed.paymentId,
          "987654321"
        );
      }
    );


    test(
      "payment_id e payments podem coexistir quando convergem",
      () => {
        const parsed =
          parseMercadoPagoChargebackResponse(
            {
              id:
                "CB-123",

              payment_id:
                987654321,

              payments: [
                "987654321",
              ],
            },
            "CB-123"
          );


        assert.equal(
          parsed.paymentId,
          "987654321"
        );
      }
    );


    test(
      "rejeita contestação diferente da solicitada",
      () => {
        expectProviderError(
          () =>
            parseMercadoPagoChargebackResponse(
              {
                id:
                  "CB-OUTRO",

                payment_id:
                  987654321,
              },
              "CB-123"
            ),
          /chargeback_id retornado diverge/
        );
      }
    );


    test(
      "rejeita resposta sem id da contestação",
      () => {
        expectProviderError(
          () =>
            parseMercadoPagoChargebackResponse(
              {
                payment_id:
                  987654321,
              },
              "CB-123"
            ),
          /sem id/
        );
      }
    );


    test(
      "rejeita contestação sem pagamento associado",
      () => {
        expectProviderError(
          () =>
            parseMercadoPagoChargebackResponse(
              {
                id:
                  "CB-123",
              },
              "CB-123"
            ),
          /sem payment_id canônico/
        );
      }
    );


    test(
      "rejeita payments vazio",
      () => {
        expectProviderError(
          () =>
            parseMercadoPagoChargebackResponse(
              {
                id:
                  "CB-123",

                payments:
                  [],
              },
              "CB-123"
            ),
          /sem pagamentos associados/
        );
      }
    );


    test(
      "rejeita identificador de pagamento inválido",
      () => {
        expectProviderError(
          () =>
            parseMercadoPagoChargebackResponse(
              {
                id:
                  "CB-123",

                payment_id:
                  {},
              },
              "CB-123"
            ),
          /payment_id inválido/
        );
      }
    );


    test(
      "rejeita múltiplos pagamentos distintos",
      () => {
        expectProviderError(
          () =>
            parseMercadoPagoChargebackResponse(
              {
                id:
                  "CB-123",

                payments: [
                  111,
                  222,
                ],
              },
              "CB-123"
            ),
          /múltiplos pagamentos/
        );
      }
    );


    test(
      "rejeita conflito entre payment_id e payments",
      () => {
        expectProviderError(
          () =>
            parseMercadoPagoChargebackResponse(
              {
                id:
                  "CB-123",

                payment_id:
                  111,

                payments: [
                  222,
                ],
              },
              "CB-123"
            ),
          /múltiplos pagamentos/
        );
      }
    );


    test(
      "rejeita chargeback_id solicitado vazio",
      () => {
        expectProviderError(
          () =>
            parseMercadoPagoChargebackResponse(
              {
                id:
                  "CB-123",

                payment_id:
                  987654321,
              },
              "   "
            ),
          /chargeback_id solicitado é inválido/
        );
      }
    );
  }
);