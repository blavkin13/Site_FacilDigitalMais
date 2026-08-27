import type Database
  from "better-sqlite3";


export type PaymentDiagnosticOutcome =
  | "processed"
  | "ignored"
  | "quarantined";


export interface PaymentWebhookLedgerLogInput {
  requestId:
    string;

  paymentId:
    string;

  outcome:
    PaymentDiagnosticOutcome;

  errorCode?:
    string | null;

  duplicate:
    boolean;

  occurrenceCount:
    number;

  now?:
    Date;
}


export interface PaymentWebhookLogWriter {
  info(
    message:
      string
  ): void;

  warn(
    message:
      string
  ): void;
}


export interface PaymentWebhookLedgerLogRecord {
  timestamp:
    string;

  event:
    "mercadopago.webhook.ledger";

  topic:
    "financial";

  level:
    "info" | "warn";

  request_id:
    string;

  payment_id:
    string;

  outcome:
    PaymentDiagnosticOutcome;

  error_code:
    string | null;

  duplicate:
    boolean;

  occurrence_count:
    number;

  http_status:
    200;
}


export interface PaymentDiagnosticsOptions {
  pendingOlderThanHours?:
    number;

  recentLimit?:
    number;

  now?:
    Date;
}


export interface PaymentDiagnosticsReport {
  generatedAt:
    string;

  thresholds: {
    pendingOlderThanHours:
      number;

    recentLimit:
      number;
  };

  health: {
    status:
      "ok" | "attention";

    reasons:
      string[];
  };

  ledger: {
    totalEvents:
      number;

    totalDeliveries:
      number;

    outcomes:
      Array<{
        outcome:
          string;

        events:
          number;

        deliveries:
          number;
      }>;

    lastEvent:
      {
        id:
          number;

        paymentId:
          string;

        mpStatus:
          string;

        outcome:
          string;

        errorCode:
          string | null;

        requestId:
          string;

        occurrenceCount:
          number;

        lastReceivedAt:
          string;

        processedAt:
          string;
      } | null;

    quarantined:
      Array<{
        id:
          number;

        paymentId:
          string;

        errorCode:
          string | null;

        requestId:
          string;

        occurrenceCount:
          number;

        lastReceivedAt:
          string;
      }>;

    duplicates:
      Array<{
        id:
          number;

        paymentId:
          string;

        outcome:
          string;

        occurrenceCount:
          number;

        lastReceivedAt:
          string;
      }>;
  };

  orders: {
    statuses:
      Array<{
        status:
          string;

        count:
          number;
      }>;

    approvedWithoutPaymentId:
      Array<{
        orderId:
          number;

        externalReference:
          string | null;

        updatedAt:
          string;
      }>;

    stalePending:
      Array<{
        orderId:
          number;

        externalReference:
          string | null;

        createdAt:
          string;

        updatedAt:
          string;
      }>;

    revoked:
      Array<{
        orderId:
          number;

        status:
          string;

        paymentId:
          string | null;

        updatedAt:
          string;
      }>;
  };

  correlation: {
    unmatchedExternalReferences:
      Array<{
        externalReference:
          string;

        paymentId:
          string;

        lastReceivedAt:
          string;
      }>;

    paymentIdentityConflicts:
      Array<{
        orderId:
          number;

        externalReference:
          string;

        orderPaymentId:
          string;

        eventPaymentId:
          string;

        lastReceivedAt:
          string;
      }>;
  };
}


export class PaymentDiagnosticsError
  extends Error {
  constructor(
    message:
      string
  ) {
    super(
      message
    );

    this.name =
      "PaymentDiagnosticsError";
  }
}


type PaymentDiagnosticsDatabase =
  Database.Database;


const DEFAULT_PENDING_HOURS =
  24;


const DEFAULT_RECENT_LIMIT =
  25;


const MAX_RECENT_LIMIT =
  100;


const MAX_PENDING_HOURS =
  24 * 365;


function sanitizeIdentifier(
  value:
    string | null | undefined
): string {
  return (
    value ??
    ""
  )
    .trim()
    .replace(
      /[\u0000-\u001f\u007f]/g,
      "?"
    )
    .slice(
      0,
      200
    );
}


function validTimestamp(
  value:
    Date | undefined
): string {
  if (
    value &&
    Number.isFinite(
      value.getTime()
    )
  ) {
    return value
      .toISOString();
  }


  return new Date()
    .toISOString();
}


