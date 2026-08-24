import {
  getSqliteConnection,
} from "../db/index";

import {
  initDatabase,
} from "../db/init";

import {
  parseSimulationAttemptSnapshot,
  type SimulationAttemptSnapshot,
} from "./simulation-attempts";


const SUBMISSION_GRACE_SECONDS =
  15;


type SubmittedAnswer = {
  questionId:
    number;

  selectedOption:
    number | null;
};


type ValidatedPayload = {
  attemptToken:
    string;

  answers:
    SubmittedAnswer[];
};


type AttemptRow = {
  id:
    number;

  token:
    string;

  user_id:
    number;

  simulation_id:
    number;

  status:
    string;

  started_at:
    string;

  expires_at:
    string;

  completed_at:
    string | null;

  question_snapshot:
    string;
};


export type FinalizedDetailedAnswer = {
  questionId:
    number;

  subject:
    string;

  questionText:
    string;

  options:
    string[];

  selectedOption:
    number | null;

  correctAnswer:
    number;

  isCorrect:
    boolean;

  explanation:
    string | null;
};


export type FinalizeAttemptReason =
  | "invalid_input"
  | "answers_invalid"
  | "attempt_not_found"
  | "attempt_expired"
  | "attempt_revoked"
  | "attempt_completed"
  | "attempt_invalid"
  | "access_revoked";


export type FinalizeAttemptDecision =
  | {
      ok:
        true;

      result: {
        id:
          number;

        attemptId:
          number;

        score:
          number;

        totalQuestions:
          number;

        timeSpent:
          number;

        percentage:
          number;

        completedAt:
          string;

        detailedAnswers:
          FinalizedDetailedAnswer[];
      };
    }
  | {
      ok:
        false;

      reason:
        FinalizeAttemptReason;

      message:
        string;
    };


export type SimulationRankingEntry = {
  position:
    number;

  name:
    string;

  score:
    number;

  totalQuestions:
    number;

  timeSpent:
    number;

  completedAt:
    string;

  isCurrentUser:
    boolean;
};


function isPlainObject(
  value:
    unknown
): value is Record<
  string,
  unknown
> {
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


function isValidId(
  value:
    number
) {
  return (
    Number.isInteger(
      value
    ) &&
    value >
      0
  );
}


function isValidToken(
  value:
    string
) {
  return /^[a-f0-9]{64}$/.test(
    value
  );
}


function invalid(
  reason:
    FinalizeAttemptReason,
  message:
    string
): FinalizeAttemptDecision {
  return {
    ok:
      false,

    reason,
    message,
  };
}


function validatePayload(
  input:
    unknown
):
  | {
      ok:
        true;

      value:
        ValidatedPayload;
    }
  | {
      ok:
        false;

      message:
        string;
    } {
  if (
    !isPlainObject(
      input
    )
  ) {
    return {
      ok:
        false,

      message:
        "Dados inválidos.",
    };
  }


  const allowedFields =
    new Set([
      "attemptToken",
      "answers",
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
      return {
        ok:
          false,

        message:
          `Campo "${key}" não é permitido.`,
      };
    }
  }


  if (
    typeof input.attemptToken !==
      "string" ||
    !isValidToken(
      input.attemptToken
    )
  ) {
    return {
      ok:
        false,

      message:
        "attemptToken inválido.",
    };
  }


  if (
    !Array.isArray(
      input.answers
    )
  ) {
    return {
      ok:
        false,

      message:
        "answers deve ser um array.",
    };
  }


  const answers:
    SubmittedAnswer[] =
    [];


  const ids =
    new Set<number>();


  for (
    const rawAnswer of
      input.answers
  ) {
    if (
      !isPlainObject(
        rawAnswer
      )
    ) {
      return {
        ok:
          false,

        message:
          "Resposta inválida.",
      };
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
      return {
        ok:
          false,

        message:
          "Resposta contém campos não permitidos.",
      };
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
      return {
        ok:
          false,

        message:
          "questionId inválido.",
      };
    }


    const questionId =
      Number(
        rawAnswer.questionId
      );


    if (
      ids.has(
        questionId
      )
    ) {
      return {
        ok:
          false,

        message:
          "Não é permitido enviar respostas duplicadas.",
      };
    }


    ids.add(
      questionId
    );


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
      return {
        ok:
          false,

        message:
          "selectedOption inválido.",
      };
    }


    answers.push({
      questionId,

      selectedOption:
        rawAnswer.selectedOption ===
          null
          ? null
          : Number(
              rawAnswer.selectedOption
            ),
    });
  }


  return {
    ok:
      true,

    value: {
      attemptToken:
        input.attemptToken,

      answers,
    },
  };
}


