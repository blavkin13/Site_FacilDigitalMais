import type {
  NextRequest,
} from "next/server";

import {
  eq,
} from "drizzle-orm";

import {
  getDb,
  getSqliteConnection,
} from "../../../../db/index";

import {
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
  getSessionToken,
  privateNoStoreJson,
} from "../../../../lib/session-cookie";


type RouteContext = {
  params:
    Promise<{
      id:
        string;
    }>;
};


type QuestionStateRow = {
  total:
    number;

  activeTotal:
    number;
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
      return privateNoStoreJson(
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
      getSessionToken(
        request
      );


    if (
      !sessionToken
    ) {
      return privateNoStoreJson(
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
      return privateNoStoreJson(
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
        return privateNoStoreJson(
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


      return privateNoStoreJson(
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
          eq(
            simulations.id,
            simulationId
          )
        )
        .get();


    if (
      !simulation
    ) {
      return privateNoStoreJson(
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


    const sqlite =
      getSqliteConnection();


    /**
     * O endpoint pré-prova precisa saber apenas
     * quantas questões existem.
     *
     * Não carregamos:
     *
     * - enunciado;
     * - alternativas;
     * - gabarito;
     * - explicação.
     *
     * As questões somente serão liberadas depois
     * que POST /attempts iniciar o relógio oficial.
     */
    const questionState =
      sqlite
        .prepare(`
          SELECT
            COUNT(*) AS total,
            COALESCE(
              SUM(
                CASE
                  WHEN q.active = 1
                    THEN 1
                  ELSE 0
                END
              ),
              0
            ) AS activeTotal
          FROM simulation_questions sq
          INNER JOIN questions q
            ON q.id = sq.question_id
          WHERE
            sq.simulation_id = ?
        `)
        .get(
          simulationId
        ) as
        | QuestionStateRow
        | undefined;


    const totalQuestions =
      Number(
        questionState
          ?.total ??
        0
      );


    const activeTotal =
      Number(
        questionState
          ?.activeTotal ??
        0
      );


    if (
      totalQuestions <=
        0 ||
      activeTotal !==
        totalQuestions
    ) {
      return privateNoStoreJson(
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


    /**
     * PRINCÍPIO DE MENOR PRIVILÉGIO
     *
     * Antes de iniciar a tentativa, o browser
     * recebe somente os metadados necessários
     * para apresentar a tela inicial.
     *
     * Não devolvemos questions nem userHistory.
     */
    return privateNoStoreJson({
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

        totalQuestions,
      },
    });
  } catch (
    error
  ) {
    console.error(
      "Erro ao buscar simulado:",
      error
    );


    return privateNoStoreJson(
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