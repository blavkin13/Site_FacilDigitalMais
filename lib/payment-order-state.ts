import {
  and,
  eq,
} from "drizzle-orm";

import {
  getDb,
} from "../db/index";

import {
  orders,
} from "../db/schema";

import type {
  MercadoPagoPaymentStatusValue,
} from "./mercadopago";

import {
  validatePaymentFinancials,
} from "./payment-financial-validation";


type AppDatabase =
  ReturnType<
    typeof getDb
  >;


export class PaymentOrderStateError
  extends Error {
  readonly code =
    "PAYMENT_ORDER_STATE_ERROR";

  readonly status =
    409;

  constructor(
    message:
      string
  ) {
    super(
      message
    );

    this.name =
      "PaymentOrderStateError";
  }
}


export interface ApplyMercadoPagoPaymentStateInput {
  paymentId:
    string;

  externalReference:
    string;

  paymentStatus:
    MercadoPagoPaymentStatusValue;

  statusDetail:
    string;

  transactionAmount:
    number;

  transactionAmountRefunded:
    number;

  currencyId:
    string;
}


export type PaymentOrderStateOutcome =
  | "approved"
  | "already_approved"
  | "refunded"
  | "already_refunded"
  | "charged_back"
  | "already_charged_back"
  | "restored"
  | "ignored";


export interface PaymentOrderStateResult {
  orderId:
    number;

  orderStatus:
    string;

  paymentStatus:
    MercadoPagoPaymentStatusValue;

  outcome:
    PaymentOrderStateOutcome;
}


function normalizeIdentifier(
  value:
    string,
  label:
    string
): string {
  const normalized =
    value.trim();


  if (!normalized) {
    throw new PaymentOrderStateError(
      `${label} ausente.`
    );
  }


  return normalized;
}


