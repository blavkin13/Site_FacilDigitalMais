import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "../../../db/index";
import { simulations, orders, users } from "../../../db/schema";
import { validateSession } from "../../../lib/auth";
import { initDatabase } from "../../../db/init";

// GET /api/simulations — Listar simulados disponíveis
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

    // Verificar se o usuário tem pelo menos 1 compra
    const userOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.userId, user.id))
      .limit(1)
      .all();

    const hasAccess = userOrders.length > 0;

    if (!hasAccess) {
      return NextResponse.json({
        hasAccess: false,
        message: "Você precisa adquirir pelo menos 1 apostila para acessar os simulados.",
        banks: [],
        simulations: [],
      });
    }

    // Buscar todos os simulados ativos
    const allSimulations = await db
      .select({
        id: simulations.id,
        title: simulations.title,
        bank: simulations.bank,
        description: simulations.description,
        timeLimit: simulations.timeLimit,
        active: simulations.active,
      })
      .from(simulations)
      .where(eq(simulations.active, true))
      .all();

    // Agrupar por banca
    const banksMap = new Map<string, { name: string; count: number }>();
    for (const sim of allSimulations) {
      const existing = banksMap.get(sim.bank);
      if (existing) {
        existing.count += 1;
      } else {
        banksMap.set(sim.bank, { name: sim.bank, count: 1 });
      }
    }

    return NextResponse.json({
      hasAccess: true,
      banks: Array.from(banksMap.values()),
      simulations: allSimulations,
    });
  } catch (error) {
    console.error("Erro ao listar simulados:", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}