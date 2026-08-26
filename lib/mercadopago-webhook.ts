import {
  InvalidWebhookSignatureError,
  WebhookSignatureValidator,
} from "mercadopago";

import {
  getMercadoPagoWebhookSecret,
  PaymentEnvironment,
} from "./payment-config";


export class MercadoPagoWebhookRequestError
  extends Error {
  readonly code =
    "MERCADO_PAGO_WEBHOOK_REQUEST_ERROR";

  readonly status =
    400;

  constructor(
    message: string
  ) {
    super(
      message
    );

    this.name =
      "MercadoPagoWebhookRequestError";
  }
}


export interface MercadoPagoWebhookSignatureInput {
  xSignature:
    string | null | undefined;

  xRequestId:
    string | null | undefined;

  dataId:
    string | null | undefined;

  environment?:
    PaymentEnvironment;
}


export interface MercadoPagoWebhookNotification {
  type:
    string;

  dataId:
    string;

  action:
    string | null;
}


function normalizeRequiredValue(
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


export function validateMercadoPagoWebhookSignature(
  input:
    MercadoPagoWebhookSignatureInput
): boolean {
  const xSignature =
    normalizeRequiredValue(
      input.xSignature
    );


  const xRequestId =
    normalizeRequiredValue(
      input.xRequestId
    );


  const dataId =
    normalizeRequiredValue(
      input.dataId
    );


  /**
   * Somos deliberadamente mais estritos do que o
   * construtor de manifesto permissivo do SDK.
   *
   * Para este endpoint de pagamentos, todos esses
   * elementos precisam existir.
   */
  if (
    !xSignature ||
    !xRequestId ||
    !dataId
  ) {
    return false;
  }


  /**
   * Secret ausente ou placeholder é erro de
   * configuração, não assinatura inválida.
   *
   * PaymentConfigurationError deve subir para o
   * handler HTTP e resultar em erro recuperável.
   */
  const secret =
    getMercadoPagoWebhookSecret(
      input.environment
    );


  try {
    WebhookSignatureValidator
      .validate(
        {
          xSignature,
          xRequestId,
          dataId,
          secret,
        }
      );


    return true;
  } catch (error) {
    if (
      error instanceof
      InvalidWebhookSignatureError
    ) {
      return false;
    }


    /**
     * Erro inesperado do SDK não é convertido em
     * "assinatura inválida".
     *
     * Ele deve subir para que o servidor retorne
     * erro e o evento possa ser reenviado.
     */
    throw error;
  }
}


export function parseMercadoPagoWebhookNotification(
  input: {
    rawBody:
      string;

    signedDataId:
      string | null | undefined;

    queryType:
      string | null | undefined;
  }
): MercadoPagoWebhookNotification {
  const signedDataId =
    normalizeRequiredValue(
      input.signedDataId
    );


  if (!signedDataId) {
    throw new MercadoPagoWebhookRequestError(
      "Webhook sem data.id."
    );
  }


  const queryType =
    normalizeRequiredValue(
      input.queryType
    );


  if (!queryType) {
    throw new MercadoPagoWebhookRequestError(
      "Webhook sem type."
    );
  }


  let parsed:
    unknown;


  try {
    parsed =
      JSON.parse(
        input.rawBody
      );
  } catch {
    throw new MercadoPagoWebhookRequestError(
      "Payload do webhook é inválido."
    );
  }


  if (
    !parsed ||
    typeof parsed !==
      "object" ||
    Array.isArray(
      parsed
    )
  ) {
    throw new MercadoPagoWebhookRequestError(
      "Payload do webhook é inválido."
    );
  }


  const body =
    parsed as Record<
      string,
      unknown
    >;


  const bodyType =
    typeof body.type ===
      "string"
      ? body.type.trim()
      : "";


  if (!bodyType) {
    throw new MercadoPagoWebhookRequestError(
      "Webhook sem type no payload."
    );
  }


  if (
    bodyType !==
    queryType
  ) {
    throw new MercadoPagoWebhookRequestError(
      "Tipo do webhook divergente."
    );
  }


  const data =
    body.data;


  if (
    !data ||
    typeof data !==
      "object" ||
    Array.isArray(
      data
    )
  ) {
    throw new MercadoPagoWebhookRequestError(
      "Webhook sem data válido."
    );
  }


  const bodyDataId =
    normalizeRequiredValue(
      typeof (
        data as Record<
          string,
          unknown
        >
      ).id ===
        "string" ||
      typeof (
        data as Record<
          string,
          unknown
        >
      ).id ===
        "number"
        ? String(
            (
              data as Record<
                string,
                unknown
              >
            ).id
          )
        : null
    );


  if (!bodyDataId) {
    throw new MercadoPagoWebhookRequestError(
      "Webhook sem data.id no payload."
    );
  }


  /**
   * A consulta ao Mercado Pago sempre usará o
   * data.id autenticado da query.
   *
   * O body precisa concordar exatamente com ele.
   */
  if (
    bodyDataId !==
    signedDataId
  ) {
    throw new MercadoPagoWebhookRequestError(
      "data.id divergente no webhook."
    );
  }


  const action =
    typeof body.action ===
      "string"
      ? body.action.trim() ||
        null
      : null;


  return {
    type:
      queryType,

    dataId:
      signedDataId,

    action,
  };
}