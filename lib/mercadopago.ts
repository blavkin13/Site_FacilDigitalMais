import {
  Chargeback,
  MercadoPagoConfig,
  Payment,
  Preference,
} from "mercadopago";

import {
  getMercadoPagoAccessToken,
  PaymentConfigurationError,
} from "./payment-config";


export class MercadoPagoProviderError
  extends Error {
  readonly code =
    "MERCADO_PAGO_PROVIDER_ERROR";

  constructor(
    message: string
  ) {
    super(
      message
    );

    this.name =
      "MercadoPagoProviderError";
  }
}


function createMercadoPagoClient():
  MercadoPagoConfig {
  return new MercadoPagoConfig(
    {
      accessToken:
        getMercadoPagoAccessToken(),

      options: {
        timeout:
          5000,
      },
    }
  );
}


function createPreferenceClient():
  Preference {
  return new Preference(
    createMercadoPagoClient()
  );
}


function createPaymentClient():
  Payment {
  return new Payment(
    createMercadoPagoClient()
  );
}

function createChargebackClient():
  Chargeback {
  return new Chargeback(
    createMercadoPagoClient()
  );
}

export interface CartItemForMP {
  id: string;
  title: string;
  description: string;
  quantity: number;
  unit_price: number;
}

export interface CheckoutData {
  items: CartItemForMP[];

  expectedTotal:
    number;

  userEmail:
    string;

  userName:
    string;

  orderReference:
    string;

  backUrl:
    string;
}

function paymentValueToCents(
  value: number,
  label:
    string
): number {
  if (
    !Number.isFinite(
      value
    )
  ) {
    throw new MercadoPagoProviderError(
      `${label} inválido.`
    );
  }


  const cents =
    Math.round(
      (
        value +
        Number.EPSILON
      ) *
        100
    );


  if (
    !Number.isSafeInteger(
      cents
    ) ||
    cents <= 0
  ) {
    throw new MercadoPagoProviderError(
      `${label} inválido.`
    );
  }


  return cents;
}


export function calculateMercadoPagoItemsTotalCents(
  items:
    CartItemForMP[]
): number {
  if (
    !Array.isArray(
      items
    ) ||
    items.length ===
      0
  ) {
    throw new MercadoPagoProviderError(
      "Preferência sem itens."
    );
  }


  let totalCents =
    0;


  for (
    const item
    of items
  ) {
    if (
      !Number.isInteger(
        item.quantity
      ) ||
      item.quantity <=
        0
    ) {
      throw new MercadoPagoProviderError(
        "Quantidade inválida na preferência."
      );
    }


    const unitPriceCents =
      paymentValueToCents(
        item.unit_price,
        "Preço da preferência"
      );


    const itemTotalCents =
      unitPriceCents *
      item.quantity;


    if (
      !Number.isSafeInteger(
        itemTotalCents
      )
    ) {
      throw new MercadoPagoProviderError(
        "Valor da preferência excede o limite suportado."
      );
    }


    totalCents +=
      itemTotalCents;


    if (
      !Number.isSafeInteger(
        totalCents
      )
    ) {
      throw new MercadoPagoProviderError(
        "Valor total da preferência excede o limite suportado."
      );
    }
  }


  return totalCents;
}


export function assertPaymentPreferenceAmount(
  items:
    CartItemForMP[],
  expectedTotal:
    number
): void {
  const expectedTotalCents =
    paymentValueToCents(
      expectedTotal,
      "Total esperado"
    );


  const itemsTotalCents =
    calculateMercadoPagoItemsTotalCents(
      items
    );


  if (
    itemsTotalCents !==
    expectedTotalCents
  ) {
    throw new MercadoPagoProviderError(
      "Valor da preferência diverge do total do pedido."
    );
  }
}

export interface PaymentPreferenceResult {
  init_point:
    string;

  preference_id:
    string;
}


