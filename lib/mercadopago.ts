import {
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

export interface CartItemForMP {
  id: string;
  title: string;
  description: string;
  quantity: number;
  unit_price: number;
}

export interface CheckoutData {
  items: CartItemForMP[];
  userEmail: string;
  userName: string;
  orderReference: string;
  backUrl: string;
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


    console.error(
      "Erro ao criar preferência Mercado Pago:",
      error
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

// Consultar status de um pagamento
export async function getPaymentStatus(paymentId: string): Promise<{
  status: string;
  status_detail: string;
  external_reference: string;
  transaction_amount: number;
}> {
  try {
    const payment =
      createPaymentClient();


    const response =
      await payment.get(
        {
          id:
            paymentId,
        }
      );

    return {
      status: response.status || "unknown",
      status_detail: response.status_detail || "",
      external_reference: response.external_reference || "",
      transaction_amount: response.transaction_amount || 0,
    };
  } catch (error) {
    if (
      error instanceof
      PaymentConfigurationError
    ) {
      throw error;
    }


    console.error(
      "Erro ao consultar pagamento:",
      error
    );


    throw new MercadoPagoProviderError(
      "Falha ao verificar pagamento."
    );
  }
}

// Validar assinatura de webhook (HMAC SHA-256)
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const { createHmac, timingSafeEqual } = await import("crypto");

  try {
    const hmac = createHmac("sha256", secret);
    hmac.update(payload);
    const expected = hmac.digest("hex");

    const expectedBuffer = Buffer.from(expected, "hex");
    const receivedBuffer = Buffer.from(signature.split(",")[0]?.replace("sha256=", "") || "", "hex");

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch {
    return false;
  }
}