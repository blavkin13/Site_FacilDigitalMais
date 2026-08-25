import type {
  NextRequest,
} from "next/server";

import {
  NextResponse,
} from "next/server";

import {
  initDatabase,
} from "../../../../../../db/init";

import {
  validateSession,
} from "../../../../../../lib/auth";

import {
  resolveSimulationAttemptForUser,
  type ResolveSimulationAttemptReason,
} from "../../../../../../lib/simulation-attempts";


type RouteContext = {
  params:
    Promise<{
      id:
        string;

      token:
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
    ResolveSimulationAttemptReason
) {
  if (
    reason ===
    "invalid_input"
  ) {
    return NextResponse.json(
      {
        error:
          "Tentativa inválida.",
      },
      {
        status:
          400,
      }
    );
  }


  if (
    reason ===
    "attempt_not_found"
  ) {
    return NextResponse.json(
      {
        error:
          "Tentativa não encontrada.",
      },
      {
        status:
          404,
      }
    );
  }


  if (
    reason ===
    "attempt_expired"
  ) {
    return NextResponse.json(
      {
        error:
          "O tempo desta tentativa terminou.",

        reason:
          "attempt_expired",
      },
      {
        status:
          410,
      }
    );
  }


  if (
    reason ===
      "attempt_revoked" ||
    reason ===
      "access_revoked"
  ) {
    return NextResponse.json(
      {
        error:
          "O acesso a esta tentativa foi revogado.",

        reason:
          "attempt_revoked",
      },
      {
        status:
          403,
      }
    );
  }


  if (
    reason ===
    "attempt_completed"
  ) {
    return NextResponse.json(
      {
        error:
          "Esta tentativa já foi finalizada.",

        reason:
          "attempt_completed",
      },
      {
        status:
          409,
      }
    );
  }


  return NextResponse.json(
    {
      error:
        "Esta tentativa não pode ser retomada.",
    },
    {
      status:
        409,
    }
  );
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


    const decision =
      await resolveSimulationAttemptForUser(
        user.id,
        simulationId,
        params.token
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
        attempt:
          decision.attempt,
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
      "Erro ao consultar tentativa:",
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