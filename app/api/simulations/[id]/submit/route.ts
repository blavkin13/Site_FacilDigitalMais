import type {
  NextRequest,
} from "next/server";

import {
  NextResponse,
} from "next/server";

import {
  initDatabase,
} from "../../../../../db/init";

import {
  validateSession,
} from "../../../../../lib/auth";

import {
  finalizeSimulationAttempt,
  getSimulationRanking,
  type FinalizeAttemptDecision,
} from "../../../../../lib/simulation-attempt-submit";


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

function failureResponse(
  decision:
    Extract<
      FinalizeAttemptDecision,
      {
        ok:
          false;
      }
    >
) {
  const body = {
    error:
      decision.message,

    reason:
      decision.reason,
  };


  if (
    decision.reason ===
      "invalid_input" ||
    decision.reason ===
      "answers_invalid"
  ) {
    return NextResponse.json(
      body,
      {
        status:
          400,
      }
    );
  }


  if (
    decision.reason ===
    "attempt_not_found"
  ) {
    return NextResponse.json(
      body,
      {
        status:
          404,
      }
    );
  }


  if (
    decision.reason ===
    "attempt_expired"
  ) {
    return NextResponse.json(
      body,
      {
        status:
          410,
      }
    );
  }


  if (
    decision.reason ===
      "attempt_revoked" ||
    decision.reason ===
      "access_revoked"
  ) {
    return NextResponse.json(
      body,
      {
        status:
          403,
      }
    );
  }


  return NextResponse.json(
    body,
    {
      status:
        409,
    }
  );
}

export async function POST(
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

          reason:
            "invalid_input",
        },
        {
          status:
            400,
        }
      );
    }


    const sessionToken =
      request.cookies.get(
        "fd-session"
      )?.value;


    if (
      !sessionToken
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
        sessionToken
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


    let body:
      unknown;


    try {
      body =
        await request.json();
    } catch {
      return NextResponse.json(
        {
          error:
            "Corpo JSON inválido.",

          reason:
            "invalid_input",
        },
        {
          status:
            400,
        }
      );
    }


    const decision =
      await finalizeSimulationAttempt(
        user.id,
        simulationId,
        body
      );


    if (
      !decision.ok
    ) {
      return failureResponse(
        decision
      );
    }


    /**
     * O resultado já foi persistido e a tentativa
     * marcada como completed dentro de uma única
     * transação SQLite.
     *
     * Ranking é calculado somente depois do commit.
     */
    const rankingData =
      await getSimulationRanking(
        simulationId,
        user.id
      );


    return NextResponse.json(
      {
        result: {
          id:
            decision.result.id,

          score:
            decision.result.score,

          totalQuestions:
            decision
              .result
              .totalQuestions,

          timeSpent:
            decision
              .result
              .timeSpent,

          completedAt:
            decision
              .result
              .completedAt,
        },

        score:
          decision.result.score,

        totalQuestions:
          decision
            .result
            .totalQuestions,

        /**
         * Tempo calculado exclusivamente
         * pelo servidor.
         */
        timeSpent:
          decision
            .result
            .timeSpent,

        percentage:
          decision
            .result
            .percentage,

        /**
         * Gabarito somente depois da conclusão.
         */
        detailedAnswers:
          decision
            .result
            .detailedAnswers,

        ranking:
          rankingData.ranking,

        userPosition:
          rankingData.userPosition,

        totalParticipants:
          rankingData.totalParticipants,
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
      "Erro ao submeter simulado:",
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