import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getDb,
} from "../db/index";

import {
  initDatabase,
} from "../db/init";

import {
  getPaymentStatus,
  MercadoPagoProviderError,
} from "./mercadopago";

import {
  MercadoPagoWebhookRequestError,
  parseMercadoPagoWebhookNotification,
  validateMercadoPagoWebhookSignature,
} from "./mercadopago-webhook";

import {
  locateMercadoPagoOrder,
  MercadoPagoWebhookCorrelationError,
} from "./mercadopago-webhook-order";

import {
  applyMercadoPagoPaymentState,
  PaymentOrderStateError,
} from "./payment-order-state";

import {
  PaymentFinancialValidationError,
} from "./payment-financial-validation";

import {
  PaymentConfigurationError,
} from "./payment-config";


interface MercadoPagoWebhookDependencies {
  initializeDatabase:
    typeof initDatabase;

  getDatabase:
    typeof getDb;

  validateSignature:
    typeof validateMercadoPagoWebhookSignature;

  parseNotification:
    typeof parseMercadoPagoWebhookNotification;

  getPayment:
    typeof getPaymentStatus;

  locateOrder:
    typeof locateMercadoPagoOrder;

  applyPaymentState:
    typeof applyMercadoPagoPaymentState;
}


const defaultDependencies:
  MercadoPagoWebhookDependencies = {
    initializeDatabase:
      initDatabase,

    getDatabase:
      getDb,

    validateSignature:
      validateMercadoPagoWebhookSignature,

    parseNotification:
      parseMercadoPagoWebhookNotification,

    getPayment:
      getPaymentStatus,

    locateOrder:
      locateMercadoPagoOrder,

    applyPaymentState:
      applyMercadoPagoPaymentState,
  };