export function parsePaymentPreferenceResponse(
  response: unknown
): PaymentPreferenceResult {
  if (
    !response ||
    typeof response !==
      "object" ||
    Array.isArray(
      response
    )
  ) {
    throw new MercadoPagoProviderError(
      "Mercado Pago retornou uma preferência inválida."
    );
  }


  const record =
    response as Record<
      string,
      unknown
    >;


  const preferenceId =
    typeof record.id ===
      "string"
      ? record.id.trim()
      : "";


  if (!preferenceId) {
    throw new MercadoPagoProviderError(
      "Mercado Pago não retornou preference_id."
    );
  }


  const initPoint =
    typeof record.init_point ===
      "string"
      ? record.init_point.trim()
      : "";


  if (!initPoint) {
    throw new MercadoPagoProviderError(
      "Mercado Pago não retornou checkout URL."
    );
  }


  let checkoutUrl:
    URL;


  try {
    checkoutUrl =
      new URL(
        initPoint
      );
  } catch {
    throw new MercadoPagoProviderError(
      "Mercado Pago retornou checkout URL inválida."
    );
  }


  if (
    checkoutUrl.protocol !==
      "https:"
  ) {
    throw new MercadoPagoProviderError(
      "Mercado Pago retornou checkout URL insegura."
    );
  }


  if (
    checkoutUrl.username ||
    checkoutUrl.password
  ) {
    throw new MercadoPagoProviderError(
      "Mercado Pago retornou checkout URL inválida."
    );
  }


  return {
    init_point:
      initPoint,

    preference_id:
      preferenceId,
  };
}

// Criar preferência de pagamento no Mercado Pago
export async function createPaymentPreference(data: CheckoutData): Promise<{
  init_point: string;
  preference_id: string;
}> {
  try {
    /**
     * Segurança financeira:
     *
     * nenhuma preferência é enviada ao provedor
     * quando a soma dos itens diverge de
     * orders.total.
     */
    assertPaymentPreferenceAmount(
      data.items,
      data.expectedTotal
    );


    const preference =
      createPreferenceClient();


    const response =
      await preference.create({
        body: {
          items: data.items.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
          })),
          payer: {
            email: data.userEmail,
            name: data.userName,
          },
          back_urls: {
            success: `${data.backUrl}/checkout/success`,
            pending: `${data.backUrl}/checkout/pending`,
            failure: `${data.backUrl}/checkout/failure`,
          },
          auto_return: "approved",
          external_reference: data.orderReference,
          statement_descriptor: "FACILDIGITAL",
          metadata: {
            order_reference: data.orderReference,
          },
        },
      });

    return parsePaymentPreferenceResponse(
      response
    );
  } catch (error) {
    if (
      error instanceof
      PaymentConfigurationError
    ) {
      throw error;
    }


    /**
     * Não despejamos o objeto bruto retornado pelo
     * SDK no log.
     *
     * Erros do provedor podem conter metadados de
     * request/response que não pertencem ao log
     * operacional da aplicação.
     */
    console.error(
      "Falha do provedor ao criar preferência Mercado Pago."
    );


    if (
      error instanceof
      MercadoPagoProviderError
    ) {
      throw error;
    }


    throw new MercadoPagoProviderError(
      "Falha ao iniciar pagamento."
    );
  }
}

export const MERCADO_PAGO_PAYMENT_STATUSES =
  [
    "pending",
    "approved",
    "authorized",
    "in_process",
    "in_mediation",
    "rejected",
    "cancelled",
    "refunded",
    "charged_back",
  ] as const;


export type MercadoPagoPaymentStatusValue =
  (
    typeof MERCADO_PAGO_PAYMENT_STATUSES
  )[number];


export interface MercadoPagoPaymentStatus {
  id:
    string;

  status:
    MercadoPagoPaymentStatusValue;

  status_detail:
    string;

  external_reference:
    string;

  transaction_amount:
    number;

  /**
   * Valor acumulado já reembolsado pelo MP.
   *
   * Zero quando nenhum refund foi informado.
   */
  transaction_amount_refunded:
    number;

