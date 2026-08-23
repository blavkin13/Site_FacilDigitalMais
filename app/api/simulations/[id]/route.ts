import type {
  NextRequest,
} from "next/server";

import {
  NextResponse,
} from "next/server";

import {
  and,
  desc,
  eq,
} from "drizzle-orm";

import {
  getDb,
} from "../../../../db/index";

import {
  simulationResults,
  simulations,
} from "../../../../db/schema";

import {
  initDatabase,
} from "../../../../db/init";

import {
  validateSession,
} from "../../../../lib/auth";

import {
  resolveSimulationAccess,
} from "../../../../lib/simulation-access";

import {
  getSimulationQuestionRows,
  parseSimulationQuestionOptions,
} from "../../../../lib/simulation-repository";


type RouteContext = {
  params:
    Promise<{
      id:
        string;
    }>;
};


function parseSimulationId(
  value:
    string
): number | null {
  if (
    !/^\d+$/.test(
      value
    )
  ) {
    return null;
  }

  const parsed =
    Number(
      value
    );

  return (
    Number.isInteger(
      parsed
    ) &&
    parsed >
      0
  )
    ? parsed
    : null;
}


export async function GET(
  request:
    NextRequest,
  context:
    RouteContext
) {
  try {
    await initDatabase();

    const params =
      await context.params;

    const simulationId =
      parseSimulationId(
        params.id
      );

    if (
      simulationId ===
      null
    ) {
      return NextResponse.json(
        {
          error:
            "ID inválido.",
        },
        {
          status:
            400,
        }
      );
    }

    const token =
      request.cookies.get(
        "fd-session"
      )?.value;

    if (
      !token
    ) {
      return NextResponse.json(
        {
          error:
            "Não autenticado.",
        },
        {
          status:
            401,
        }
      );
    }

    const user =
      await validateSession(
        token
      );

    if (
      !user
    ) {
      return NextResponse.json(
        {
          error:
            "Sessão inválida.",
        },
        {
          status:
            401,
        }
      );
    }

    const access =
      await resolveSimulationAccess(
        user.id,
        simulationId
      );

    if (
      !access.allowed
    ) {
      if (
        access.reason ===
          "simulation_not_found" ||
        access.reason ===
          "simulation_inactive"
      ) {
        return NextResponse.json(
          {
            error:
              "Simulado não encontrado.",
          },
          {
            status:
              404,
          }
        );
      }

      return NextResponse.json(
        {
          error:
            "Você não possui acesso a este simulado.",
        },
        {
          status:
            403,
        }
      );
    }

    const db =
      getDb();

    const simulation =
      await db
        .select()
        .from(
          simulations
        )
        .where(
          eq(
            simulations.id,
            simulationId
          )
        )
        .get();

    if (
      !simulation
    ) {
      return NextResponse.json(
        {
          error:
            "Simulado não encontrado.",
        },
        {
          status:
            404,
        }
      );
    }

    const questionRows =
      await getSimulationQuestionRows(
        simulationId
      );

    if (
      questionRows.some(
        (
          question
        ) =>
          question.active !==
          true
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Este simulado está temporariamente indisponível.",
        },
        {
          status:
            409,
        }
      );
    }

    const publicQuestions =
      questionRows.map(
        (
          question
        ) => ({
          id:
            question.id,

          subject:
            question.subject,

          questionText:
            question.questionText,

          options:
            parseSimulationQuestionOptions(
              question.options
            ),

          difficulty:
            question.difficulty,
        })
      );

    const userResults =
      await db
        .select({
          id:
            simulationResults.id,

          score:
            simulationResults.score,

          totalQuestions:
            simulationResults.totalQuestions,

          timeSpent:
            simulationResults.timeSpent,

          completedAt:
            simulationResults.completedAt,
        })
        .from(
          simulationResults
        )
        .where(
          and(
            eq(
              simulationResults.simulationId,
              simulationId
            ),

            eq(
              simulationResults.userId,
              user.id
            )
          )
        )
        .orderBy(
          desc(
            simulationResults.completedAt
          )
        )
        .all();

    return NextResponse.json(
      {
        simulation: {
          id:
            simulation.id,

          title:
            simulation.title,

          bank:
            simulation.bank,

          description:
            simulation.description,

          timeLimit:
            simulation.timeLimit,

          totalQuestions:
            publicQuestions.length,
        },

        /**
         * Não contém:
         *
         * correctAnswer
         * explanation
         */
        questions:
          publicQuestions,

        userHistory:
          userResults,
      },
      {
        headers: {
          "Cache-Control":
            "private, no-store",
        },
      }
    );
  } catch (
    error
  ) {
    console.error(
      "Erro ao buscar simulado:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Erro interno.",
      },
      {
        status:
          500,
      }
    );
  }
}