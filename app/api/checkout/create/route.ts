import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db/index";
import { orders, orderItems, products } from "../../../../db/schema";
import { validateSession } from "../../../../lib/auth";
import { createPaymentPreference } from "../../../../lib/mercadopago";
import { initDatabase } from "../../../../db/init";

export async function POST(request: NextRequest) {
  try {
    await initDatabase();
    const db = getDb();

    // Autenticação
    const token = request.cookies.get("fd-session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const user = await validateSession(token);
    if (!user) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    const body = await request.json();
    const { items, paymentMethod, coupon } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Carrinho vazio." }, { status: 400 });
    }

    // Buscar produtos do banco
    const allProducts = await db.select().from(products).all();
    const productsMap = new Map(allProducts.map((p) => [p.slug, p]));

    // Montar itens para o Mercado Pago
    const mpItems = [];
    let subtotal = 0;
    const validItems: Array<{ productId: number; slug: string; price: number; quantity: number }> = [];

    for (const item of items) {
      const product = productsMap.get(item.slug);
      if (!product || !product.active) continue;

      const price = paymentMethod === "pix" && product.pixPrice ? product.pixPrice : product.price;
      const quantity = item.quantity || 1;

      mpItems.push({
        id: product.slug,
        title: product.title,
        description: product.description || "Apostila digital",
        quantity,
        unit_price: price,
      });

      subtotal += price * quantity;
      validItems.push({ productId: product.id, slug: product.slug, price, quantity });
    }

    if (validItems.length === 0) {
      return NextResponse.json({ error: "Nenhum produto válido." }, { status: 400 });
    }

    // Aplicar desconto
    let discount = 0;
    if (coupon === "APROVA10") discount = 10;
    const total = Math.max(0, subtotal - discount);

    // Gerar referência única do pedido
    // Esta referência será usada como external_reference no Mercado Pago
    const orderReference = `FD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    // Criar pedido no banco (status: pending)
    const orderResult = await db
      .insert(orders)
      .values({
        userId: user.id,
        status: "pending",
        paymentMethod,
        subtotal,
        discount,
        total,
        coupon: coupon || null,
      })
      .returning();

    const order = orderResult[0]!;

    // Criar itens do pedido
    for (const item of validItems) {
      await db.insert(orderItems).values({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.price,
      });
    }

    // Criar preferência no Mercado Pago
    // O orderReference será enviado como external_reference para correlacionar webhooks
    const baseUrl = request.nextUrl.origin;

    let checkoutUrl = "";
    let preferenceId = "";

    try {
      const mpResult = await createPaymentPreference({
        items: mpItems,
        userEmail: user.email,
        userName: user.name || user.email,
        orderReference,
        backUrl: baseUrl,
      });
      checkoutUrl = mpResult.init_point;
      preferenceId = mpResult.preference_id;
    } catch (mpError) {
      console.error("Erro Mercado Pago (usando modo demo):", mpError);
      // Em desenvolvimento sem token real, simula a URL de checkout
      checkoutUrl = `${baseUrl}/checkout/success?demo=true&order=${order.id}`;
      preferenceId = `DEMO-${order.id}`;
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderReference,
      checkoutUrl,
      preferenceId,
      total,
    });
  } catch (error) {
    console.error("Erro ao criar checkout:", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}