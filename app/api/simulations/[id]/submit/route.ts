import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "../../../../../db/index";
import { simulations, questions, orders, simulationResults, users } from "../../../../../db/schema";
import { validateSession } from "../../../../../lib/auth";
import { initDatabase } from "../../../../../db/init";

export async function POST(
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

    const body = await request.json();
    const { answers, timeSpent } = body;

    if (!answers || !Array.isArray(answers) || typeof timeSpent !== "number") {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    // Buscar simulado
    const sim = await db
      .select()
      .from(simulations)
      .where(eq(simulations.id, simulationId))
      .get();

    if (!sim) {
      return NextResponse.json({ error: "Simulado não encontrado." }, { status: 404 });
    }

    // Parse dos IDs das questões do simulado
    let questionIds: number[] = [];
    try {
      questionIds = JSON.parse(sim.questionIds);
    } catch {
      questionIds = [];
    }

    // Buscar todas as questões com as respostas corretas
    const allQuestions = await db
      .select({
        id: questions.id,
        correctAnswer: questions.correctAnswer,
        subject: questions.subject,
        questionText: questions.questionText,
        options: questions.options,
        explanation: questions.explanation,
      })
      .from(questions)
      .all();

    const questionMap = new Map(allQuestions.map((q) => [q.id, q]));

    // Calcular pontuação e gerar resultado detalhado
    let score = 0;
    const detailedAnswers = [];

    for (const answer of answers) {
      const question = questionMap.get(answer.questionId);
      if (!question) continue;

      const isCorrect = answer.selectedOption === question.correctAnswer;
      if (isCorrect) score++;

      detailedAnswers.push({
        questionId: answer.questionId,
        subject: question.subject,
        questionText: question.questionText,
        options: JSON.parse(question.options),
        selectedOption: answer.selectedOption,
        correctAnswer: question.correctAnswer,
        isCorrect,
        explanation: question.explanation,
      });
    }

    // Salvar resultado
    const result = await db
      .insert(simulationResults)
      .values({
        userId: user.id,
        simulationId,
        score,
        totalQuestions: detailedAnswers.length,
        timeSpent,
        answers: JSON.stringify(answers),
      })
      .returning();

    // Buscar ranking (top 20)
    const ranking = await db
      .select({
        userName: users.name,
        userEmail: users.email,
        score: simulationResults.score,
        totalQuestions: simulationResults.totalQuestions,
        timeSpent: simulationResults.timeSpent,
        completedAt: simulationResults.completedAt,
      })
      .from(simulationResults)
      .innerJoin(users, eq(simulationResults.userId, users.id))
      .where(eq(simulationResults.simulationId, simulationId))
      .all();

    // Ordenar: maior score primeiro, depois menor tempo
    const sortedRanking = ranking
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.timeSpent - b.timeSpent;
      })
      .slice(0, 20)
      .map((r, idx) => ({
        position: idx + 1,
        name: r.userName || r.userEmail.split("@")[0],
        score: r.score,
        totalQuestions: r.totalQuestions,
        timeSpent: r.timeSpent,
        completedAt: r.completedAt,
        isCurrentUser: r.userEmail === user.email,
      }));

    // Encontrar posição do usuário atual
    const userPosition = sortedRanking.findIndex((r) => r.isCurrentUser) + 1;

    return NextResponse.json({
      result: result[0],
      score,
      totalQuestions: detailedAnswers.length,
      timeSpent,
      percentage: Math.round((score / detailedAnswers.length) * 100),
      detailedAnswers,
      ranking: sortedRanking,
      userPosition,
    });
  } catch (error) {
    console.error("Erro ao submeter simulado:", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}