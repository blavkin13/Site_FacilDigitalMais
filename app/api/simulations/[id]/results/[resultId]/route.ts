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
  getSimulationResultForUser,
} from "../../../../../../lib/simulation-results";


type RouteContext = {
  params:
    Promise<{
      id:
        string;

      resultId:
        string;
    }>;
};


function parseId(
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
      parseId(
        params.id
      );


    const resultId =
      parseId(
        params.resultId
      );


    if (
      simulationId ===
        null ||
      resultId ===
        null
    ) {
      return NextResponse.json(
        {
          error:
            "Resultado inválido.",
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
      await getSimulationResultForUser(
        user.id,
        simulationId,
        resultId
      );


    /**
     * 404 também para resultado pertencente a
     * outro usuário.
     *
     * Não revelamos a existência de recurso
     * horizontalmente inacessível.
     */
    if (
      !data
    ) {
      return NextResponse.json(
        {
          error:
            "Resultado não encontrado.",
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
      "Erro ao consultar resultado:",
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