export function buildPaymentWebhookLedgerLogRecord(
  input:
    PaymentWebhookLedgerLogInput
): PaymentWebhookLedgerLogRecord {
  const occurrenceCount =
    Number.isInteger(
      input.occurrenceCount
    ) &&
    input.occurrenceCount >
      0
      ? input.occurrenceCount
      : 1;


  return {
    timestamp:
      validTimestamp(
        input.now
      ),

    event:
      "mercadopago.webhook.ledger",

    topic:
      "financial",

    level:
      input.outcome ===
      "quarantined"
        ? "warn"
        : "info",

    request_id:
      sanitizeIdentifier(
        input.requestId
      ),

    payment_id:
      sanitizeIdentifier(
        input.paymentId
      ),

    outcome:
      input.outcome,

    error_code:
      input.errorCode
        ? sanitizeIdentifier(
            input.errorCode
          )
        : null,

    duplicate:
      Boolean(
        input.duplicate
      ),

    occurrence_count:
      occurrenceCount,

    /**
     * Eventos que chegaram até persistência
     * durável no ledger são justamente os eventos
     * determinísticos reconhecidos pelo handler.
     *
     * processed / ignored / quarantined retornam 200.
     */
    http_status:
      200,
  };
}


/**
 * Logging é best-effort.
 *
 * Uma falha do console/logger nunca pode modificar
 * a decisão financeira ou transformar um webhook
 * válido em erro HTTP.
 *
 * O registro contém somente identificadores
 * operacionais mínimos.
 *
 * Deliberadamente NÃO contém:
 *
 * - access token;
 * - webhook secret;
 * - x-signature;
 * - body do webhook;
 * - external_reference;
 * - valores financeiros;
 * - CPF;
 * - e-mail;
 * - nome do comprador.
 */
export function logPaymentWebhookLedgerEvent(
  input:
    PaymentWebhookLedgerLogInput,

  writer:
    PaymentWebhookLogWriter =
      console
): void {
  try {
    const record =
      buildPaymentWebhookLedgerLogRecord(
        input
      );


    const serialized =
      JSON.stringify(
        record
      );


    if (
      record.level ===
      "warn"
    ) {
      writer.warn(
        serialized
      );

      return;
    }


    writer.info(
      serialized
    );
  } catch {
    /**
     * Observabilidade jamais pode interromper
     * processamento financeiro.
     */
  }
}


function assertPositiveInteger(
  value:
    number,

  name:
    string,

  maximum:
    number
): number {
  if (
    !Number.isInteger(
      value
    ) ||
    value <
      1 ||
    value >
      maximum
  ) {
    throw new PaymentDiagnosticsError(
      `${name} é inválido.`
    );
  }


  return value;
}


function assertDiagnosticsSchema(
  sqlite:
    PaymentDiagnosticsDatabase
): void {
  const rows =
    sqlite
      .prepare(`
        SELECT
          name
        FROM sqlite_master
        WHERE
          type = 'table'
          AND name IN (
            'orders',
            'payment_webhook_events'
          )
      `)
      .all() as
        Array<{
          name:
            string;
        }>;


  const names =
    new Set(
      rows.map(
        (
          row
        ) =>
          row.name
      )
    );


  for (
    const requiredTable
    of [
      "orders",
      "payment_webhook_events",
    ]
  ) {
    if (
      !names.has(
        requiredTable
      )
    ) {
      throw new PaymentDiagnosticsError(
        `Tabela obrigatória ausente: ${requiredTable}.`
      );
    }
  }
}


function countHealthReasons(
  report:
    Omit<
      PaymentDiagnosticsReport,
      "health"
    >
): string[] {
  const reasons:
    string[] =
      [];


  if (
    report.ledger
      .quarantined.length >
    0
  ) {
    reasons.push(
      "webhooks_quarantined"
    );
  }


  if (
    report.orders
      .approvedWithoutPaymentId
      .length >
    0
  ) {
    reasons.push(
      "approved_without_payment_id"
    );
  }


  if (
    report.orders
      .stalePending.length >
    0
  ) {
    reasons.push(
      "stale_pending_orders"
    );
  }


  if (
    report.correlation
      .unmatchedExternalReferences
      .length >
    0
  ) {
    reasons.push(
      "ledger_reference_without_order"
    );
  }


  if (
    report.correlation
      .paymentIdentityConflicts
      .length >
    0
  ) {
    reasons.push(
      "payment_identity_conflict"
    );
  }


  return reasons;
}