function getAttempt(
  simulationId:
    number,
  token:
    string
): AttemptRow | null {
  const sqlite =
    getSqliteConnection();


  const row =
    sqlite
      .prepare(`
        SELECT
          id,
          token,
          user_id,
          simulation_id,
          status,
          started_at,
          expires_at,
          completed_at,
          question_snapshot
        FROM simulation_attempts
        WHERE
          simulation_id = ?
          AND token = ?
        LIMIT 1
      `)
      .get(
        simulationId,
        token
      ) as
      | AttemptRow
      | undefined;


  return row ??
    null;
}


function hasCurrentEntitlement(
  userId:
    number,
  simulationId:
    number
) {
  const sqlite =
    getSqliteConnection();


  const row =
    sqlite
      .prepare(`
        SELECT
          s.id
        FROM simulations s
        WHERE
          s.id = ?
          AND s.active = 1
          AND EXISTS (
            SELECT 1
            FROM simulation_products sp
            INNER JOIN order_items oi
              ON oi.product_id = sp.product_id
            INNER JOIN orders o
              ON o.id = oi.order_id
            WHERE
              sp.simulation_id = s.id
              AND o.user_id = ?
              AND o.status = 'approved'
          )
        LIMIT 1
      `)
      .get(
        simulationId,
        userId
      );


  return Boolean(
    row
  );
}


function updateAttemptStatus(
  attemptId:
    number,
  status:
    "expired" | "revoked",
  nowIso:
    string
) {
  const sqlite =
    getSqliteConnection();


  sqlite
    .prepare(`
      UPDATE simulation_attempts
      SET
        status = ?,
        updated_at = ?
      WHERE
        id = ?
        AND status = 'in_progress'
    `)
    .run(
      status,
      nowIso,
      attemptId
    );
}


