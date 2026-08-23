import type {
  NextRequest,
} from "next/server";

import {
  NextResponse,
} from "next/server";

import {
  desc,
  eq,
} from "drizzle-orm";

import {
  getDb,
} from "../../../../db/index";

import {
  simulations,
} from "../../../../db/schema";

import {
  authorizeAdminRequest,
} from "../../../../lib/admin-auth";

import {
  AdminSimulationValidationError,
  validateAdminSimulationCreate,
  validateAdminSimulationId,
  validateAdminSimulationPatch,
} from "../../../../lib/admin-simulation-validation";

import {
  getSimulationProductIds,
  getSimulationPublicationContext,
  getSimulationQuestionIds,
} from "../../../../lib/simulation-repository";

import {
  getSimulationPublicationIssues,
} from "../../../../lib/simulation-publication";


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


async function readJsonBody(
  request:
    NextRequest
): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AdminSimulationValidationError(
      "Corpo JSON inválido."
    );
  }
}


async function serializeSimulation(
  simulation:
    typeof simulations.$inferSelect
) {
  const [
    productIds,
    questionIds,
  ] =
    await Promise.all([
      getSimulationProductIds(
        simulation.id
      ),

      getSimulationQuestionIds(
        simulation.id
      ),
    ]);

  return {
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

    active:
      simulation.active ===
      true,

    publishedAt:
      simulation.publishedAt,

    createdAt:
      simulation.createdAt,

    updatedAt:
      simulation.updatedAt,

    productIds,

    questionIds,

    productCount:
      productIds.length,

    questionCount:
      questionIds.length,
  };
}


export async function GET(
  request:
    NextRequest
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

    const db =
      getDb();

    const rows =
      await db
        .select()
        .from(
          simulations
        )
        .orderBy(
          desc(
            simulations.updatedAt
          ),
          desc(
            simulations.id
          )
        )
        .all();

    const serialized =
      await Promise.all(
        rows.map(
          serializeSimulation
        )
      );

    return NextResponse.json({
      simulations:
        serialized,
    });
  } catch (
    error
  ) {
    console.error(
      "Erro ao listar simulados administrativos:",
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


export async function POST(
  request:
    NextRequest
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

    const body =
      await readJsonBody(
        request
      );

    const simulationData =
      validateAdminSimulationCreate(
        body
      );

    const db =
      getDb();

    const result =
      await db
        .insert(
          simulations
        )
        .values(
          simulationData
        )
        .returning();

    return NextResponse.json(
      {
        success:
          true,

        simulation:
          await serializeSimulation(
            result[0]
          ),
      },
      {
        status:
          201,
      }
    );
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
      "Erro ao criar simulado:",
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


export async function PATCH(
  request:
    NextRequest
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

    const body =
      await readJsonBody(
        request
      );

    const {
      id,
      updates,
    } =
      validateAdminSimulationPatch(
        body
      );

    const db =
      getDb();

    const existing =
      await db
        .select()
        .from(
          simulations
        )
        .where(
          eq(
            simulations.id,
            id
          )
        )
        .get();

    if (
      !existing
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

    const willRemainPublished =
      updates.active ===
      undefined
        ? existing.active ===
          true
        : updates.active ===
          true;

    if (
      willRemainPublished
    ) {
      const context =
        await getSimulationPublicationContext(
          id,
          {
            simulation:
              updates,
          }
        );

      if (
        !context
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
          context
        );

      if (
        issues.length >
        0
      ) {
        return NextResponse.json(
          {
            error:
              "O simulado ainda não está pronto para publicação.",

            issues,
          },
          {
            status:
              409,
          }
        );
      }
    }

    const now =
      new Date()
        .toISOString();

    const shouldRegisterFirstPublication =
      updates.active ===
        true &&
      !existing.publishedAt;

    const result =
      await db
        .update(
          simulations
        )
        .set({
          ...updates,

          ...(
            shouldRegisterFirstPublication
              ? {
                  publishedAt:
                    now,
                }
              : {}
          ),

          updatedAt:
            now,
        })
        .where(
          eq(
            simulations.id,
            id
          )
        )
        .returning();

    return NextResponse.json({
      success:
        true,

      simulation:
        await serializeSimulation(
          result[0]
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
      "Erro ao atualizar simulado:",
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


export async function DELETE(
  request:
    NextRequest
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

    const id =
      validateAdminSimulationId(
        request.nextUrl.searchParams.get(
          "id"
        )
      );

    const db =
      getDb();

    const existing =
      await db
        .select()
        .from(
          simulations
        )
        .where(
          eq(
            simulations.id,
            id
          )
        )
        .get();

    if (
      !existing
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

    const result =
      await db
        .update(
          simulations
        )
        .set({
          active:
            false,

          updatedAt:
            new Date()
              .toISOString(),
        })
        .where(
          eq(
            simulations.id,
            id
          )
        )
        .returning();

    return NextResponse.json({
      success:
        true,

      simulation:
        await serializeSimulation(
          result[0]
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
      "Erro ao arquivar simulado:",
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