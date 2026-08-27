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

import {
  PaymentWebhookLedgerError,
  recordPaymentWebhookEvent,
  type RecordPaymentWebhookEventInput,
} from "./payment-webhook-ledger";


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

  recordLedger:
    typeof recordPaymentWebhookEvent;
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

    recordLedger:
      recordPaymentWebhookEvent,
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


  /**
   * O webhook só pode reconhecer definitivamente
   * um resultado financeiro depois que a auditoria
   * durável foi persistida.
   *
   * Qualquer falha do ledger é transformada em
   * PaymentWebhookLedgerError para que o handler
   * devolva 500 e o Mercado Pago possa reenviar.
   */
  const persistLedger = (
    db:
      ReturnType<
        typeof getDb
      >,
    input:
      RecordPaymentWebhookEventInput
  ) => {
    try {
      return dependencies
        .recordLedger(
          db,
          input
        );
    } catch (error) {
      if (
        error instanceof
        PaymentWebhookLedgerError
      ) {
        throw error;
      }


      console.error(
        "Falha inesperada ao registrar ledger do webhook:",
        error
      );


      throw new PaymentWebhookLedgerError(
        "Falha ao persistir auditoria financeira do webhook."
      );
    }
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


      /**
       * O validador oficial já exige x-request-id.
       *
       * Repetimos a garantia aqui porque o handler
       * aceita dependências injetadas em testes e
       * não pode depender implicitamente do
       * comportamento de outra função.
       */
      const requestId =
        xRequestId
          ?.trim();


      if (!requestId) {
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


      try {
        /**
         * Primeiro verificamos que a referência
         * aponta para exatamente um pedido.
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

                statusDetail:
                  paymentStatus
                    .status_detail,

                transactionAmount:
                  paymentStatus
                    .transaction_amount,

                transactionAmountRefunded:
                  paymentStatus
                    .transaction_amount_refunded,

                currencyId:
                  paymentStatus
                    .currency_id,
              }
            );


        /**
         * approved e already_approved representam
         * processamento financeiro concluído.
         *
         * Status que deliberadamente não modificam
         * entitlement são registrados como ignored.
         */
        const ledgerOutcome =
          stateResult.outcome ===
          "ignored"
            ? "ignored"
            : "processed";


        const ledgerResult =
          persistLedger(
            db,
            {
              paymentId:
                paymentStatus.id,

              externalReference:
                paymentStatus
                  .external_reference,

              mpStatus:
                paymentStatus.status,

              mpStatusDetail:
                paymentStatus
                  .status_detail,

              transactionAmount:
                paymentStatus
                  .transaction_amount,

              transactionAmountRefunded:
                paymentStatus
                  .transaction_amount_refunded,

              currencyId:
                paymentStatus
                  .currency_id,

              outcome:
                ledgerOutcome,

              errorCode:
                null,

              requestId,
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
        } else if (
          stateResult.outcome ===
            "refunded" ||
          stateResult.outcome ===
            "already_refunded"
        ) {
          console.log(
            `Pedido #${stateResult.orderId} está reembolsado; entitlement revogado.`
          );
        } else if (
          stateResult.outcome ===
            "charged_back" ||
          stateResult.outcome ===
            "already_charged_back"
        ) {
          console.log(
            `Pedido #${stateResult.orderId} está em chargeback; entitlement suspenso.`
          );
        } else if (
          stateResult.outcome ===
          "restored"
        ) {
          console.log(
            `Pedido #${stateResult.orderId} restaurado após resolução favorável de chargeback.`
          );
        } else {
          console.log(
            `Pagamento ${paymentStatus.id} com status ${paymentStatus.status} reconhecido para pedido #${locatedOrder.orderId}; nenhuma transição financeira aplicada.`
          );
        }


        if (
          ledgerResult.duplicate
        ) {
          console.log(
            `Webhook financeiro repetido: fingerprint ${ledgerResult.eventFingerprint}, ocorrência ${ledgerResult.occurrenceCount}.`
          );
        }


        return NextResponse.json(
          {
            received:
              true,
          }
        );
      } catch (error) {
        /**
         * Estes erros representam conflitos
         * determinísticos depois que conseguimos
         * consultar o pagamento real no MP.
         *
         * Repetir indefinidamente o mesmo webhook
         * não corrigirá:
         *
         * - referência inexistente;
         * - valor/moeda divergente;
         * - conflito de identidade/estado.
         *
         * Portanto:
         *
         * 1. persistimos o incidente;
         * 2. somente então respondemos 200.
         */
        let quarantineCode:
          string | null =
            null;


        if (
          error instanceof
          MercadoPagoWebhookCorrelationError
        ) {
          quarantineCode =
            error.code;
        } else if (
          error instanceof
          PaymentFinancialValidationError
        ) {
          quarantineCode =
            error.code;
        } else if (
          error instanceof
          PaymentOrderStateError
        ) {
          quarantineCode =
            error.code;
        }


        if (
          !quarantineCode
        ) {
          throw error;
        }


        persistLedger(
          db,
          {
            paymentId:
              paymentStatus.id,

            externalReference:
              paymentStatus
                .external_reference,

            mpStatus:
              paymentStatus.status,

            mpStatusDetail:
              paymentStatus
                .status_detail,

            transactionAmount:
              paymentStatus
                .transaction_amount,

            transactionAmountRefunded:
              paymentStatus
                .transaction_amount_refunded,

            currencyId:
              paymentStatus
                .currency_id,

            outcome:
              "quarantined",

            errorCode:
              quarantineCode,

            requestId,
          }
        );


        console.warn(
          `Webhook Mercado Pago colocado em quarentena: ${quarantineCode}; payment_id=${paymentStatus.id}; external_reference=${paymentStatus.external_reference}.`
        );


        return NextResponse.json(
          {
            received:
              true,

            quarantined:
              true,
          }
        );
      }
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
        PaymentWebhookLedgerError
      ) {
        console.error(
          "Falha no ledger financeiro do webhook Mercado Pago:",
          error.message
        );


        /**
         * Nunca reconhecemos um evento permanente
         * como concluído se sua auditoria durável
         * não pôde ser salva.
         *
         * HTTP 500 permite retry do provedor.
         */
        return NextResponse.json(
          {
            error:
              "Webhook audit persistence failed",
          },
          {
            status:
              500,
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