function buildDetailedAnswers(
  snapshot:
    SimulationAttemptSnapshot,
  submitted:
    SubmittedAnswer[]
):
  | {
      ok:
        true;

      score:
        number;

      detailedAnswers:
        FinalizedDetailedAnswer[];
    }
  | {
      ok:
        false;

      message:
        string;
    } {
  if (
    submitted.length !==
    snapshot.questions.length
  ) {
    return {
      ok:
        false,

      message:
        "A quantidade de respostas não corresponde à tentativa.",
    };
  }


  const officialIds =
    new Set(
      snapshot.questions.map(
        (
          question
        ) =>
          question.id
      )
    );


  for (
    const answer of
      submitted
  ) {
    if (
      !officialIds.has(
        answer.questionId
      )
    ) {
      return {
        ok:
          false,

        message:
          "Foi enviada uma questão que não pertence à tentativa.",
      };
    }
  }


  const answerMap =
    new Map(
      submitted.map(
        (
          answer
        ) => [
          answer.questionId,
          answer,
        ]
      )
    );


  let score =
    0;


  const detailedAnswers:
    FinalizedDetailedAnswer[] =
    [];


  for (
    const question of
      snapshot.questions
  ) {
    const answer =
      answerMap.get(
        question.id
      );


    if (
      !answer
    ) {
      return {
        ok:
          false,

        message:
          "Resposta obrigatória ausente.",
      };
    }


    if (
      answer.selectedOption !==
        null &&
      answer.selectedOption >=
        question.options.length
    ) {
      return {
        ok:
          false,

        message:
          "Alternativa selecionada inválida.",
      };
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


    detailedAnswers.push({
      questionId:
        question.id,

      subject:
        question.subject,

      questionText:
        question.questionText,

      options: [
        ...question.options,
      ],

      selectedOption:
        answer.selectedOption,

      correctAnswer:
        question.correctAnswer,

      isCorrect,

      explanation:
        question.explanation,
    });
  }


  return {
    ok:
      true,

    score,
    detailedAnswers,
  };
}


function calculateServerTimeSpent(
  snapshot:
    SimulationAttemptSnapshot,
  startedAt:
    string,
  expiresAt:
    string,
  now:
    Date
) {
  const startedMs =
    Date.parse(
      startedAt
    );

  const expiresMs =
    Date.parse(
      expiresAt
    );


  if (
    !Number.isFinite(
      startedMs
    ) ||
    !Number.isFinite(
      expiresMs
    ) ||
    expiresMs <=
      startedMs
  ) {
    return null;
  }


  const effectiveEnd =
    Math.min(
      now.getTime(),
      expiresMs
    );


  if (
    effectiveEnd <
    startedMs
  ) {
    return null;
  }


  const elapsed =
    Math.floor(
      (
        effectiveEnd -
        startedMs
      ) /
        1000
    );


  const maximum =
    snapshot
      .simulation
      .timeLimit *
    60;


  return Math.max(
    0,
    Math.min(
      elapsed,
      maximum
    )
  );
}


export async function finalizeSimulationAttempt(
  userId:
    number,
  simulationId:
    number,
  input:
    unknown,
  now:
    Date =
    new Date()
): Promise<FinalizeAttemptDecision> {
  if (
    !isValidId(
      userId
    ) ||
    !isValidId(
      simulationId
    ) ||
    !Number.isFinite(
      now.getTime()
    )
  ) {
    return invalid(
      "invalid_input",
      "Dados inválidos."
    );
  }


  const payload =
    validatePayload(
      input
    );


  if (
    !payload.ok
  ) {
    return invalid(
      "invalid_input",
      payload.message
    );
  }


  await initDatabase();


  const sqlite =
    getSqliteConnection();


  const transaction =
    sqlite.transaction(
      (): FinalizeAttemptDecision => {
        const row =
          getAttempt(
            simulationId,
            payload
              .value
              .attemptToken
          );


        /**
         * Não revelamos a existência de
         * tentativa pertencente a outro usuário.
         */
        if (
          !row ||
          row.user_id !==
            userId
        ) {
          return invalid(
            "attempt_not_found",
            "Tentativa não encontrada."
          );
        }


        if (
          row.status ===
          "completed"
        ) {
          return invalid(
            "attempt_completed",
            "Esta tentativa já foi finalizada."
          );
        }


        if (
          row.status ===
          "expired"
        ) {
          return invalid(
            "attempt_expired",
            "O tempo desta tentativa terminou."
          );
        }


        if (
          row.status ===
          "revoked"
        ) {
          return invalid(
            "attempt_revoked",
            "O acesso a esta tentativa foi revogado."
          );
        }


        if (
          row.status !==
          "in_progress"
        ) {
          return invalid(
            "attempt_invalid",
            "Estado da tentativa inválido."
          );
        }


        const nowIso =
          now.toISOString();

        const expiresMs =
          Date.parse(
            row.expires_at
          );


        if (
          !Number.isFinite(
            expiresMs
          )
        ) {
          updateAttemptStatus(
            row.id,
            "revoked",
            nowIso
          );

          return invalid(
            "attempt_invalid",
            "Tentativa inválida."
          );
        }


        /**
         * O aluno possui até 15 segundos extras
         * apenas para a requisição de finalização
         * chegar ao servidor.
         *
         * Isso NÃO aumenta o tempo contabilizado.
         */
        const hardDeadline =
          expiresMs +
          SUBMISSION_GRACE_SECONDS *
            1000;


        if (
          now.getTime() >
          hardDeadline
        ) {
          updateAttemptStatus(
            row.id,
            "expired",
            nowIso
          );

          return invalid(
            "attempt_expired",
            "O tempo desta tentativa terminou."
          );
        }


        /**
         * Entitlement é revalidado dentro da
         * mesma transação que concluirá a prova.
         */
        if (
          !hasCurrentEntitlement(
            userId,
            simulationId
          )
        ) {
          updateAttemptStatus(
            row.id,
            "revoked",
            nowIso
          );

          return invalid(
            "access_revoked",
            "Seu acesso a este simulado foi revogado."
          );
        }


        let snapshot:
          SimulationAttemptSnapshot;


        try {
          snapshot =
            parseSimulationAttemptSnapshot(
              row.question_snapshot
            );
        } catch {
          updateAttemptStatus(
            row.id,
            "revoked",
            nowIso
          );

          return invalid(
            "attempt_invalid",
            "Snapshot da tentativa inválido."
          );
        }


        if (
          snapshot.simulation.id !==
          simulationId
        ) {
          updateAttemptStatus(
            row.id,
            "revoked",
            nowIso
          );

          return invalid(
            "attempt_invalid",
            "Snapshot da tentativa inválido."
          );
        }


        const correction =
          buildDetailedAnswers(
            snapshot,
            payload.value.answers
          );


        if (
          !correction.ok
        ) {
          return invalid(
            "answers_invalid",
            correction.message
          );
        }


        const timeSpent =
          calculateServerTimeSpent(
            snapshot,
            row.started_at,
            row.expires_at,
            now
          );


        if (
          timeSpent ===
          null
        ) {
          updateAttemptStatus(
            row.id,
            "revoked",
            nowIso
          );

          return invalid(
            "attempt_invalid",
            "Horários da tentativa inválidos."
          );
        }


        const sanitizedAnswers =
          correction
            .detailedAnswers
            .map(
              (
                answer
              ) => ({
                questionId:
                  answer.questionId,

                selectedOption:
                  answer.selectedOption,
              })
            );


        /**
         * Versão 2 identifica resultados
         * originados pela infraestrutura de
         * tentativas server-side.
         */
        const resultSnapshot =
          {
            version:
              2,

            simulation:
              snapshot.simulation,

            attempt: {
              id:
                row.id,

              startedAt:
                row.started_at,

              expiresAt:
                row.expires_at,

              completedAt:
                nowIso,
            },

            questions:
              correction
                .detailedAnswers,
          };


        const inserted =
          sqlite
            .prepare(`
              INSERT INTO simulation_results (
                user_id,
                simulation_id,
                attempt_id,
                score,
                total_questions,
                time_spent,
                answers,
                snapshot,
                completed_at
              )
              VALUES (
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?
              )
            `)
            .run(
              userId,
              simulationId,
              row.id,
              correction.score,
              snapshot
                .questions
                .length,
              timeSpent,
              JSON.stringify(
                sanitizedAnswers
              ),
              JSON.stringify(
                resultSnapshot
              ),
              nowIso
            );


        const completed =
          sqlite
            .prepare(`
              UPDATE simulation_attempts
              SET
                status = 'completed',
                completed_at = ?,
                updated_at = ?
              WHERE
                id = ?
                AND status = 'in_progress'
            `)
            .run(
              nowIso,
              nowIso,
              row.id
            );


        if (
          completed.changes !==
          1
        ) {
          /**
           * Qualquer exceção faz o better-sqlite3
           * reverter também o INSERT do resultado.
           */
          throw new Error(
            "A tentativa mudou de estado durante a finalização."
          );
        }


        const resultId =
          Number(
            inserted
              .lastInsertRowid
          );


        return {
          ok:
            true,

          result: {
            id:
              resultId,

            attemptId:
              row.id,

            score:
              correction.score,

            totalQuestions:
              snapshot
                .questions
                .length,

            timeSpent,

            percentage:
              Math.round(
                (
                  correction.score /
                  snapshot
                    .questions
                    .length
                ) *
                  100
              ),

            completedAt:
              nowIso,

            detailedAnswers:
              correction
                .detailedAnswers,
          },
        };
      }
    );


  /**
   * BEGIN IMMEDIATE serializa finalizações
   * concorrentes antes da primeira escrita.
   *
   * Dois submits do mesmo attemptToken não
   * conseguem criar dois resultados.
   */
  return transaction.immediate();
}


type RankingDatabaseRow = {
  userId:
    number;

  userName:
    string | null;

  score:
    number;

  totalQuestions:
    number;

  timeSpent:
    number;

  completedAt:
    string;

  attemptId:
    number | null;
};


export async function getSimulationRanking(
  simulationId:
    number,
  currentUserId:
    number
) {
  await initDatabase();


  const sqlite =
    getSqliteConnection();


  const rows =
    sqlite
      .prepare(`
        SELECT
          r.user_id AS userId,
          u.name AS userName,
          r.score AS score,
          r.total_questions AS totalQuestions,
          r.time_spent AS timeSpent,
          r.completed_at AS completedAt,
          r.attempt_id AS attemptId
        FROM simulation_results r
        INNER JOIN users u
          ON u.id = r.user_id
        WHERE
          r.simulation_id = ?
      `)
      .all(
        simulationId
      ) as RankingDatabaseRow[];


  rows.sort(
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


      const aAuthoritative =
        a.attemptId !==
        null;

      const bAuthoritative =
        b.attemptId !==
        null;


      /**
       * Tempo só pode desempatar quando ambos
       * os resultados vieram de attempts
       * server-side.
       */
      if (
        aAuthoritative &&
        bAuthoritative &&
        a.timeSpent !==
          b.timeSpent
      ) {
        return (
          a.timeSpent -
          b.timeSpent
        );
      }


      /**
       * Em igualdade de nota, um resultado
       * server-side é preferido a um resultado
       * legado cujo tempo veio do navegador.
       */
      if (
        aAuthoritative !==
        bAuthoritative
      ) {
        return aAuthoritative
          ? -1
          : 1;
      }


      return a.completedAt.localeCompare(
        b.completedAt
      );
    }
  );


  const bestByUser:
    RankingDatabaseRow[] =
    [];


  const seenUsers =
    new Set<number>();


  for (
    const row of
      rows
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


  const userIndex =
    bestByUser.findIndex(
      (
        row
      ) =>
        row.userId ===
        currentUserId
    );


  const ranking:
    SimulationRankingEntry[] =
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
            currentUserId,
        })
      );


  return {
    ranking,

    userPosition:
      userIndex >=
      0
        ? userIndex +
          1
        : 0,

    totalParticipants:
      bestByUser.length,
  };
}