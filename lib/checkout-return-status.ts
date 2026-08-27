import {
  and,
  eq,
} from "drizzle-orm";

import type {
  getDb,
} from "../db/index";

import {
  orders,
} from "../db/schema";


type AppDatabase =
  ReturnType<
    typeof getDb
  >;


export const CHECKOUT_RETURN_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "refunded",
  "charged_back",
] as const;


export type CheckoutReturnStatus =
  | (
      typeof CHECKOUT_RETURN_STATUSES
    )[number]
  | "unknown";


export interface CheckoutReturnOrderStatus {
  orderId:
    number;

  status:
    CheckoutReturnStatus;

  entitlementActive:
    boolean;

  updatedAt:
    string;
}


export class CheckoutReturnReferenceError
  extends Error {
  constructor(
    message:
      string
  ) {
    super(
      message
    );

    this.name =
      "CheckoutReturnReferenceError";
  }
}


export function normalizeCheckoutReturnReference(
  value:
    string | null | undefined
): string {
  const normalized =
    (
      value ??
      ""
    ).trim();


  /**
   * A referência é apenas um localizador.
   *
   * Ela nunca representa autoridade sobre:
   *
   * - status financeiro;
   * - payment_id;
   * - entitlement;
   * - propriedade do pedido.
   *
   * Ainda assim limitamos tamanho para evitar
   * entradas arbitrariamente grandes.
   */
  if (
    !normalized ||
    normalized.length >
      200
  ) {
    throw new CheckoutReturnReferenceError(
      "Referência do pedido inválida."
    );
  }


  return normalized;
}


export function normalizeCheckoutReturnStatus(
  value:
    unknown
): CheckoutReturnStatus {
  if (
    typeof value !==
    "string"
  ) {
    return "unknown";
  }


  const normalized =
    value
      .trim()
      .toLowerCase();


  if (
    (
      CHECKOUT_RETURN_STATUSES as
        readonly string[]
    ).includes(
      normalized
    )
  ) {
    return (
      normalized as
        (
          typeof CHECKOUT_RETURN_STATUSES
        )[number]
    );
  }


  /**
   * Fail closed.
   *
   * Um estado inesperado nunca é tratado
   * implicitamente como approved.
   */
  return "unknown";
}


export function findCheckoutReturnOrderStatus(
  db:
    AppDatabase,

  userId:
    number,

  externalReference:
    string
): CheckoutReturnOrderStatus | null {
  if (
    !Number.isInteger(
      userId
    ) ||
    userId <=
      0
  ) {
    throw new CheckoutReturnReferenceError(
      "Usuário inválido."
    );
  }


  const normalizedReference =
    normalizeCheckoutReturnReference(
      externalReference
    );


  /**
   * SEGURANÇA
   *
   * Não basta conhecer external_reference.
   *
   * O pedido precisa simultaneamente:
   *
   * 1. pertencer ao usuário autenticado;
   * 2. possuir exatamente a referência recebida.
   *
   * Assim uma referência copiada, descoberta ou
   * manipulada não permite consultar pedido de
   * outro usuário.
   */
  const row =
    db
      .select({
        orderId:
          orders.id,

        status:
          orders.status,

        updatedAt:
          orders.updatedAt,
      })
      .from(
        orders
      )
      .where(
        and(
          eq(
            orders.userId,
            userId
          ),

          eq(
            orders.externalReference,
            normalizedReference
          )
        )
      )
      .limit(
        1
      )
      .get();


  if (!row) {
    return null;
  }


  const status =
    normalizeCheckoutReturnStatus(
      row.status
    );


  return {
    orderId:
      row.orderId,

    status,

    /**
     * ÚNICA regra de entitlement.
     *
     * Nenhum outro estado financeiro libera
     * materiais ou simulados.
     */
    entitlementActive:
      status ===
      "approved",

    updatedAt:
      row.updatedAt,
  };
}