export function collectPaymentDiagnostics(
  sqlite:
    PaymentDiagnosticsDatabase,

  options:
    PaymentDiagnosticsOptions = {}
): PaymentDiagnosticsReport {
  assertDiagnosticsSchema(
    sqlite
  );


  const pendingOlderThanHours =
    assertPositiveInteger(
      options.pendingOlderThanHours ??
        DEFAULT_PENDING_HOURS,
      "pendingOlderThanHours",
      MAX_PENDING_HOURS
    );


  const recentLimit =
    assertPositiveInteger(
      options.recentLimit ??
        DEFAULT_RECENT_LIMIT,
      "recentLimit",
      MAX_RECENT_LIMIT
    );


  const now =
    options.now ??
    new Date();


  if (
    !Number.isFinite(
      now.getTime()
    )
  ) {
    throw new PaymentDiagnosticsError(
      "Data de diagnóstico inválida."
    );
  }


  const generatedAt =
    now.toISOString();


  const pendingCutoff =
    new Date(
      now.getTime() -
      pendingOlderThanHours *
        60 *
        60 *
        1000
    ).toISOString();


  const ledgerSummary =
    sqlite
      .prepare(`
        SELECT
          COUNT(*) AS total_events,
          COALESCE(
            SUM(occurrence_count),
            0
          ) AS total_deliveries
        FROM payment_webhook_events
      `)
      .get() as {
        total_events:
          number;

        total_deliveries:
          number;
      };


  const outcomeRows =
    sqlite
      .prepare(`
        SELECT
          outcome,
          COUNT(*) AS events,
          COALESCE(
            SUM(occurrence_count),
            0
          ) AS deliveries
        FROM payment_webhook_events
        GROUP BY outcome
        ORDER BY outcome
      `)
      .all() as
        Array<{
          outcome:
            string;

          events:
            number;

          deliveries:
            number;
        }>;


  const lastEventRow =
    sqlite
      .prepare(`
        SELECT
          id,
          payment_id,
          mp_status,
          outcome,
          error_code,
          request_id,
          occurrence_count,
          last_received_at,
          processed_at
        FROM payment_webhook_events
        ORDER BY
          last_received_at DESC,
          id DESC
        LIMIT 1
      `)
      .get() as
        | {
            id:
              number;

            payment_id:
              string;

            mp_status:
              string;

            outcome:
              string;

            error_code:
              string | null;

            request_id:
              string;

            occurrence_count:
              number;

            last_received_at:
              string;

            processed_at:
              string;
          }
        | undefined;


  const quarantinedRows =
    sqlite
      .prepare(`
        SELECT
          id,
          payment_id,
          error_code,
          request_id,
          occurrence_count,
          last_received_at
        FROM payment_webhook_events
        WHERE outcome = 'quarantined'
        ORDER BY
          last_received_at DESC,
          id DESC
        LIMIT ?
      `)
      .all(
        recentLimit
      ) as
        Array<{
          id:
            number;

          payment_id:
            string;

          error_code:
            string | null;

          request_id:
            string;

          occurrence_count:
            number;

          last_received_at:
            string;
        }>;


  const duplicateRows =
    sqlite
      .prepare(`
        SELECT
          id,
          payment_id,
          outcome,
          occurrence_count,
          last_received_at
        FROM payment_webhook_events
        WHERE occurrence_count > 1
        ORDER BY
          last_received_at DESC,
          id DESC
        LIMIT ?
      `)
      .all(
        recentLimit
      ) as
        Array<{
          id:
            number;

          payment_id:
            string;

          outcome:
            string;

          occurrence_count:
            number;

          last_received_at:
            string;
        }>;


  const orderStatusRows =
    sqlite
      .prepare(`
        SELECT
          status,
          COUNT(*) AS count
        FROM orders
        GROUP BY status
        ORDER BY status
      `)
      .all() as
        Array<{
          status:
            string;

          count:
            number;
        }>;


  const approvedWithoutPaymentIdRows =
    sqlite
      .prepare(`
        SELECT
          id AS order_id,
          external_reference,
          updated_at
        FROM orders
        WHERE
          status = 'approved'
          AND (
            mp_payment_id IS NULL
            OR TRIM(mp_payment_id) = ''
          )
        ORDER BY
          updated_at DESC,
          id DESC
        LIMIT ?
      `)
      .all(
        recentLimit
      ) as
        Array<{
          order_id:
            number;

          external_reference:
            string | null;

          updated_at:
            string;
        }>;


  const stalePendingRows =
    sqlite
      .prepare(`
        SELECT
          id AS order_id,
          external_reference,
          created_at,
          updated_at
        FROM orders
        WHERE
          status = 'pending'
          AND julianday(created_at) <=
            julianday(?)
        ORDER BY
          created_at ASC,
          id ASC
        LIMIT ?
      `)
      .all(
        pendingCutoff,
        recentLimit
      ) as
        Array<{
          order_id:
            number;

          external_reference:
            string | null;

          created_at:
            string;

          updated_at:
            string;
        }>;


  const revokedRows =
    sqlite
      .prepare(`
        SELECT
          id AS order_id,
          status,
          mp_payment_id,
          updated_at
        FROM orders
        WHERE status IN (
          'refunded',
          'charged_back'
        )
        ORDER BY
          updated_at DESC,
          id DESC
        LIMIT ?
      `)
      .all(
        recentLimit
      ) as
        Array<{
          order_id:
            number;

          status:
            string;

          mp_payment_id:
            string | null;

          updated_at:
            string;
        }>;


  const unmatchedRows =
    sqlite
      .prepare(`
        SELECT
          e.external_reference,
          e.payment_id,
          MAX(
            e.last_received_at
          ) AS last_received_at
        FROM payment_webhook_events e
        LEFT JOIN orders o
          ON o.external_reference =
            e.external_reference
        WHERE
          e.external_reference IS NOT NULL
          AND TRIM(
            e.external_reference
          ) <> ''
          AND o.id IS NULL
        GROUP BY
          e.external_reference,
          e.payment_id
        ORDER BY
          last_received_at DESC
        LIMIT ?
      `)
      .all(
        recentLimit
      ) as
        Array<{
          external_reference:
            string;

          payment_id:
            string;

          last_received_at:
            string;
        }>;


  const conflictRows =
    sqlite
      .prepare(`
        SELECT
          o.id AS order_id,
          e.external_reference,
          o.mp_payment_id
            AS order_payment_id,
          e.payment_id
            AS event_payment_id,
          MAX(
            e.last_received_at
          ) AS last_received_at
        FROM payment_webhook_events e
        INNER JOIN orders o
          ON o.external_reference =
            e.external_reference
        WHERE
          e.external_reference IS NOT NULL
          AND TRIM(
            e.external_reference
          ) <> ''
          AND o.mp_payment_id IS NOT NULL
          AND TRIM(
            o.mp_payment_id
          ) <> ''
          AND o.mp_payment_id <>
            e.payment_id
        GROUP BY
          o.id,
          e.external_reference,
          o.mp_payment_id,
          e.payment_id
        ORDER BY
          last_received_at DESC
        LIMIT ?
      `)
      .all(
        recentLimit
      ) as
        Array<{
          order_id:
            number;

          external_reference:
            string;

          order_payment_id:
            string;

          event_payment_id:
            string;

          last_received_at:
            string;
        }>;


  const reportWithoutHealth:
    Omit<
      PaymentDiagnosticsReport,
      "health"
    > = {
      generatedAt,

      thresholds: {
        pendingOlderThanHours,
        recentLimit,
      },

      ledger: {
        totalEvents:
          Number(
            ledgerSummary
              .total_events
          ),

        totalDeliveries:
          Number(
            ledgerSummary
              .total_deliveries
          ),

        outcomes:
          outcomeRows.map(
            (
              row
            ) => ({
              outcome:
                row.outcome,

              events:
                Number(
                  row.events
                ),

              deliveries:
                Number(
                  row.deliveries
                ),
            })
          ),

        lastEvent:
          lastEventRow
            ? {
                id:
                  lastEventRow.id,

                paymentId:
                  lastEventRow
                    .payment_id,

                mpStatus:
                  lastEventRow
                    .mp_status,

                outcome:
                  lastEventRow
                    .outcome,

                errorCode:
                  lastEventRow
                    .error_code,

                requestId:
                  lastEventRow
                    .request_id,

                occurrenceCount:
                  lastEventRow
                    .occurrence_count,

                lastReceivedAt:
                  lastEventRow
                    .last_received_at,

                processedAt:
                  lastEventRow
                    .processed_at,
              }
            : null,

        quarantined:
          quarantinedRows.map(
            (
              row
            ) => ({
              id:
                row.id,

              paymentId:
                row.payment_id,

              errorCode:
                row.error_code,

              requestId:
                row.request_id,

              occurrenceCount:
                row.occurrence_count,

              lastReceivedAt:
                row.last_received_at,
            })
          ),

        duplicates:
          duplicateRows.map(
            (
              row
            ) => ({
              id:
                row.id,

              paymentId:
                row.payment_id,

              outcome:
                row.outcome,

              occurrenceCount:
                row.occurrence_count,

              lastReceivedAt:
                row.last_received_at,
            })
          ),
      },

      orders: {
        statuses:
          orderStatusRows.map(
            (
              row
            ) => ({
              status:
                row.status,

              count:
                Number(
                  row.count
                ),
            })
          ),

        approvedWithoutPaymentId:
          approvedWithoutPaymentIdRows.map(
            (
              row
            ) => ({
              orderId:
                row.order_id,

              externalReference:
                row.external_reference,

              updatedAt:
                row.updated_at,
            })
          ),

        stalePending:
          stalePendingRows.map(
            (
              row
            ) => ({
              orderId:
                row.order_id,

              externalReference:
                row.external_reference,

              createdAt:
                row.created_at,

              updatedAt:
                row.updated_at,
            })
          ),

        revoked:
          revokedRows.map(
            (
              row
            ) => ({
              orderId:
                row.order_id,

              status:
                row.status,

              paymentId:
                row.mp_payment_id,

              updatedAt:
                row.updated_at,
            })
          ),
      },

      correlation: {
        unmatchedExternalReferences:
          unmatchedRows.map(
            (
              row
            ) => ({
              externalReference:
                row.external_reference,

              paymentId:
                row.payment_id,

              lastReceivedAt:
                row.last_received_at,
            })
          ),

        paymentIdentityConflicts:
          conflictRows.map(
            (
              row
            ) => ({
              orderId:
                row.order_id,

              externalReference:
                row.external_reference,

              orderPaymentId:
                row.order_payment_id,

              eventPaymentId:
                row.event_payment_id,

              lastReceivedAt:
                row.last_received_at,
            })
          ),
      },
    };


  const reasons =
    countHealthReasons(
      reportWithoutHealth
    );


  return {
    ...reportWithoutHealth,

    health: {
      status:
        reasons.length >
        0
          ? "attention"
          : "ok",

      reasons,
    },
  };
}