  currency_id:
    string;
}


function normalizePaymentIdentifier(
  value:
    unknown
): string | null {
  if (
    typeof value !==
      "string" &&
    typeof value !==
      "number"
  ) {
    return null;
  }


  const normalized =
    String(
      value
    ).trim();


  return normalized
    ? normalized
    : null;
}


export interface MercadoPagoChargebackReference {
  chargebackId:
    string;

  paymentId:
    string;
}


/**
 * Converte a resposta autenticada de
 * GET /v1/chargebacks/{id}
 * em uma referência canônica ao pagamento.
 *
 * Existem atualmente duas representações
 * observáveis no ecossistema oficial:
 *
 * - SDK Node 3.4.0:
 *     payment_id
 *
 * - documentação da API:
 *     payments: [...]
 *
 * Não confiamos em apenas uma delas.
 *
 * Entretanto, a contestação só pode seguir para
 * nossa máquina financeira se todas as referências
 * presentes convergirem para exatamente um
 * payment_id.
 */
export function parseMercadoPagoChargebackResponse(
  response:
    unknown,

  requestedChargebackId:
    string
): MercadoPagoChargebackReference {
  const normalizedRequestedId =
    requestedChargebackId
      .trim();


  if (
    !normalizedRequestedId
  ) {
    throw new MercadoPagoProviderError(
      "chargeback_id solicitado é inválido."
    );
  }


  if (
    !response ||
    typeof response !==
      "object" ||
    Array.isArray(
      response
    )
  ) {
    throw new MercadoPagoProviderError(
      "Resposta de contestação inválida."
    );
  }


  const chargeback =
    response as Record<
      string,
      unknown
    >;


  const chargebackId =
    normalizePaymentIdentifier(
      chargeback.id
    );


  if (!chargebackId) {
    throw new MercadoPagoProviderError(
      "Resposta de contestação sem id."
    );
  }


  /**
   * O recurso retornado pelo Mercado Pago precisa
   * ser exatamente a contestação autenticada pelo
   * webhook.
   */
  if (
    chargebackId !==
    normalizedRequestedId
  ) {
    throw new MercadoPagoProviderError(
      "chargeback_id retornado diverge do solicitado."
    );
  }


  const paymentIds =
    new Set<string>();


  /**
   * Formato tipado pelo SDK Node 3.4.0.
   */
  if (
    chargeback.payment_id !==
      undefined &&
    chargeback.payment_id !==
      null
  ) {
    const paymentId =
      normalizePaymentIdentifier(
        chargeback.payment_id
      );


    if (!paymentId) {
      throw new MercadoPagoProviderError(
        "Contestação possui payment_id inválido."
      );
    }


    paymentIds.add(
      paymentId
    );
  }


  /**
   * Formato documentado pela API do Mercado Pago.
   *
   * A documentação atual descreve `payments` como
   * lista. Aceitamos também um único identificador
   * escalar porque versões/respostas históricas da
   * API já apresentaram essa representação.
   */
  if (
    chargeback.payments !==
      undefined &&
    chargeback.payments !==
      null
  ) {
    const rawPayments =
      Array.isArray(
        chargeback.payments
      )
        ? chargeback.payments
        : [
            chargeback.payments,
          ];


    if (
      rawPayments.length ===
      0
    ) {
      throw new MercadoPagoProviderError(
        "Contestação sem pagamentos associados."
      );
    }


    for (
      const rawPaymentId
      of rawPayments
    ) {
      const paymentId =
        normalizePaymentIdentifier(
          rawPaymentId
        );


      if (!paymentId) {
        throw new MercadoPagoProviderError(
          "Contestação possui payment_id inválido."
        );
      }


      paymentIds.add(
        paymentId
      );
    }
  }


  if (
    paymentIds.size ===
    0
  ) {
    throw new MercadoPagoProviderError(
      "Contestação sem payment_id canônico."
    );
  }


  /**
   * Nosso pedido possui uma identidade financeira
   * canônica.
   *
   * Se a resposta do provedor apontar para mais de
   * um pagamento distinto, não escolhemos um deles
   * arbitrariamente.
   */
  if (
    paymentIds.size !==
    1
  ) {
    throw new MercadoPagoProviderError(
      "Contestação referencia múltiplos pagamentos."
    );
  }


  const paymentId =
    paymentIds
      .values()
      .next()
      .value;


  if (!paymentId) {
    throw new MercadoPagoProviderError(
      "Contestação sem payment_id canônico."
    );
  }


  return {
    chargebackId,

    paymentId,
  };
}


