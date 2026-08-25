import type {
  NextRequest,
} from "next/server";

import {
  NextResponse,
} from "next/server";

import {
  and,
  desc,
  eq,
  like,
  or,
} from "drizzle-orm";

import {
  getDb,
} from "../../../../db/index";

import {
  questions,
} from "../../../../db/schema";

import {
  authorizeAdminRequest,
} from "../../../../lib/admin-auth";

import {
  AdminQuestionValidationError,
  assertValidAdminQuestionState,
  parseStoredQuestionOptions,
  validateAdminQuestionCreate,
  validateAdminQuestionId,
  validateAdminQuestionPatch,
  type QuestionDifficulty,
} from "../../../../lib/admin-question-validation";

import {
  getActiveSimulationIdsUsingQuestion,
} from "../../../../lib/simulation-repository";


function validationErrorResponse(
  error:
    AdminQuestionValidationError
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
    throw new AdminQuestionValidationError(
      "Corpo JSON inválido."
    );
  }
}


function serializeQuestion(
  question:
    typeof questions.$inferSelect
) {
  return {
    ...question,

    active:
      question.active ===
      true,

    options:
      parseStoredQuestionOptions(
        question.options
      ),
  };
}


function parseDifficultyFilter(
  value:
    string | null
): QuestionDifficulty | undefined {
  if (
    value ===
      null ||
    value ===
      ""
  ) {
    return undefined;
  }

  if (
    value ===
      "easy" ||
    value ===
      "medium" ||
    value ===
      "hard"
  ) {
    return value;
  }

  throw new AdminQuestionValidationError(
    "Filtro de dificuldade inválido.",
    "difficulty"
  );
}


function parseActiveFilter(
  value:
    string | null
): boolean | undefined {
  if (
    value ===
      null ||
    value ===
      ""
  ) {
    return undefined;
  }

  if (
    value ===
      "true"
  ) {
    return true;
  }

  if (
    value ===
      "false"
  ) {
    return false;
  }

  throw new AdminQuestionValidationError(
    "Filtro active inválido.",
    "active"
  );
}


async function ensureQuestionCanBeArchived(
  questionId:
    number
) {
  const simulationIds =
    await getActiveSimulationIdsUsingQuestion(
      questionId
    );

  if (
    simulationIds.length >
    0
  ) {
    return NextResponse.json(
      {
        error:
          "A questão pertence a um simulado publicado e não pode ser arquivada.",

        simulationIds,
      },
      {
        status:
          409,
      }
    );
  }

  return null;
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

    const search =
      request.nextUrl.searchParams
        .get(
          "search"
        )
        ?.trim() ||
      undefined;

    const bank =
      request.nextUrl.searchParams
        .get(
          "bank"
        )
        ?.trim() ||
      undefined;

    const subject =
      request.nextUrl.searchParams
        .get(
          "subject"
        )
        ?.trim() ||
      undefined;

    const difficulty =
      parseDifficultyFilter(
        request.nextUrl.searchParams.get(
          "difficulty"
        )
      );

    const active =
      parseActiveFilter(
        request.nextUrl.searchParams.get(
          "active"
        )
      );

    const db =
      getDb();

    const rows =
      await db
        .select()
        .from(
          questions
        )
        .where(
          and(
            search
              ? or(
                  like(
                    questions.questionText,
                    `%${search}%`
                  ),
                  like(
                    questions.subject,
                    `%${search}%`
                  )
                )
              : undefined,

            bank
              ? eq(
                  questions.bank,
                  bank
                )
              : undefined,

            subject
              ? eq(
                  questions.subject,
                  subject
                )
              : undefined,

            difficulty
              ? eq(
                  questions.difficulty,
                  difficulty
                )
              : undefined,

            active ===
              undefined
              ? undefined
              : eq(
                  questions.active,
                  active
                )
          )
        )
        .orderBy(
          desc(
            questions.updatedAt
          ),
          desc(
            questions.id
          )
        )
        .all();

    return NextResponse.json({
      questions:
        rows.map(
          serializeQuestion
        ),
    });
  } catch (
    error
  ) {
    if (
      error instanceof
      AdminQuestionValidationError
    ) {
      return validationErrorResponse(
        error
      );
    }

    console.error(
      "Erro ao listar questões administrativas:",
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

    const questionData =
      validateAdminQuestionCreate(
        body
      );

    const db =
      getDb();

    const result =
      await db
        .insert(
          questions
        )
        .values(
          questionData
        )
        .returning();

    return NextResponse.json(
      {
        success:
          true,

        question:
          serializeQuestion(
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
      AdminQuestionValidationError
    ) {
      return validationErrorResponse(
        error
      );
    }

    console.error(
      "Erro ao criar questão:",
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
      validateAdminQuestionPatch(
        body
      );

    const db =
      getDb();

    const existing =
      await db
        .select()
        .from(
          questions
        )
        .where(
          eq(
            questions.id,
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
            "Questão não encontrada.",
        },
        {
          status:
            404,
        }
      );
    }

    const nextOptions =
      updates.options ??
      existing.options;

    const nextCorrectAnswer =
      updates.correctAnswer ??
      existing.correctAnswer;

    assertValidAdminQuestionState(
      nextOptions,
      nextCorrectAnswer
    );

    if (
      updates.active ===
      false
    ) {
      const blocked =
        await ensureQuestionCanBeArchived(
          id
        );

      if (
        blocked
      ) {
        return blocked;
      }
    }

    const result =
      await db
        .update(
          questions
        )
        .set({
          ...updates,

          updatedAt:
            new Date()
              .toISOString(),
        })
        .where(
          eq(
            questions.id,
            id
          )
        )
        .returning();

    return NextResponse.json({
      success:
        true,

      question:
        serializeQuestion(
          result[0]
        ),
    });
  } catch (
    error
  ) {
    if (
      error instanceof
      AdminQuestionValidationError
    ) {
      return validationErrorResponse(
        error
      );
    }

    console.error(
      "Erro ao atualizar questão:",
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
      validateAdminQuestionId(
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
          questions
        )
        .where(
          eq(
            questions.id,
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
            "Questão não encontrada.",
        },
        {
          status:
            404,
        }
      );
    }

    const blocked =
      await ensureQuestionCanBeArchived(
        id
      );

    if (
      blocked
    ) {
      return blocked;
    }

    const result =
      await db
        .update(
          questions
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
            questions.id,
            id
          )
        )
        .returning();

    return NextResponse.json({
      success:
        true,

      question:
        serializeQuestion(
          result[0]
        ),
    });
  } catch (
    error
  ) {
    if (
      error instanceof
      AdminQuestionValidationError
    ) {
      return validationErrorResponse(
        error
      );
    }

    console.error(
      "Erro ao arquivar questão:",
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