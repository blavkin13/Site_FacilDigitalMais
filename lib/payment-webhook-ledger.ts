import {
  createHash,
} from "node:crypto";

import {
  eq,
  sql,
} from "drizzle-orm";

import {
  getDb,
} from "../db/index";

import {
  paymentWebhookEvents,
} from "../db/schema";

import type {
  MercadoPagoPaymentStatusValue,
} from "./mercadopago";

import {
  financialValueToCents,
} from "./payment-financial-validation";


type AppDatabase =
  ReturnType<
    typeof getDb
  >;


export const PAYMENT_WEBHOOK_OUTCOMES =
  [
    "processed",
    "ignored",
    "quarantined",
  ] as const;


export type PaymentWebhookOutcome =
  (
    typeof PAYMENT_WEBHOOK_OUTCOMES
  )[number];


export class PaymentWebhookLedgerError
  extends Error {
  readonly code =
    "PAYMENT_WEBHOOK_LEDGER_ERROR";

  constructor(
    message:
      string
  ) {
    super(
      message
    );

    this.name =
      "PaymentWebhookLedgerError";
  }
}


export interface PaymentWebhookFingerprintInput {
  paymentId:
    string;

  externalReference:
    string | null;

  mpStatus:
    MercadoPagoPaymentStatusValue;

  mpStatusDetail:
    string;

  transactionAmount:
    number;

  transactionAmountRefunded?:
    number;

  currencyId:
    string;
}


export interface RecordPaymentWebhookEventInput
  extends PaymentWebhookFingerprintInput {
  outcome:
    PaymentWebhookOutcome;

  errorCode?:
    string | null;

  requestId:
    string;
}


export interface PaymentWebhookLedgerResult {
  eventId:
    number;

  eventFingerprint:
    string;

  occurrenceCount:
    number;

  outcome:
    PaymentWebhookOutcome;

  duplicate:
    boolean;
}


function normalizeRequiredText(
  value:
    string,
  label:
    string
): string {
  const normalized =
    value.trim();


  if (!normalized) {
    throw new PaymentWebhookLedgerError(
      `${label} ausente.`
    );
  }


  return normalized;
}


function normalizeOptionalText(
  value:
    string | null | undefined
): string | null {
  if (
    typeof value !==
    "string"
  ) {
    return null;
  }


  const normalized =
    value.trim();


  return normalized
    ? normalized
    : null;
}


function normalizeRefundedAmountToCents(
  value:
    number | undefined
): number {
  if (
    value ===
      undefined ||
    value ===
      0
  ) {
    return 0;
  }


  if (
    !Number.isFinite(
      value
    ) ||
    value <
      0
  ) {
    throw new PaymentWebhookLedgerError(
      "transaction_amount_refunded inválido."
    );
  }


  return financialValueToCents(
    value,
    "Valor reembolsado"
  );
}


function normalizeOutcome(
  value:
    PaymentWebhookOutcome
): PaymentWebhookOutcome {
  if (
    !(
      PAYMENT_WEBHOOK_OUTCOMES as
        readonly string[]
    ).includes(
      value
    )
  ) {
    throw new PaymentWebhookLedgerError(
      "Outcome do webhook é inválido."
    );
  }


  return value;
}


export function buildPaymentWebhookEventFingerprint(
  input:
    PaymentWebhookFingerprintInput
): string {
  const paymentId =
    normalizeRequiredText(
      input.paymentId,
      "payment_id"
    );


  const externalReference =
    normalizeOptionalText(
      input.externalReference
    ) ??
    "";


  const mpStatus =
    normalizeRequiredText(
      input.mpStatus,
      "status Mercado Pago"
    )
      .toLowerCase();


  const mpStatusDetail =
    input.mpStatusDetail
      .trim()
      .toLowerCase();


  const transactionAmountCents =
    financialValueToCents(
      input.transactionAmount,
      "Valor do pagamento"
    );


  const transactionAmountRefundedCents =
    normalizeRefundedAmountToCents(
      input.transactionAmountRefunded
    );


  const currencyId =
    normalizeRequiredText(
      input.currencyId,
      "Moeda"
    )
      .toUpperCase();


  /**
   * Versão explícita do formato.
   *
   * Caso a composição do fingerprint precise mudar
   * no futuro, usamos outra versão em vez de
   * reinterpretar registros históricos.
   */
  const fingerprintPayload =
    JSON.stringify(
      [
        "payment-webhook-v1",
        paymentId,
        externalReference,
        mpStatus,
        mpStatusDetail,
        transactionAmountCents,
        transactionAmountRefundedCents,
        currencyId,
      ]
    );


  return createHash(
    "sha256"
  )
    .update(
      fingerprintPayload
    )
    .digest(
      "hex"
    );
}


