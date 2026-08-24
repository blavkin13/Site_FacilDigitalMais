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
  getLatestSimulationResultForUser,
} from "../../../../../../lib/simulation-results";


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
) {
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
            "Simulado inválido.",
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


    const data =
      await getLatestSimulationResultForUser(
        user.id,
        simulationId
      );


    if (
      !data
    ) {
      return NextResponse.json(
        {
          error:
            "Nenhum resultado encontrado.",
        },
        {
          status:
            404,
        }
      );
    }


    return NextResponse.json(
      data,
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
      "Erro ao consultar último resultado:",
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