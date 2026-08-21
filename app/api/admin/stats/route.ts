import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lte, sql, count } from "drizzle-orm";
import { getDb } from "../../../../db/index";
import { users, orders, orderItems, products } from "../../../../db/schema";
import { validateSession } from "../../../../lib/auth";
import { initDatabase } from "../../../../db/init";

export async function GET(request: NextRequest) {
  try {
    await initDatabase();
    const db = getDb();

    // Autenticação
    const token = request.cookies.get("fd-session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const user = await validateSession(token);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    // Parâmetros de filtro (período)
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Filtro base para pedidos
    let orderFilter = eq(orders.status, "approved");
    if (startDate && endDate) {
      orderFilter = and(
        eq(orders.status, "approved"),
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate)
      ) as any;
    }

    // Estatísticas gerais
    const [
      totalUsers,
      totalOrders,
      revenueResult,
      pendingOrders,
      refundedOrders,
      totalProducts,
    ] = await Promise.all([
      // Total de usuários
      db.select({ count: count() }).from(users).get(),

      // Total de pedidos aprovados
      db.select({ count: count() }).from(orders).where(orderFilter).get(),

      // Faturamento total
      db
        .select({ total: sql<number>`COALESCE(SUM(${orders.total}), 0)` })
        .from(orders)
        .where(orderFilter)
        .get(),

      // Pedidos pendentes
      db
        .select({ count: count() })
        .from(orders)
        .where(eq(orders.status, "pending"))
        .get(),

      // Pedidos reembolsados
      db
        .select({ count: count() })
        .from(orders)
        .where(eq(orders.status, "refunded"))
        .get(),

      // Total de produtos
      db.select({ count: count() }).from(products).get(),
    ]);

    // Top 10 produtos mais vendidos
    const topProducts = await db
      .select({
        title: products.title,
        slug: products.slug,
        quantity: sql<number>`SUM(${orderItems.quantity})`,
        revenue: sql<number>`SUM(${orderItems.quantity} * ${orderItems.unitPrice})`,
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(orderFilter)
      .groupBy(products.id, products.title, products.slug)
      .orderBy(sql`SUM(${orderItems.quantity}) DESC`)
      .limit(10)
      .all();

    // Vendas por dia (últimos 30 dias se não houver filtro)
    const daysBack = 30;
    const today = new Date();
    const daysAgo = new Date();
    daysAgo.setDate(today.getDate() - daysBack);

    const startDateFilter = startDate || daysAgo.toISOString();
    const endDateFilter = endDate || today.toISOString();

    const salesByDay = await db
      .select({
        date: sql<string>`DATE(${orders.createdAt})`,
        count: count(),
        revenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.status, "approved"),
          gte(orders.createdAt, startDateFilter),
          lte(orders.createdAt, endDateFilter)
        )
      )
      .groupBy(sql`DATE(${orders.createdAt})`)
      .orderBy(sql`DATE(${orders.createdAt})`)
      .all();

    // Novos cadastros por dia (últimos 30 dias)
    const signupsByDay = await db
      .select({
        date: sql<string>`DATE(${users.createdAt})`,
        count: count(),
      })
      .from(users)
      .where(
        and(
          gte(users.createdAt, startDateFilter),
          lte(users.createdAt, endDateFilter)
        )
      )
      .groupBy(sql`DATE(${users.createdAt})`)
      .orderBy(sql`DATE(${users.createdAt})`)
      .all();

    // Vendas por método de pagamento
    const salesByMethod = await db
      .select({
        method: orders.paymentMethod,
        count: count(),
        revenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
      })
      .from(orders)
      .where(orderFilter)
      .groupBy(orders.paymentMethod)
      .all();

    return NextResponse.json({
      summary: {
        totalUsers: totalUsers?.count || 0,
        totalOrders: totalOrders?.count || 0,
        totalRevenue: revenueResult?.total || 0,
        pendingOrders: pendingOrders?.count || 0,
        refundedOrders: refundedOrders?.count || 0,
        totalProducts: totalProducts?.count || 0,
        averageTicket:
          totalOrders?.count && revenueResult?.total
            ? Number(revenueResult.total) / totalOrders.count
            : 0,
      },
      topProducts,
      salesByDay,
      signupsByDay,
      salesByMethod,
      period: { startDate: startDateFilter, endDate: endDateFilter },
    });
  } catch (error) {
    console.error("Erro ao buscar estatísticas:", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}