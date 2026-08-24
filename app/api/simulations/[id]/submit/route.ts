import type {
  NextRequest,
} from "next/server";

import {
  initDatabase,
} from "../../../../../db/init";

import {
  validateSession,
} from "../../../../../lib/auth";

import {
  finalizeSimulationAttempt,
  type FinalizeAttemptDecision,
} from "../../../../../lib/simulation-attempt-submit";

import {
  getSessionToken,
  privateNoStoreJson,
} from "../../../../../lib/session-cookie";


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
    return privateNoStoreJson(
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
    return privateNoStoreJson(
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
    return privateNoStoreJson(
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
    return privateNoStoreJson(
      body,
      {
        status:
          403,
      }
    );
  }


  return privateNoStoreJson(
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
      return privateNoStoreJson(
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


    let body:
      unknown;


    try {
      body =
        await request.json();
    } catch {
      return privateNoStoreJson(
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
     * PRINCÍPIO DE MENOR PRIVILÉGIO
     *
     * O POST apenas confirma que a operação foi
     * concluída e fornece a chave do resultado.
     *
     * Não duplicamos nesta resposta:
     *
     * - gabarito;
     * - explicações;
     * - snapshot;
     * - ranking;
     * - dados de outros alunos.
     *
     * O browser seguirá para o endpoint owner-only
     * GET /results/{resultId}.
     */
    return privateNoStoreJson({
      success:
        true,

      result: {
        id:
          decision
            .result
            .id,
      },
    });
  } catch (
    error
  ) {
    console.error(
      "Erro ao submeter simulado:",
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