import {
  eq,
} from "drizzle-orm";

import {
  getDb,
} from "../db/index";

import {
  orders,
} from "../db/schema";


type AppDatabase =
  ReturnType<
    typeof getDb
  >;


export class MercadoPagoWebhookCorrelationError
  extends Error {
  readonly code =
    "MERCADO_PAGO_WEBHOOK_CORRELATION_ERROR";

  readonly status =
    409;

  constructor(
    message: string
  ) {
    super(
      message
    );

    this.name =
      "MercadoPagoWebhookCorrelationError";
  }
}


export interface MercadoPagoOrderLookupResult {
  orderId:
    number;

  status:
    string;

  externalReference:
    string;

  mpPaymentId:
    string | null;

  total:
    number;
}


function normalizeExternalReference(
  value:
    string
): string {
  const normalized =
    value.trim();


  if (!normalized) {
    throw new MercadoPagoWebhookCorrelationError(
      "external_reference ausente."
    );
  }


  return normalized;
}


export function locateMercadoPagoOrder(
  db:
    AppDatabase,
  externalReference:
    string
): MercadoPagoOrderLookupResult {
  const normalizedExternalReference =
    normalizeExternalReference(
      externalReference
    );


  /**
   * Esta função é deliberadamente somente leitura.
   *
   * Uma notificação do Mercado Pago ainda não
   * representa autorização para modificar o pedido.
   *
   * Em especial, payment_id NÃO é persistido aqui.
   */
  const matchingOrders =
    db
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
          normalizedExternalReference
        )
      )
      .all();


  if (
    matchingOrders.length !==
    1
  ) {
    throw new MercadoPagoWebhookCorrelationError(
      "Pedido não encontrado para external_reference."
    );
  }


  const order =
    matchingOrders[0];


  if (
    !order.externalReference ||
    order.externalReference !==
      normalizedExternalReference
  ) {
    throw new MercadoPagoWebhookCorrelationError(
      "external_reference do pedido é inconsistente."
    );
  }


  return {
    orderId:
      order.id,

    status:
      order.status,

    externalReference:
      order.externalReference,

    mpPaymentId:
      order.mpPaymentId,

    total:
      order.total,
  };
}