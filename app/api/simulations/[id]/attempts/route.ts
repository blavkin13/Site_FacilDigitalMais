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
  startOrResumeSimulationAttempt,
  type StartSimulationAttemptReason,
} from "../../../../../lib/simulation-attempts";


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

  const id =
    Number(
      value
    );

  return (
    Number.isInteger(
      id
    ) &&
    id >
      0
  )
    ? id
    : null;
}


function denialResponse(
  reason:
    StartSimulationAttemptReason
) {
  if (
    reason ===
    "invalid_input"
  ) {
    return NextResponse.json(
      {
        error:
          "Dados da tentativa inválidos.",
      },
      {
        status:
          400,
      }
    );
  }


  if (
    reason ===
      "simulation_not_found" ||
    reason ===
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


  if (
    reason ===
      "no_related_product" ||
    reason ===
      "no_approved_purchase"
  ) {
    return NextResponse.json(
      {
        error:
          "Você não possui acesso para iniciar este simulado.",
      },
      {
        status:
          403,
      }
    );
  }


  return NextResponse.json(
    {
      error:
        "O simulado não está disponível para iniciar uma tentativa.",
    },
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


    const decision =
      await startOrResumeSimulationAttempt(
        user.id,
        simulationId
      );


    if (
      !decision.ok
    ) {
      return denialResponse(
        decision.reason
      );
    }


    return NextResponse.json(
      {
        resumed:
          decision.resumed,

        attempt:
          decision.attempt,
      },
      {
        status:
          decision.resumed
            ? 200
            : 201,

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
      "Erro ao iniciar tentativa:",
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