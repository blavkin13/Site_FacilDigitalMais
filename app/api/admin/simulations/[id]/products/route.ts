import type {
  NextRequest,
} from "next/server";

import {
  NextResponse,
} from "next/server";

import {
  eq,
} from "drizzle-orm";

import {
  getDb,
} from "../../../../../../db/index";

import {
  simulations,
} from "../../../../../../db/schema";

import {
  authorizeAdminRequest,
} from "../../../../../../lib/admin-auth";

import {
  AdminSimulationValidationError,
  validateAdminRelationIdsBody,
  validateAdminSimulationId,
} from "../../../../../../lib/admin-simulation-validation";

import {
  findMissingProductIds,
  getSimulationProductIds,
  getSimulationPublicationContext,
  replaceSimulationProductIds,
} from "../../../../../../lib/simulation-repository";

import {
  getSimulationPublicationIssues,
} from "../../../../../../lib/simulation-publication";


type RouteContext = {
  params:
    Promise<{
      id:
        string;
    }>;
};


function validationErrorResponse(
  error:
    AdminSimulationValidationError
) {
  return NextResponse.json(
    {
      error:
        error.message,

      field:
        error.field,
    },
    {
      status:
        400,
    }
  );
}


async function getSimulationId(
  context:
    RouteContext
) {
  const params =
    await context.params;

  return validateAdminSimulationId(
    params.id
  );
}


async function readJsonBody(
  request:
    NextRequest
) {
  try {
    return await request.json();
  } catch {
    throw new AdminSimulationValidationError(
      "Corpo JSON inválido."
    );
  }
}


export async function GET(
  request:
    NextRequest,
  context:
    RouteContext
) {
  try {
    const authorization =
      await authorizeAdminRequest(
        request
      );

    if (
      !authorization.ok
    ) {
      return authorization.response;
    }

    const simulationId =
      await getSimulationId(
        context
      );

    const db =
      getDb();

    const simulation =
      await db
        .select({
          id:
            simulations.id,
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

    return NextResponse.json({
      simulationId,

      productIds:
        await getSimulationProductIds(
          simulationId
        ),
    });
  } catch (
    error
  ) {
    if (
      error instanceof
      AdminSimulationValidationError
    ) {
      return validationErrorResponse(
        error
      );
    }

    console.error(
      "Erro ao consultar produtos do simulado:",
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


export async function PUT(
  request:
    NextRequest,
  context:
    RouteContext
) {
  try {
    const authorization =
      await authorizeAdminRequest(
        request
      );

    if (
      !authorization.ok
    ) {
      return authorization.response;
    }

    const simulationId =
      await getSimulationId(
        context
      );

    const body =
      await readJsonBody(
        request
      );

    const productIds =
      validateAdminRelationIdsBody(
        body,
        "productIds"
      );

    const db =
      getDb();

    const simulation =
      await db
        .select()
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

    const missingProductIds =
      await findMissingProductIds(
        productIds
      );

    if (
      missingProductIds.length >
      0
    ) {
      return NextResponse.json(
        {
          error:
            "Uma ou mais apostilas informadas não existem.",

          field:
            "productIds",

          missingProductIds,
        },
        {
          status:
            400,
        }
      );
    }

    if (
      simulation.active ===
      true
    ) {
      const publicationContext =
        await getSimulationPublicationContext(
          simulationId,
          {
            productIds,
          }
        );

      if (
        !publicationContext
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

      const issues =
        getSimulationPublicationIssues(
          publicationContext
        );

      if (
        issues.length >
        0
      ) {
        return NextResponse.json(
          {
            error:
              "A alteração deixaria o simulado publicado em estado inválido.",

            issues,
          },
          {
            status:
              409,
          }
        );
      }
    }

    await replaceSimulationProductIds(
      simulationId,
      productIds
    );

    await db
      .update(
        simulations
      )
      .set({
        updatedAt:
          new Date()
            .toISOString(),
      })
      .where(
        eq(
          simulations.id,
          simulationId
        )
      );

    return NextResponse.json({
      success:
        true,

      simulationId,

      productIds:
        await getSimulationProductIds(
          simulationId
        ),
    });
  } catch (
    error
  ) {
    if (
      error instanceof
      AdminSimulationValidationError
    ) {
      return validationErrorResponse(
        error
      );
    }

    console.error(
      "Erro ao atualizar produtos do simulado:",
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