export function applyMercadoPagoPaymentState(
  db:
    AppDatabase,
  input:
    ApplyMercadoPagoPaymentStateInput
): PaymentOrderStateResult {
  const paymentId =
    normalizeIdentifier(
      input.paymentId,
      "payment_id"
    );


  const externalReference =
    normalizeIdentifier(
      input.externalReference,
      "external_reference"
    );


  return db.transaction(
    (
      tx
    ) => {
      /**
       * O pedido é relido dentro da mesma transação
       * que poderá aprová-lo.
       *
       * Não confiamos no snapshot obtido antes pelo
       * lookup do webhook.
       */
      const matchingOrders =
        tx
          .select(
            {
              id:
                orders.id,

              status:
                orders.status,

              externalReference:
                orders.externalReference,

              mpPaymentId:
                orders.mpPaymentId,

              total:
                orders.total,
            }
          )
          .from(
            orders
          )
          .where(
            eq(
              orders.externalReference,
              externalReference
            )
          )
          .all();


      if (
        matchingOrders.length !==
        1
      ) {
        throw new PaymentOrderStateError(
          "Pedido não encontrado para external_reference."
        );
      }


      const order =
        matchingOrders[0];


      if (
        !order.externalReference ||
        order.externalReference !==
          externalReference
      ) {
        throw new PaymentOrderStateError(
          "external_reference do pedido é inconsistente."
        );
      }


      const paymentStatus =
        input.paymentStatus;


      const statusDetail =
        input.statusDetail
          .trim()
          .toLowerCase();


      /**
       * Proteção adicional porque a máquina também
       * é invocável isoladamente em testes e não
       * deve depender apenas do parser HTTP.
       */
      if (
        !Number.isFinite(
          input.transactionAmountRefunded
        ) ||
        input.transactionAmountRefunded <
          0
      ) {
        throw new PaymentOrderStateError(
          "transaction_amount_refunded inválido."
        );
      }


      let refundedAmountCents =
        0;


      if (
        input.transactionAmountRefunded >
        0
      ) {
        refundedAmountCents =
          Math.round(
            input.transactionAmountRefunded *
              100
          );


        if (
          Math.abs(
            input.transactionAmountRefunded *
              100 -
              refundedAmountCents
          ) >
          1e-9
        ) {
          throw new PaymentOrderStateError(
            "transaction_amount_refunded possui precisão inválida."
          );
        }
      }


      const hasRefund =
        paymentStatus ===
          "refunded" ||
        refundedAmountCents >
          0;


      const isChargeback =
        paymentStatus ===
        "charged_back";


      const mayChangeFinancialState =
        paymentStatus ===
          "approved" ||
        hasRefund ||
        isChargeback;


      /**
       * Estados sem autoridade financeira continuam
       * sem alterar entitlement.
       */
      if (
        !mayChangeFinancialState
      ) {
        return {
          orderId:
            order.id,

          orderStatus:
            order.status,

          paymentStatus,

          outcome:
            "ignored",
        };
      }


      /**
       * Qualquer evento que possa aprovar, revogar
       * ou restaurar precisa continuar comprovando
       * que se refere à mesma transação financeira:
       *
       * - BRL;
       * - transaction_amount exato;
       * - total do pedido exato em centavos.
       */
      validatePaymentFinancials(
        {
          transactionAmount:
            input.transactionAmount,

          currencyId:
            input.currencyId,

          expectedTotal:
            order.total,

          expectedCurrency:
            "BRL",
        }
      );


      const orderTotalCents =
        Math.round(
          order.total *
            100
        );


      if (
        refundedAmountCents >
        orderTotalCents
      ) {
        throw new PaymentOrderStateError(
          "Valor reembolsado excede o total do pedido."
        );
      }


      /**
       * Refund e chargeback possuem poder de
       * REVOGAR entitlement.
       *
       * Por isso external_reference nunca basta.
       * O payment_id precisa ser exatamente o
       * payment_id canônico gravado na aprovação.
       */
      if (
        hasRefund ||
        isChargeback
      ) {
        if (
          !order.mpPaymentId
        ) {
          throw new PaymentOrderStateError(
            "Evento de revogação sem payment_id canônico."
          );
        }


        if (
          order.mpPaymentId !==
          paymentId
        ) {
          throw new PaymentOrderStateError(
            "Evento de revogação pertence a outro payment_id."
          );
        }
      }


      /**
       * REFUND
       *
       * Nesta fase qualquer refund parcial também
       * revoga o pedido inteiro.
       *
       * refunded é terminal:
       * nenhum approved ou chargeback posterior
       * restaurará automaticamente a compra.
       */
      if (
        hasRefund
      ) {
        if (
          order.status ===
          "refunded"
        ) {
          return {
            orderId:
              order.id,

            orderStatus:
              "refunded",

            paymentStatus,

            outcome:
              "already_refunded",
          };
        }


        if (
          order.status !==
            "approved" &&
          order.status !==
            "charged_back"
        ) {
          throw new PaymentOrderStateError(
            "Refund recebido para pedido sem compra canônica revogável."
          );
        }


        const refundResult =
          tx
            .update(
              orders
            )
            .set(
              {
                status:
                  "refunded",

                updatedAt:
                  new Date()
                    .toISOString(),
              }
            )
            .where(
              and(
                eq(
                  orders.id,
                  order.id
                ),

                eq(
                  orders.status,
                  order.status
                ),

                eq(
                  orders.mpPaymentId,
                  paymentId
                )
              )
            )
            .run();


        if (
          refundResult.changes !==
          1
        ) {
          throw new PaymentOrderStateError(
            "Pedido mudou durante a revogação por refund."
          );
        }


        return {
          orderId:
            order.id,

          orderStatus:
            "refunded",

          paymentStatus,

          outcome:
            "refunded",
        };
      }


      /**
       * CHARGEBACK
       *
       * reimbursed:
       * decisão favorável ao vendedor.
       *
       * É o ÚNICO status_detail de chargeback que
       * pode restaurar um pedido suspenso.
       *
       * Qualquer outro detalhe — inclusive valores
       * ainda desconhecidos — mantém o comportamento
       * fail-closed e suspende o entitlement.
       */
      if (
        isChargeback
      ) {
        /**
         * Refund é terminal nesta fase.
         */
        if (
          order.status ===
          "refunded"
        ) {
          return {
            orderId:
              order.id,

            orderStatus:
              "refunded",

            paymentStatus,

            outcome:
              "ignored",
          };
        }


        if (
          statusDetail ===
          "reimbursed"
        ) {
          /**
           * Se o evento intermediário de chargeback
           * nunca chegou, um reimbursed recebido
           * enquanto ainda estamos approved apenas
           * confirma que o acesso deve permanecer.
           */
          if (
            order.status ===
            "approved"
          ) {
            return {
              orderId:
                order.id,

              orderStatus:
                "approved",

              paymentStatus,

              outcome:
                "already_approved",
            };
          }


          if (
            order.status !==
            "charged_back"
          ) {
            throw new PaymentOrderStateError(
              "Resolução favorável recebida para pedido sem chargeback canônico."
            );
          }


          const restoreResult =
            tx
              .update(
                orders
              )
              .set(
                {
                  status:
                    "approved",

                  updatedAt:
                    new Date()
                      .toISOString(),
                }
              )
              .where(
                and(
                  eq(
                    orders.id,
                    order.id
                  ),

                  eq(
                    orders.status,
                    "charged_back"
                  ),

                  eq(
                    orders.mpPaymentId,
                    paymentId
                  )
                )
              )
              .run();


          if (
            restoreResult.changes !==
            1
          ) {
            throw new PaymentOrderStateError(
              "Pedido mudou durante restauração de chargeback."
            );
          }


          return {
            orderId:
              order.id,

            orderStatus:
              "approved",

            paymentStatus,

            outcome:
              "restored",
          };
        }


        if (
          order.status ===
          "charged_back"
        ) {
          return {
            orderId:
              order.id,

            orderStatus:
              "charged_back",

            paymentStatus,

            outcome:
              "already_charged_back",
          };
        }


        if (
          order.status !==
          "approved"
        ) {
          throw new PaymentOrderStateError(
            "Chargeback recebido para pedido sem compra aprovada canônica."
          );
        }


        const chargebackResult =
          tx
            .update(
              orders
            )
            .set(
              {
                status:
                  "charged_back",

                updatedAt:
                  new Date()
                    .toISOString(),
              }
            )
            .where(
              and(
                eq(
                  orders.id,
                  order.id
                ),

                eq(
                  orders.status,
                  "approved"
                ),

                eq(
                  orders.mpPaymentId,
                  paymentId
                )
              )
            )
            .run();


        if (
          chargebackResult.changes !==
          1
        ) {
          throw new PaymentOrderStateError(
            "Pedido mudou durante suspensão por chargeback."
          );
        }


        return {
          orderId:
            order.id,

          orderStatus:
            "charged_back",

          paymentStatus,

          outcome:
            "charged_back",
        };
      }


      /**
       * A partir daqui só resta paymentStatus
       * "approved" sem qualquer refund.
       *
       * Um approved antigo jamais restaura compra
       * refunded ou charged_back.
       */
      if (
        order.status ===
          "refunded" ||
        order.status ===
          "charged_back"
      ) {
        return {
          orderId:
            order.id,

          orderStatus:
            order.status,

          paymentStatus,

          outcome:
            "ignored",
        };
      }


      /**
       * Pedido já aprovado:
       *
       * somente o MESMO payment_id é considerado
       * repetição idempotente.
       */
      if (
        order.status ===
        "approved"
      ) {
        if (
          !order.mpPaymentId
        ) {
          throw new PaymentOrderStateError(
            "Pedido aprovado sem payment_id canônico."
          );
        }


        if (
          order.mpPaymentId !==
          paymentId
        ) {
          throw new PaymentOrderStateError(
            "Pedido aprovado pertence a outro payment_id."
          );
        }


        return {
          orderId:
            order.id,

          orderStatus:
            "approved",

          paymentStatus,

          outcome:
            "already_approved",
        };
      }


      /**
       * A única promoção inicial aceita continua:
       *
       * pending -> approved
       */
      if (
        order.status !==
        "pending"
      ) {
        return {
          orderId:
            order.id,

          orderStatus:
            order.status,

          paymentStatus,

          outcome:
            "ignored",
        };
      }


      /**
       * Um pedido pending não pode trocar
       * silenciosamente um payment_id já persistido.
       *
       * Em operação normal ele estará NULL até
       * este exato momento.
       */
      if (
        order.mpPaymentId &&
        order.mpPaymentId !==
          paymentId
      ) {
        throw new PaymentOrderStateError(
          "Pedido pending já possui outro payment_id."
        );
      }


      /**
       * Segunda defesa:
       *
       * o payment_id aprovado não pode pertencer a
       * qualquer outro pedido.
       *
       * O índice UNIQUE criado na migration 0006
       * continua sendo a proteção final no banco.
       */
      const paymentOwners =
        tx
          .select(
            {
              id:
                orders.id,
            }
          )
          .from(
            orders
          )
          .where(
            eq(
              orders.mpPaymentId,
              paymentId
            )
          )
          .all();


      const conflictingOwner =
        paymentOwners.find(
          (
            owner
          ) =>
            owner.id !==
            order.id
        );


      if (
        conflictingOwner
      ) {
        throw new PaymentOrderStateError(
          "payment_id já pertence a outro pedido."
        );
      }


      /**
       * payment_id + approved são persistidos
       * atomicamente.
       *
       * Nunca existe uma janela em que o pedido
       * esteja approved sem a identidade financeira
       * correspondente.
       */
      const updateResult =
        tx
          .update(
            orders
          )
          .set(
            {
              status:
                "approved",

              mpPaymentId:
                paymentId,

              updatedAt:
                new Date()
                  .toISOString(),
            }
          )
          .where(
            and(
              eq(
                orders.id,
                order.id
              ),

              eq(
                orders.status,
                "pending"
              )
            )
          )
          .run();


      if (
        updateResult.changes !==
        1
      ) {
        throw new PaymentOrderStateError(
          "Pedido mudou durante a aprovação financeira."
        );
      }


      return {
        orderId:
          order.id,

        orderStatus:
          "approved",

        paymentStatus:
          input.paymentStatus,

        outcome:
          "approved",
      };
    }
  );
}