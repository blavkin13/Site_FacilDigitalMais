import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "../../../../db/index.js";
import { simulations, questions, orders, simulationResults } from "../../../../db/schema.js";
import { validateSession } from "../../../../lib/auth.js";
import { initDatabase } from "../../../../db/init.js";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDatabase();
    const db = getDb();

    const { id } = await params;
    const simulationId = parseInt(id);

    if (isNaN(simulationId)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }

    const token = request.cookies.get("fd-session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const user = await validateSession(token);
    if (!user) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    // Verificar acesso
    const userOrders = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.userId, user.id))
      .limit(1)
      .all();

    if (userOrders.length === 0) {
      return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    }

    // Buscar simulado
    const sim = await db
      .select()
      .from(simulations)
      .where(eq(simulations.id, simulationId))
      .get();

    if (!sim || !sim.active) {
      return NextResponse.json({ error: "Simulado não encontrado." }, { status: 404 });
    }

    // Parse dos IDs de questões
    let questionIds: number[] = [];
    try {
      questionIds = JSON.parse(sim.questionIds);
    } catch {
      questionIds = [];
    }

    // Buscar questões (sem a resposta correta para o aluno!)
    const allQuestions = await db
      .select({
        id: questions.id,
        subject: questions.subject,
        questionText: questions.questionText,
        options: questions.options,
        difficulty: questions.difficulty,
      })
      .from(questions)
      .all();

    const simQuestions = allQuestions
      .filter((q) => questionIds.includes(q.id))
      .map((q) => ({
        ...q,
        options: JSON.parse(q.options),
      }));

    // Buscar histórico do usuário neste simulado
    const userResults = await db
      .select({
        id: simulationResults.id,
        score: simulationResults.score,
        totalQuestions: simulationResults.totalQuestions,
        timeSpent: simulationResults.timeSpent,
        completedAt: simulationResults.completedAt,
      })
      .from(simulationResults)
      .where(
        and(
          eq(simulationResults.simulationId, simulationId),
          eq(simulationResults.userId, user.id)
        )
      )
      .all();

    return NextResponse.json({
      simulation: {
        id: sim.id,
        title: sim.title,
        bank: sim.bank,
        description: sim.description,
        timeLimit: sim.timeLimit,
        totalQuestions: simQuestions.length,
      },
      questions: simQuestions,
      userHistory: userResults,
    });
  } catch (error) {
    console.error("Erro ao buscar simulado:", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}