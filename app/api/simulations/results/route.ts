import type {
  NextRequest,
} from "next/server";

import {
  NextResponse,
} from "next/server";

import {
  initDatabase,
} from "../../../../db/init";

import {
  validateSession,
} from "../../../../lib/auth";

import {
  listSimulationResultsForUser,
} from "../../../../lib/simulation-results";


export async function GET(
  request:
    NextRequest
) {
  try {
    await initDatabase();


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


    const results =
      await listSimulationResultsForUser(
        user.id
      );


    return NextResponse.json(
      {
        results,

        total:
          results.length,
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
      "Erro ao consultar histórico de simulados:",
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