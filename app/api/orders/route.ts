import { NextRequest, NextResponse } from "next/server";
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "../../../db/index.js";
import { orders, orderItems, products } from "../../../db/schema.js";
import { validateSession } from "../../../lib/auth.js";
import { initDatabase } from "../../../db/init.js";

// GET /api/orders — Listar pedidos do usuário logado
export async function GET(request: NextRequest) {
  try {
    await initDatabase();
    const db = getDb();

    const token = request.cookies.get("fd-session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const user = await validateSession(token);
    if (!user) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    // Buscar pedidos do usuário com seus itens
    const userOrders = await db
      .select({
        id: orders.id,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        subtotal: orders.subtotal,
        discount: orders.discount,
        total: orders.total,
        coupon: orders.coupon,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(eq(orders.userId, user.id))
      .orderBy(desc(orders.createdAt))
      .all();

    // Para cada pedido, buscar os itens com detalhes do produto
    const ordersWithItems = await Promise.all(
      userOrders.map(async (order) => {
        const items = await db
          .select({
            id: orderItems.id,
            quantity: orderItems.quantity,
            unitPrice: orderItems.unitPrice,
            productSlug: products.slug,
            productTitle: products.title,
            productShortTitle: products.shortTitle,
            productCover: products.cover,
            productCoverClass: products.coverClass,
          })
          .from(orderItems)
          .innerJoin(products, eq(orderItems.productId, products.id))
          .where(eq(orderItems.orderId, order.id))
          .all();

        return { ...order, items };
      })
    );

    return NextResponse.json({ orders: ordersWithItems });
  } catch (error) {
    console.error("Erro ao listar pedidos:", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

// POST /api/orders — Criar novo pedido (chamado após checkout confirmado)
export async function POST(request: NextRequest) {
  try {
    await initDatabase();
    const db = getDb();

    const token = request.cookies.get("fd-session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const user = await validateSession(token);
    if (!user) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    const body = await request.json();
    const { items, paymentMethod = "pix", coupon, mpPaymentId } = body;

    // Validar itens
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Carrinho vazio." }, { status: 400 });
    }

    // Buscar produtos e calcular totais
    const productSlugs = items.map((i: any) => i.slug);
    const dbProducts = await db
      .select()
      .from(products)
      .all();

    const productsMap = new Map(dbProducts.map((p) => [p.slug, p]));

    let subtotal = 0;
    const validItems: Array<{ productId: number; quantity: number; unitPrice: number; slug: string }> = [];

    for (const item of items) {
      const product = productsMap.get(item.slug);
      if (!product || !product.active) continue;

      const price = paymentMethod === "pix" && product.pixPrice ? product.pixPrice : product.price;
      const quantity = item.quantity || 1;

      subtotal += price * quantity;
      validItems.push({
        productId: product.id,
        quantity,
        unitPrice: price,
        slug: product.slug,
      });
    }

    if (validItems.length === 0) {
      return NextResponse.json({ error: "Nenhum produto válido." }, { status: 400 });
    }

    // Aplicar desconto
    let discount = 0;
    if (coupon === "APROVA10") {
      discount = 10;
    }
    const total = Math.max(0, subtotal - discount);

    // Criar pedido
    const orderResult = await db
      .insert(orders)
      .values({
        userId: user.id,
        status: "approved", // Em produção, começa como "pending" e webhook atualiza
        paymentMethod,
        mpPaymentId: mpPaymentId || null,
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
        unitPrice: item.unitPrice,
      });
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        total: order.total,
        status: order.status,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar pedido:", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}