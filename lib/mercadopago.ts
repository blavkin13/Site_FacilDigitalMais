import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

// Configuração do cliente Mercado Pago
// ⚠ IMPORTANTE: Substitua pelo seu Access Token real em produção
// Obtenha em: https://www.mercadopago.com.br/developers/panel/app
const MERCADO_PAGO_ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN || "TEST-ACCESS-TOKEN-FAKE";

const client = new MercadoPagoConfig({
  accessToken: MERCADO_PAGO_ACCESS_TOKEN,
  options: { timeout: 5000 },
});

const preference = new Preference(client);
const payment = new Payment(client);

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

// Criar preferência de pagamento no Mercado Pago
export async function createPaymentPreference(data: CheckoutData): Promise<{
  init_point: string;
  preference_id: string;
}> {
  try {
    const response = await preference.create({
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

    return {
      init_point: response.init_point || "",
      preference_id: response.id || "",
    };
  } catch (error) {
    console.error("Erro ao criar preferência Mercado Pago:", error);
    throw new Error("Falha ao iniciar pagamento. Tente novamente.");
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
    const response = await payment.get({ id: paymentId });
    return {
      status: response.status || "unknown",
      status_detail: response.status_detail || "",
      external_reference: response.external_reference || "",
      transaction_amount: response.transaction_amount || 0,
    };
  } catch (error) {
    console.error("Erro ao consultar pagamento:", error);
    throw new Error("Falha ao verificar pagamento.");
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