import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getDb } from "../../../db/index";
import { orders, orderItems, products } from "../../../db/schema";
import { validateSession } from "../../../lib/auth";
import { initDatabase } from "../../../db/init";

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