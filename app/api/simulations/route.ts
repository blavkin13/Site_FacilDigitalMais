import type {
  NextRequest,
} from "next/server";

import {
  NextResponse,
} from "next/server";

import {
  asc,
  eq,
  inArray,
} from "drizzle-orm";

import {
  getDb,
} from "../../../db/index";

import {
  simulations,
} from "../../../db/schema";

import {
  initDatabase,
} from "../../../db/init";

import {
  validateSession,
} from "../../../lib/auth";

import {
  getAccessibleSimulationIdsForUser,
} from "../../../lib/simulation-access";


export async function GET(
  request:
    NextRequest
) {
  try {
    await initDatabase();

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

    const accessibleIds =
      await getAccessibleSimulationIdsForUser(
        user.id
      );

    if (
      accessibleIds.length ===
      0
    ) {
      return NextResponse.json(
        {
          hasAccess:
            false,

          message:
            "Nenhum simulado está disponível para as suas apostilas com pagamento aprovado.",

          banks:
            [],

          simulations:
            [],
        },
        {
          headers: {
            "Cache-Control":
              "private, no-store",
          },
        }
      );
    }

    const db =
      getDb();

    const availableSimulations =
      await db
        .select({
          id:
            simulations.id,

          title:
            simulations.title,

          bank:
            simulations.bank,

          description:
            simulations.description,

          timeLimit:
            simulations.timeLimit,
        })
        .from(
          simulations
        )
        .where(
          inArray(
            simulations.id,
            accessibleIds
          )
        )
        .orderBy(
          asc(
            simulations.bank
          ),
          asc(
            simulations.title
          )
        )
        .all();

    const banksMap =
      new Map<
        string,
        {
          name:
            string;

          count:
            number;
        }
      >();

    for (
      const simulation of
        availableSimulations
    ) {
      const existing =
        banksMap.get(
          simulation.bank
        );

      if (
        existing
      ) {
        existing.count +=
          1;
      } else {
        banksMap.set(
          simulation.bank,
          {
            name:
              simulation.bank,

            count:
              1,
          }
        );
      }
    }

    return NextResponse.json(
      {
        hasAccess:
          true,

        banks:
          Array.from(
            banksMap.values()
          ),

        simulations:
          availableSimulations,
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
      "Erro ao listar simulados:",
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