export function recordPaymentWebhookEvent(
  db:
    AppDatabase,
  input:
    RecordPaymentWebhookEventInput
): PaymentWebhookLedgerResult {
  const paymentId =
    normalizeRequiredText(
      input.paymentId,
      "payment_id"
    );


  const externalReference =
    normalizeOptionalText(
      input.externalReference
    );


  const mpStatus =
    normalizeRequiredText(
      input.mpStatus,
      "status Mercado Pago"
    )
      .toLowerCase() as
      MercadoPagoPaymentStatusValue;


  const mpStatusDetail =
    input.mpStatusDetail
      .trim()
      .toLowerCase();


  const currencyId =
    normalizeRequiredText(
      input.currencyId,
      "Moeda"
    )
      .toUpperCase();


  const requestId =
    normalizeRequiredText(
      input.requestId,
      "x-request-id"
    );


  const outcome =
    normalizeOutcome(
      input.outcome
    );


  const errorCode =
    normalizeOptionalText(
      input.errorCode
    );


  if (
    outcome ===
      "quarantined" &&
    !errorCode
  ) {
    throw new PaymentWebhookLedgerError(
      "Evento quarantined exige error_code."
    );
  }


  if (
    outcome !==
      "quarantined" &&
    errorCode
  ) {
    throw new PaymentWebhookLedgerError(
      "Somente evento quarantined pode possuir error_code."
    );
  }


  const transactionAmountCents =
    financialValueToCents(
      input.transactionAmount,
      "Valor do pagamento"
    );


  const transactionAmountRefundedCents =
    normalizeRefundedAmountToCents(
      input.transactionAmountRefunded
    );


  if (
    transactionAmountRefundedCents >
    transactionAmountCents
  ) {
    throw new PaymentWebhookLedgerError(
      "Valor reembolsado excede o pagamento."
    );
  }


  const transactionAmountRefunded =
    transactionAmountRefundedCents /
    100;


  const transactionAmount =
    transactionAmountCents /
    100;


  const eventFingerprint =
    buildPaymentWebhookEventFingerprint(
      {
        paymentId,

        externalReference,

        mpStatus,

        mpStatusDetail,

        transactionAmount,

        transactionAmountRefunded,

        currencyId,
      }
    );


  const now =
    new Date()
      .toISOString();


  try {
    /**
     * UPSERT atômico:
     *
     * duas entregas concorrentes da mesma fotografia
     * financeira convergem para uma única linha.
     *
     * first_received_at nunca é sobrescrito.
     */
    db
      .insert(
        paymentWebhookEvents
      )
      .values(
        {
          eventFingerprint,

          paymentId,

          externalReference,

          mpStatus,

          mpStatusDetail,

          transactionAmount,

          transactionAmountRefunded,

          currencyId,

          outcome,

          errorCode,

          requestId,

          occurrenceCount:
            1,

          firstReceivedAt:
            now,

          lastReceivedAt:
            now,

          processedAt:
            now,
        }
      )
      .onConflictDoUpdate(
        {
          target:
            paymentWebhookEvents
              .eventFingerprint,

          set: {
            occurrenceCount:
              sql`
                ${paymentWebhookEvents.occurrenceCount}
                + 1
              `,

            lastReceivedAt:
              now,

            processedAt:
              now,

            requestId,

            outcome,

            errorCode,
          },
        }
      )
      .run();


    const persisted =
      db
        .select(
          {
            id:
              paymentWebhookEvents.id,

            eventFingerprint:
              paymentWebhookEvents
                .eventFingerprint,

            occurrenceCount:
              paymentWebhookEvents
                .occurrenceCount,

            outcome:
              paymentWebhookEvents.outcome,
          }
        )
        .from(
          paymentWebhookEvents
        )
        .where(
          eq(
            paymentWebhookEvents
              .eventFingerprint,
            eventFingerprint
          )
        )
        .get();


    if (!persisted) {
      throw new Error(
        "Evento não encontrado após persistência."
      );
    }


    return {
      eventId:
        persisted.id,

      eventFingerprint:
        persisted.eventFingerprint,

      occurrenceCount:
        persisted.occurrenceCount,

      outcome:
        persisted.outcome as
          PaymentWebhookOutcome,

      duplicate:
        persisted.occurrenceCount >
        1,
    };
  } catch (error) {
    if (
      error instanceof
      PaymentWebhookLedgerError
    ) {
      throw error;
    }


    console.error(
      "Falha ao persistir ledger do webhook Mercado Pago:",
      error
    );


    throw new PaymentWebhookLedgerError(
      "Falha ao persistir auditoria financeira do webhook."
    );
  }
}