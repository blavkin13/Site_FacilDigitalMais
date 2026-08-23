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
} from "../../../../../db/index";

import {
  simulationResults,
  simulations,
  users,
} from "../../../../../db/schema";

import {
  initDatabase,
} from "../../../../../db/init";

import {
  validateSession,
} from "../../../../../lib/auth";

import {
  resolveSimulationAccess,
} from "../../../../../lib/simulation-access";

import {
  getSimulationQuestionRows,
  parseSimulationQuestionOptions,
} from "../../../../../lib/simulation-repository";


type RouteContext = {
  params:
    Promise<{
      id:
        string;
    }>;
};


type SubmittedAnswer = {
  questionId:
    number;

  selectedOption:
    number | null;
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


function isPlainObject(
  value:
    unknown
): value is Record<string, unknown> {
  return (
    typeof value ===
      "object" &&
    value !==
      null &&
    !Array.isArray(
      value
    )
  );
}


function validateSubmitBody(
  input:
    unknown
): {
  answers:
    SubmittedAnswer[];

  timeSpent:
    number;
} {
  if (
    !isPlainObject(
      input
    )
  ) {
    throw new Error(
      "Dados inválidos."
    );
  }

  const allowedFields =
    new Set([
      "answers",
      "timeSpent",
    ]);

  for (
    const key of
      Object.keys(
        input
      )
  ) {
    if (
      !allowedFields.has(
        key
      )
    ) {
      throw new Error(
        `Campo "${key}" não é permitido.`
      );
    }
  }

  if (
    !Array.isArray(
      input.answers
    )
  ) {
    throw new Error(
      "answers deve ser um array."
    );
  }

  if (
    !Number.isInteger(
      input.timeSpent
    ) ||
    Number(
      input.timeSpent
    ) <
      0
  ) {
    throw new Error(
      "timeSpent inválido."
    );
  }

  const answers =
    input.answers.map(
      (
        rawAnswer
      ) => {
        if (
          !isPlainObject(
            rawAnswer
          )
        ) {
          throw new Error(
            "Resposta inválida."
          );
        }

        const keys =
          Object.keys(
            rawAnswer
          );

        if (
          keys.some(
            (
              key
            ) =>
              key !==
                "questionId" &&
              key !==
                "selectedOption"
          )
        ) {
          throw new Error(
            "Resposta contém campos não permitidos."
          );
        }

        if (
          !Number.isInteger(
            rawAnswer.questionId
          ) ||
          Number(
            rawAnswer.questionId
          ) <=
            0
        ) {
          throw new Error(
            "questionId inválido."
          );
        }

        if (
          rawAnswer.selectedOption !==
            null &&
          (
            !Number.isInteger(
              rawAnswer.selectedOption
            ) ||
            Number(
              rawAnswer.selectedOption
            ) <
              0
          )
        ) {
          throw new Error(
            "selectedOption inválido."
          );
        }

        return {
          questionId:
            Number(
              rawAnswer.questionId
            ),

          selectedOption:
            rawAnswer.selectedOption ===
              null
              ? null
              : Number(
                  rawAnswer.selectedOption
                ),
        };
      }
    );

  const questionIds =
    answers.map(
      (
        answer
      ) =>
        answer.questionId
    );

  if (
    new Set(
      questionIds
    ).size !==
    questionIds.length
  ) {
    throw new Error(
      "Não é permitido enviar respostas duplicadas para a mesma questão."
    );
  }

  return {
    answers,

    timeSpent:
      Number(
        input.timeSpent
      ),
  };
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
      return NextResponse.json(
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

    /**
     * O entitlement é revalidado no momento
     * da submissão.
     *
     * Portanto refund/reject ocorrido depois que
     * o aluno abriu a página bloqueia a submissão.
     */
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

      return NextResponse.json(
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

    const officialQuestions =
      await getSimulationQuestionRows(
        simulationId
      );

    if (
      officialQuestions.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "O simulado não possui questões disponíveis.",
        },
        {
          status:
            409,
        }
      );
    }

    if (
      officialQuestions.some(
        (
          question
        ) =>
          question.active !==
          true
      )
    ) {
      return NextResponse.json(
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

    let body:
      unknown;

    try {
      body =
        await request.json();
    } catch {
      return NextResponse.json(
        {
          error:
            "Corpo JSON inválido.",
        },
        {
          status:
            400,
        }
      );
    }

    let submitted;

    try {
      submitted =
        validateSubmitBody(
          body
        );
    } catch (
      error
    ) {
      return NextResponse.json(
        {
          error:
            error instanceof
              Error
              ? error.message
              : "Dados inválidos.",
        },
        {
          status:
            400,
        }
      );
    }

    /**
     * O frontend atual envia uma entrada para cada
     * questão, usando selectedOption=null quando o
     * tempo termina antes da resposta.
     *
     * Exigimos o conjunto oficial completo para impedir
     * manipulação de totalQuestions.
     */
    if (
      submitted.answers.length !==
      officialQuestions.length
    ) {
      return NextResponse.json(
        {
          error:
            "A quantidade de respostas não corresponde ao simulado.",
        },
        {
          status:
            400,
        }
      );
    }

    const answerMap =
      new Map<
        number,
        SubmittedAnswer
      >();

    for (
      const answer of
        submitted.answers
    ) {
      answerMap.set(
        answer.questionId,
        answer
      );
    }

    const officialIds =
      new Set(
        officialQuestions.map(
          (
            question
          ) =>
            question.id
        )
      );

    for (
      const answer of
        submitted.answers
    ) {
      if (
        !officialIds.has(
          answer.questionId
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Foi enviada uma questão que não pertence a este simulado.",
          },
          {
            status:
              400,
          }
        );
      }
    }

    const maximumAcceptedTime =
      simulation.timeLimit *
        60 +
      300;

    if (
      submitted.timeSpent >
      maximumAcceptedTime
    ) {
      return NextResponse.json(
        {
          error:
            "Tempo de execução inválido.",
        },
        {
          status:
            400,
        }
      );
    }

    let score =
      0;

    const detailedAnswers =
      officialQuestions.map(
        (
          question
        ) => {
          const answer =
            answerMap.get(
              question.id
            );

          if (
            !answer
          ) {
            throw new Error(
              "Resposta obrigatória ausente."
            );
          }

          const options =
            parseSimulationQuestionOptions(
              question.options
            );

          if (
            answer.selectedOption !==
              null &&
            answer.selectedOption >=
              options.length
          ) {
            throw new Error(
              "Alternativa selecionada inválida."
            );
          }

          const isCorrect =
            answer.selectedOption !==
              null &&
            answer.selectedOption ===
              question.correctAnswer;

          if (
            isCorrect
          ) {
            score +=
              1;
          }

          return {
            questionId:
              question.id,

            subject:
              question.subject,

            questionText:
              question.questionText,

            options,

            selectedOption:
              answer.selectedOption,

            correctAnswer:
              question.correctAnswer,

            isCorrect,

            explanation:
              question.explanation,
          };
        }
      );

    const sanitizedAnswers =
      detailedAnswers.map(
        (
          answer
        ) => ({
          questionId:
            answer.questionId,

          selectedOption:
            answer.selectedOption,
        })
      );

    const completedAt =
      new Date()
        .toISOString();

    /**
     * Snapshot histórico imutável.
     *
     * Ele é persistido apenas no servidor.
     * Alterações futuras no banco de questões não
     * reescrevem esta tentativa.
     */
    const snapshot =
      {
        version:
          1,

        simulation: {
          id:
            simulation.id,

          title:
            simulation.title,

          bank:
            simulation.bank,

          timeLimit:
            simulation.timeLimit,
        },

        completedAt,

        questions:
          detailedAnswers,
      };

    const inserted =
      await db
        .insert(
          simulationResults
        )
        .values({
          userId:
            user.id,

          simulationId,

          score,

          totalQuestions:
            officialQuestions.length,

          timeSpent:
            submitted.timeSpent,

          answers:
            JSON.stringify(
              sanitizedAnswers
            ),

          snapshot:
            JSON.stringify(
              snapshot
            ),

          completedAt,
        })
        .returning();

    /**
     * Ranking:
     *
     * timeSpent ainda é medido no navegador na versão
     * atual, portanto NÃO será usado como critério
     * autoritativo de desempate.
     *
     * O tracking server-side da tentativa entra na 4.3.
     */
    const rankingRows =
      await db
        .select({
          userId:
            users.id,

          userName:
            users.name,

          score:
            simulationResults.score,

          totalQuestions:
            simulationResults.totalQuestions,

          timeSpent:
            simulationResults.timeSpent,

          completedAt:
            simulationResults.completedAt,
        })
        .from(
          simulationResults
        )
        .innerJoin(
          users,
          eq(
            simulationResults.userId,
            users.id
          )
        )
        .where(
          eq(
            simulationResults.simulationId,
            simulationId
          )
        )
        .all();

    rankingRows.sort(
      (
        a,
        b
      ) => {
        if (
          b.score !==
          a.score
        ) {
          return (
            b.score -
            a.score
          );
        }

        return a.completedAt
          .localeCompare(
            b.completedAt
          );
      }
    );

    /**
     * Ranking considera a melhor tentativa
     * de cada usuário.
     */
    const bestByUser =
      [];

    const seenUsers =
      new Set<number>();

    for (
      const row of
        rankingRows
    ) {
      if (
        seenUsers.has(
          row.userId
        )
      ) {
        continue;
      }

      seenUsers.add(
        row.userId
      );

      bestByUser.push(
        row
      );
    }

    const userPosition =
      bestByUser.findIndex(
        (
          row
        ) =>
          row.userId ===
          user.id
      ) +
      1;

    const ranking =
      bestByUser
        .slice(
          0,
          20
        )
        .map(
          (
            row,
            index
          ) => ({
            position:
              index +
              1,

            name:
              row.userName
                ?.trim() ||
              "Aluno",

            score:
              row.score,

            totalQuestions:
              row.totalQuestions,

            timeSpent:
              row.timeSpent,

            completedAt:
              row.completedAt,

            isCurrentUser:
              row.userId ===
              user.id,
          })
        );

    const savedResult =
      inserted[0];

    return NextResponse.json(
      {
        /**
         * Não retornamos snapshot/answers crus.
         */
        result: {
          id:
            savedResult.id,

          score:
            savedResult.score,

          totalQuestions:
            savedResult.totalQuestions,

          timeSpent:
            savedResult.timeSpent,

          completedAt:
            savedResult.completedAt,
        },

        score,

        totalQuestions:
          officialQuestions.length,

        timeSpent:
          submitted.timeSpent,

        percentage:
          Math.round(
            (
              score /
              officialQuestions.length
            ) *
              100
          ),

        /**
         * Após a submissão o gabarito pode ser
         * revelado para revisão.
         */
        detailedAnswers,

        ranking,

        userPosition,
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
    if (
      error instanceof
      Error &&
    (
      error.message ===
        "Resposta obrigatória ausente." ||
      error.message ===
        "Alternativa selecionada inválida."
    )
    ) {
      return NextResponse.json(
        {
          error:
            error.message,
        },
        {
          status:
            400,
        }
      );
    }

    console.error(
      "Erro ao submeter simulado:",
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