function isMercadoPagoPaymentStatus(
  value:
    string
): value is
  MercadoPagoPaymentStatusValue {
  return (
    MERCADO_PAGO_PAYMENT_STATUSES as
      readonly string[]
  ).includes(
    value
  );
}


export function parseMercadoPagoPaymentResponse(
  response:
    unknown,
  requestedPaymentId:
    string
): MercadoPagoPaymentStatus {
  const normalizedRequestedId =
    requestedPaymentId.trim();


  if (
    !normalizedRequestedId
  ) {
    throw new MercadoPagoProviderError(
      "payment_id solicitado é inválido."
    );
  }


  if (
    !response ||
    typeof response !==
      "object" ||
    Array.isArray(
      response
    )
  ) {
    throw new MercadoPagoProviderError(
      "Resposta de pagamento inválida."
    );
  }


  const payment =
    response as Record<
      string,
      unknown
    >;


  const paymentId =
    normalizePaymentIdentifier(
      payment.id
    );


  if (!paymentId) {
    throw new MercadoPagoProviderError(
      "Resposta de pagamento sem id."
    );
  }


  /**
   * A API consultada precisa devolver exatamente
   * o recurso autenticado pelo webhook.
   */
  if (
    paymentId !==
    normalizedRequestedId
  ) {
    throw new MercadoPagoProviderError(
      "payment_id retornado diverge do solicitado."
    );
  }


  if (
    typeof payment.status !==
      "string"
  ) {
    throw new MercadoPagoProviderError(
      "Resposta de pagamento sem status."
    );
  }


  const status =
    payment.status.trim();


  if (
    !status ||
    !isMercadoPagoPaymentStatus(
      status
    )
  ) {
    throw new MercadoPagoProviderError(
      "Status de pagamento inválido."
    );
  }


  if (
    typeof payment.external_reference !==
      "string"
  ) {
    throw new MercadoPagoProviderError(
      "Pagamento sem external_reference."
    );
  }


  const externalReference =
    payment
      .external_reference
      .trim();


  if (
    !externalReference
  ) {
    throw new MercadoPagoProviderError(
      "Pagamento sem external_reference."
    );
  }


  if (
    typeof payment.transaction_amount !==
      "number" ||
    !Number.isFinite(
      payment.transaction_amount
    ) ||
    payment.transaction_amount <=
      0
  ) {
    throw new MercadoPagoProviderError(
      "Pagamento com transaction_amount inválido."
    );
  }


  /**
   * transaction_amount_refunded pode não existir
   * enquanto nenhum reembolso ocorreu.
   *
   * Quando presente:
   *
   * - deve ser numérico;
   * - finito;
   * - não negativo;
   * - não pode possuir fração menor que centavo;
   * - não pode ultrapassar o valor original.
   */
  let transactionAmountRefunded =
    0;


  if (
    payment.transaction_amount_refunded !==
      undefined &&
    payment.transaction_amount_refunded !==
      null
  ) {
    if (
      typeof payment.transaction_amount_refunded !==
        "number" ||
      !Number.isFinite(
        payment.transaction_amount_refunded
      ) ||
      payment.transaction_amount_refunded <
        0
    ) {
      throw new MercadoPagoProviderError(
        "Pagamento com transaction_amount_refunded inválido."
      );
    }


    const refundedCents =
      Math.round(
        payment.transaction_amount_refunded *
          100
      );


    if (
      Math.abs(
        payment.transaction_amount_refunded *
          100 -
          refundedCents
      ) >
      1e-9
    ) {
      throw new MercadoPagoProviderError(
        "transaction_amount_refunded possui precisão monetária inválida."
      );
    }


    const transactionCents =
      Math.round(
        payment.transaction_amount *
          100
      );


    if (
      refundedCents >
      transactionCents
    ) {
      throw new MercadoPagoProviderError(
        "transaction_amount_refunded excede transaction_amount."
      );
    }


    transactionAmountRefunded =
      refundedCents /
      100;
  }


  if (
    typeof payment.currency_id !==
      "string"
  ) {
    throw new MercadoPagoProviderError(
      "Pagamento sem currency_id."
    );
  }


  const currencyId =
    payment.currency_id
      .trim()
      .toUpperCase();


  if (!currencyId) {
    throw new MercadoPagoProviderError(
      "Pagamento sem currency_id."
    );
  }


  const statusDetail =
    typeof payment.status_detail ===
      "string"
      ? payment.status_detail.trim()
      : "";


  return {
    id:
      paymentId,

    status,

    status_detail:
      statusDetail,

    external_reference:
      externalReference,

    transaction_amount:
      payment.transaction_amount,

    transaction_amount_refunded:
      transactionAmountRefunded,

    currency_id:
      currencyId,
  };
}