export function createMercadoPagoWebhookPostHandler(
  overrides:
    Partial<
      MercadoPagoWebhookDependencies
    > = {}
) {
  const dependencies:
    MercadoPagoWebhookDependencies = {
      ...defaultDependencies,
      ...overrides,
    };


  return async function mercadoPagoWebhookPost(
    request:
      NextRequest
  ) {
    try {
      /**
       * data.id autenticado pelo Mercado Pago vem
       * da query string.
       */
      const signedDataId =
        request.nextUrl
          .searchParams
          .get(
            "data.id"
          );


      const queryType =
        request.nextUrl
          .searchParams
          .get(
            "type"
          );


      const xSignature =
        request.headers
          .get(
            "x-signature"
          );


      const xRequestId =
        request.headers
          .get(
            "x-request-id"
          );


      /**
       * Nenhum acesso ao banco ou ao provedor
       * acontece antes da autenticação do webhook.
       */
      const isSignatureValid =
        dependencies
          .validateSignature(
            {
              xSignature,

              xRequestId,

              dataId:
                signedDataId,
            }
          );


      if (
        !isSignatureValid
      ) {
        console.warn(
          "Webhook Mercado Pago rejeitado: assinatura inválida."
        );


        return NextResponse.json(
          {
            error:
              "Invalid signature",
          },
          {
            status:
              401,
          }
        );
      }


      const rawBody =
        await request.text();


      let notification;


      try {
        notification =
          dependencies
            .parseNotification(
              {
                rawBody,

                signedDataId,

                queryType,
              }
            );
      } catch (error) {
        if (
          error instanceof
          MercadoPagoWebhookRequestError
        ) {
          return NextResponse.json(
            {
              error:
                "Invalid webhook payload",
            },
            {
              status:
                400,
            }
          );
        }


        throw error;
      }


      /**
       * Evento autenticado, mas fora do fluxo de
       * pagamentos.
       *
       * É reconhecido sem efeito financeiro.
       */
      if (
        notification.type !==
        "payment"
      ) {
        return NextResponse.json(
          {
            received:
              true,

            ignored:
              true,
          }
        );
      }


      await dependencies
        .initializeDatabase();


      const db =
        dependencies
          .getDatabase();


      /**
       * O body do webhook nunca é autoridade sobre
       * status, referência ou valor.
       *
       * Esses dados vêm da consulta autenticada à
       * API do Mercado Pago.
       */
      const paymentStatus =
        await dependencies
          .getPayment(
            notification.dataId
          );


      const externalReference =
        paymentStatus
          .external_reference
          .trim();


      if (
        !externalReference
      ) {
        throw new MercadoPagoProviderError(
          "Pagamento sem external_reference."
        );
      }


      /**
       * Primeiro verificamos que a referência aponta
       * para exatamente um pedido.
       *
       * Esta operação é somente leitura.
       */
      const locatedOrder =
        dependencies
          .locateOrder(
            db,
            externalReference
          );


      /**
       * A máquina financeira relê o pedido dentro
       * da própria transação antes de qualquer
       * possível escrita.
       *
       * Somente approved + BRL + valor exato pode
       * executar pending -> approved.
       */
      const stateResult =
        dependencies
          .applyPaymentState(
            db,
            {
              paymentId:
                paymentStatus.id,

              externalReference:
                paymentStatus
                  .external_reference,

              paymentStatus:
                paymentStatus.status,

              transactionAmount:
                paymentStatus
                  .transaction_amount,

              currencyId:
                paymentStatus
                  .currency_id,
            }
          );


      if (
        stateResult.outcome ===
        "approved"
      ) {
        console.log(
          `Pedido #${stateResult.orderId} aprovado pelo pagamento ${paymentStatus.id}.`
        );
      } else if (
        stateResult.outcome ===
        "already_approved"
      ) {
        console.log(
          `Webhook idempotente para pedido #${stateResult.orderId} e pagamento ${paymentStatus.id}.`
        );
      } else {
        console.log(
          `Pagamento ${paymentStatus.id} com status ${paymentStatus.status} reconhecido para pedido #${locatedOrder.orderId}; nenhuma transição financeira aplicada.`
        );
      }


      return NextResponse.json(
        {
          received:
            true,
        }
      );
    } catch (error) {
      if (
        error instanceof
        PaymentConfigurationError
      ) {
        console.error(
          "Configuração do webhook Mercado Pago indisponível:",
          error.message
        );


        return NextResponse.json(
          {
            error:
              "Webhook temporarily unavailable",
          },
          {
            status:
              503,
          }
        );
      }


      if (
        error instanceof
        MercadoPagoProviderError
      ) {
        console.error(
          "Falha ao consultar pagamento Mercado Pago:",
          error.message
        );


        return NextResponse.json(
          {
            error:
              "Payment provider unavailable",
          },
          {
            status:
              502,
          }
        );
      }


      if (
        error instanceof
        PaymentFinancialValidationError
      ) {
        console.warn(
          "Validação financeira do webhook Mercado Pago falhou:",
          error.message
        );


        return NextResponse.json(
          {
            error:
              "Payment financial mismatch",
          },
          {
            status:
              error.status,
          }
        );
      }


      if (
        error instanceof
        PaymentOrderStateError
      ) {
        console.warn(
          "Conflito de estado financeiro do pedido:",
          error.message
        );


        return NextResponse.json(
          {
            error:
              "Payment state conflict",
          },
          {
            status:
              error.status,
          }
        );
      }


      if (
        error instanceof
        MercadoPagoWebhookCorrelationError
      ) {
        console.warn(
          "Falha de correlação do webhook Mercado Pago:",
          error.message
        );


        return NextResponse.json(
          {
            error:
              "Payment correlation conflict",
          },
          {
            status:
              error.status,
          }
        );
      }


      console.error(
        "Erro no webhook Mercado Pago:",
        error
      );


      return NextResponse.json(
        {
          error:
            "Webhook processing failed",
        },
        {
          status:
            500,
        }
      );
    }
  };
}