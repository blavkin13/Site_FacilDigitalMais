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

  transactionAmount:
    number;

  currencyId:
    string;
}


export type PaymentOrderStateOutcome =
  | "approved"
  | "already_approved"
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


      /**
       * Nesta fase somente "approved" possui
       * autoridade para promover o pedido.
       *
       * authorized não equivale a approved.
       *
       * pending, in_process, in_mediation,
       * rejected e cancelled também não modificam
       * o estado do pedido.
       *
       * refunded e charged_back serão tratados na
       * fase específica de revogação.
       */
      if (
        input.paymentStatus !==
        "approved"
      ) {
        return {
          orderId:
            order.id,

          orderStatus:
            order.status,

          paymentStatus:
            input.paymentStatus,

          outcome:
            "ignored",
        };
      }


      /**
       * Antes de qualquer aprovação validamos
       * moeda e valor exato em centavos.
       *
       * PaymentFinancialValidationError sobe para
       * o handler HTTP sem qualquer escrita.
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


      /**
       * Pedido já aprovado:
       *
       * somente o MESMO payment_id é considerado
       * repetição idempotente.
       *
       * Outro pagamento tentando assumir um pedido
       * já aprovado é conflito financeiro.
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

          paymentStatus:
            input.paymentStatus,

          outcome:
            "already_approved",
        };
      }


      /**
       * A máquina atual permite exclusivamente:
       *
       * pending -> approved
       *
       * Estados históricos como rejected, refunded
       * ou qualquer outro não são reabertos
       * automaticamente.
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

          paymentStatus:
            input.paymentStatus,

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