// Consultar status de um pagamento
export async function getPaymentStatus(
  paymentId:
    string
): Promise<
  MercadoPagoPaymentStatus
> {
  const normalizedPaymentId =
    paymentId.trim();


  if (
    !normalizedPaymentId
  ) {
    throw new MercadoPagoProviderError(
      "payment_id solicitado é inválido."
    );
  }


  try {
    const payment =
      createPaymentClient();


    const response =
      await payment.get(
        {
          id:
            normalizedPaymentId,
        }
      );


    return parseMercadoPagoPaymentResponse(
      response,
      normalizedPaymentId
    );
  } catch (error) {
    if (
      error instanceof
      PaymentConfigurationError
    ) {
      throw error;
    }


    if (
      error instanceof
      MercadoPagoProviderError
    ) {
      throw error;
    }


    /**
     * O objeto bruto do SDK não é registrado.
     *
     * payment_id e resultado operacional já possuem
     * trilha própria no ledger/webhook.
     */
    console.error(
      "Falha do provedor ao consultar pagamento Mercado Pago."
    );


    throw new MercadoPagoProviderError(
      "Falha ao verificar pagamento."
    );
  }
}

/**
 * Resolve uma contestação autenticada para o
 * payment_id canônico informado pelo próprio
 * Mercado Pago.
 *
 * O body original do webhook NÃO é autoridade
 * sobre qual pagamento deve ser modificado.
 */
export async function getMercadoPagoChargebackPaymentId(
  chargebackId:
    string
): Promise<string> {
  const normalizedChargebackId =
    chargebackId
      .trim();


  if (
    !normalizedChargebackId
  ) {
    throw new MercadoPagoProviderError(
      "chargeback_id solicitado é inválido."
    );
  }


  try {
    const chargeback =
      createChargebackClient();


    const response =
      await chargeback.get(
        {
          id:
            normalizedChargebackId,
        }
      );


    const parsed =
      parseMercadoPagoChargebackResponse(
        response,
        normalizedChargebackId
      );


    return parsed.paymentId;
  } catch (error) {
    if (
      error instanceof
      PaymentConfigurationError
    ) {
      throw error;
    }


    if (
      error instanceof
      MercadoPagoProviderError
    ) {
      throw error;
    }


    console.error(
      "Erro ao consultar contestação Mercado Pago:",
      error
    );


    throw new MercadoPagoProviderError(
      "Falha ao verificar contestação."
    );
  }
}