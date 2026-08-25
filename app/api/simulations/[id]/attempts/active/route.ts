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
  getActiveSimulationAttemptForUser,
} from "../../../../../../lib/simulation-attempts";


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
            "Simulado inválido.",
        },
        {
          status:
            400,

          headers: {
            "Cache-Control":
              "private, no-store",
          },
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

          headers: {
            "Cache-Control":
              "private, no-store",
          },
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

          headers: {
            "Cache-Control":
              "private, no-store",
          },
        }
      );
    }


    const decision =
      await getActiveSimulationAttemptForUser(
        user.id,
        simulationId
      );


    if (
      !decision.ok
    ) {
      if (
        decision.reason ===
        "attempt_not_found"
      ) {
        return NextResponse.json(
          {
            error:
              "Nenhuma tentativa em andamento.",
          },
          {
            status:
              404,

            headers: {
              "Cache-Control":
                "private, no-store",
            },
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
          {
            error:
              "O acesso à tentativa foi revogado.",

            reason:
              "attempt_revoked",
          },
          {
            status:
              403,

            headers: {
              "Cache-Control":
                "private, no-store",
            },
          }
        );
      }


      if (
        decision.reason ===
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

            headers: {
              "Cache-Control":
                "private, no-store",
            },
          }
        );
      }


      return NextResponse.json(
        {
          error:
            "A tentativa não pode ser retomada.",

          reason:
            decision.reason,
        },
        {
          status:
            decision.reason ===
              "attempt_expired"
              ? 410
              : 409,

          headers: {
            "Cache-Control":
              "private, no-store",
          },
        }
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
      "Erro ao procurar tentativa ativa:",
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

        headers: {
          "Cache-Control":
            "private, no-store",
        },
      }
    );
  }
}