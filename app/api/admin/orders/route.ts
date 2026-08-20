import { NextRequest, NextResponse } from "next/server";
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "../../../../db/index.js";
import { orders, orderItems, products, users } from "../../../../db/schema.js";
import { validateSession } from "../../../../lib/auth.js";
import { initDatabase } from "../../../../db/init.js";

export async function GET(request: NextRequest) {
  try {
    await initDatabase();
    const db = getDb();

    // Autenticação + autorização
    const token = request.cookies.get("fd-session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const user = await validateSession(token);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    // Parâmetros de filtro
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Buscar pedidos com dados do usuário
    let query = db
      .select({
        id: orders.id,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        mpPaymentId: orders.mpPaymentId,
        subtotal: orders.subtotal,
        discount: orders.discount,
        total: orders.total,
        coupon: orders.coupon,
        createdAt: orders.createdAt,
        userId: orders.userId,
        userName: users.name,
        userEmail: users.email,
      })
      .from(orders)
      .innerJoin(users, eq(orders.userId, users.id))
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    if (status) {
      query = query.where(eq(orders.status, status as any)) as any;
    }

    const adminOrders = await query.all();

    // Para cada pedido, buscar itens
    const ordersWithItems = await Promise.all(
      adminOrders.map(async (order) => {
        const items = await db
          .select({
            id: orderItems.id,
            quantity: orderItems.quantity,
            unitPrice: orderItems.unitPrice,
            productTitle: products.title,
            productSlug: products.slug,
          })
          .from(orderItems)
          .innerJoin(products, eq(orderItems.productId, products.id))
          .where(eq(orderItems.orderId, order.id))
          .all();

        return { ...order, items };
      })
    );

    // Contar total para paginação
    const totalResult = await db
      .select({ count: orders.id })
      .from(orders)
      .all();

    return NextResponse.json({
      orders: ordersWithItems,
      pagination: {
        page,
        limit,
        total: totalResult.length,
        totalPages: Math.ceil(totalResult.length / limit),
      },
    });
  } catch (error) {
    console.error("Erro ao listar pedidos admin:", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

// Atualizar status de pedido
export async function PATCH(request: NextRequest) {
  try {
    await initDatabase();
    const db = getDb();

    const token = request.cookies.get("fd-session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const user = await validateSession(token);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const body = await request.json();
    const { orderId, status } = body;

    if (!orderId || !status) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const validStatuses = ["pending", "approved", "rejected", "refunded"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }

    await db
      .update(orders)
      .set({
        status: status as any,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(orders.id, orderId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao atualizar pedido:", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}