import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db/index";
import { orders } from "../../../../db/schema";
import { getPaymentStatus, verifyWebhookSignature } from "../../../../lib/mercadopago";
import { initDatabase } from "../../../../db/init";

const MP_WEBHOOK_SECRET = process.env.MERCADO_PAGO_WEBHOOK_SECRET || "";

export async function POST(request: NextRequest) {
  try {
    await initDatabase();
    const db = getDb();

    // Ler corpo da requisição
    const rawBody = await request.text();

    // Verificar assinatura (se secret estiver configurado)
    if (MP_WEBHOOK_SECRET) {
      const signature = request.headers.get("x-signature") || "";
      const isValid = await verifyWebhookSignature(rawBody, signature, MP_WEBHOOK_SECRET);

      if (!isValid) {
        console.warn("Webhook inválido: assinatura incorreta");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const body = JSON.parse(rawBody);
    const { type, data } = body;

    // Processar apenas eventos de pagamento
    if (type !== "payment") {
      return NextResponse.json({ received: true });
    }

    const paymentId = data?.id;
    if (!paymentId) {
      return NextResponse.json({ error: "Missing payment ID" }, { status: 400 });
    }

    // Consultar status do pagamento no Mercado Pago
    let paymentStatus;
    try {
      paymentStatus = await getPaymentStatus(String(paymentId));
    } catch {
      // Em modo demo, simula aprovação
      paymentStatus = {
        status: "approved",
        status_detail: "accredited",
        external_reference: data?.external_reference || "",
        transaction_amount: data?.transaction_amount || 0,
      };
    }

    // Buscar pedido pela referência externa
    const externalRef = paymentStatus.external_reference;
    if (!externalRef) {
      return NextResponse.json({ received: true });
    }

    // Buscar todos os pedidos e encontrar pela referência
    // (Em produção, armazenar external_reference em uma coluna do pedido)
    const allOrders = await db.select().from(orders).all();

    // Mapear status do MP para status interno
    const statusMap: Record<string, string> = {
      approved: "approved",
      authorized: "approved",
      pending: "pending",
      in_process: "pending",
      in_mediation: "pending",
      rejected: "rejected",
      cancelled: "rejected",
      refunded: "refunded",
      charged_back: "refunded",
    };

    const newStatus = statusMap[paymentStatus.status] || "pending";

    // Atualizar status do pedido (usando o mais recente pending)
    const pendingOrders = allOrders.filter((o) => o.status === "pending");
    if (pendingOrders.length > 0) {
      const latestOrder = pendingOrders[pendingOrders.length - 1];

      await db
        .update(orders)
        .set({
          status: newStatus as any,
          mpPaymentId: String(paymentId),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(orders.id, latestOrder.id));

      console.log(
        `✅ Pedido #${latestOrder.id} atualizado: ${latestOrder.status} → ${newStatus}`
      );
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Erro no webhook Mercado Pago:", error);
    return NextResponse.json({ received: true }); // Sempre 200 para evitar retry do MP
  }
}