function pushJsonRows(
  lines:
    string[],

  title:
    string,

  rows:
    unknown[]
): void {
  lines.push(
    "",
    title
  );


  if (
    rows.length ===
    0
  ) {
    lines.push(
      "  nenhum"
    );

    return;
  }


  for (
    const row
    of rows
  ) {
    lines.push(
      `  - ${JSON.stringify(
        row
      )}`
    );
  }
}


export function formatPaymentDiagnostics(
  report:
    PaymentDiagnosticsReport
): string {
  const lines:
    string[] = [
      "=== FACIL DIGITAL+ | DIAGNOSTICO FINANCEIRO ===",
      "",
      `gerado_em: ${report.generatedAt}`,
      `health: ${report.health.status}`,
      `pending_limite_horas: ${report.thresholds.pendingOlderThanHours}`,
      `limite_por_secao: ${report.thresholds.recentLimit}`,
      "",
      `ledger_eventos: ${report.ledger.totalEvents}`,
      `ledger_entregas: ${report.ledger.totalDeliveries}`,
    ];


  if (
    report.health
      .reasons.length >
    0
  ) {
    lines.push(
      `motivos_atencao: ${report.health.reasons.join(
        ", "
      )}`
    );
  } else {
    lines.push(
      "motivos_atencao: nenhum"
    );
  }


  pushJsonRows(
    lines,
    "OUTCOMES DO LEDGER",
    report.ledger
      .outcomes
  );


  pushJsonRows(
    lines,
    "ULTIMO EVENTO",
    report.ledger
      .lastEvent
      ? [
          report.ledger
            .lastEvent,
        ]
      : []
  );


  pushJsonRows(
    lines,
    "QUARENTENA",
    report.ledger
      .quarantined
  );


  pushJsonRows(
    lines,
    "REENVIOS / DUPLICIDADES",
    report.ledger
      .duplicates
  );


  pushJsonRows(
    lines,
    "STATUS DOS PEDIDOS",
    report.orders
      .statuses
  );


  pushJsonRows(
    lines,
    "APPROVED SEM PAYMENT_ID",
    report.orders
      .approvedWithoutPaymentId
  );


  pushJsonRows(
    lines,
    "PENDING ANTIGOS",
    report.orders
      .stalePending
  );


  pushJsonRows(
    lines,
    "REFUNDS / CHARGEBACKS",
    report.orders
      .revoked
  );


  pushJsonRows(
    lines,
    "REFERENCIAS DO LEDGER SEM PEDIDO",
    report.correlation
      .unmatchedExternalReferences
  );


  pushJsonRows(
    lines,
    "CONFLITOS DE IDENTIDADE FINANCEIRA",
    report.correlation
      .paymentIdentityConflicts
  );


  lines.push(
    "",
    "OBSERVACAO",
    "Este relatorio e somente leitura.",
    "Nenhum status financeiro foi alterado."
  );


  return lines.join(
    "\n"
  );
}