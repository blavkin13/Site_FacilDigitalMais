import {
  randomBytes,
} from "node:crypto";

import {
  eq,
} from "drizzle-orm";

import {
  getDb,
  getSqliteConnection,
} from "../db/index";

import {
  initDatabase,
} from "../db/init";

import {
  simulations,
} from "../db/schema";

import {
  resolveSimulationAccess,
  type SimulationAccessDenialReason,
} from "./simulation-access";

import {
  getSimulationQuestionRows,
  parseSimulationQuestionOptions,
} from "./simulation-repository";


export type SimulationAttemptStatus =
  | "in_progress"
  | "completed"
  | "expired"
  | "revoked";


export type SimulationAttemptQuestionSnapshot = {
  id:
    number;

  position:
    number;

  subject:
    string;

  questionText:
    string;

  options:
    string[];

  difficulty:
    string | null;

  correctAnswer:
    number;

  explanation:
    string | null;
};


export type SimulationAttemptSnapshot = {
  version:
    1;

  simulation: {
    id:
      number;

    title:
      string;

    bank:
      string;

    timeLimit:
      number;
  };

  questions:
    SimulationAttemptQuestionSnapshot[];
};


export type PublicSimulationAttempt = {
  token:
    string;

  status:
    "in_progress";

  startedAt:
    string;

  expiresAt:
    string;

  serverNow:
    string;

  secondsRemaining:
    number;

  simulation: {
    id:
      number;

    title:
      string;

    bank:
      string;

    timeLimit:
      number;

    totalQuestions:
      number;
  };

  questions:
    Array<{
      id:
        number;

      position:
        number;

      subject:
        string;

      questionText:
        string;

      options:
        string[];

      difficulty:
        string | null;
    }>;
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
    SimulationAttemptStatus;

  started_at:
    string;

  expires_at:
    string;

  completed_at:
    string | null;

  question_snapshot:
    string;

  created_at:
    string;

  updated_at:
    string;
};


export type StartSimulationAttemptReason =
  | SimulationAccessDenialReason
  | "simulation_unavailable"
  | "attempt_invalid";


export type StartSimulationAttemptDecision =
  | {
      ok:
        true;

      resumed:
        boolean;

      attempt:
        PublicSimulationAttempt;
    }
  | {
      ok:
        false;

      reason:
        StartSimulationAttemptReason;
    };


export type ResolveSimulationAttemptReason =
  | "invalid_input"
  | "attempt_not_found"
  | "attempt_expired"
  | "attempt_revoked"
  | "attempt_completed"
  | "attempt_invalid"
  | "access_revoked";


export type ResolveSimulationAttemptDecision =
  | {
      ok:
        true;

      attempt:
        PublicSimulationAttempt;
    }
  | {
      ok:
        false;

      reason:
        ResolveSimulationAttemptReason;

      accessReason?:
        SimulationAccessDenialReason;
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


function isValidAttemptToken(
  value:
    string
) {
  return /^[a-f0-9]{64}$/.test(
    value
  );
}


function generateAttemptToken() {
  return randomBytes(
    32
  ).toString(
    "hex"
  );
}


function toIso(
  date:
    Date
) {
  return date.toISOString();
}


function secondsRemaining(
  expiresAt:
    string,
  now:
    Date
) {
  const expires =
    new Date(
      expiresAt
    ).getTime();

  if (
    !Number.isFinite(
      expires
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.ceil(
      (
        expires -
        now.getTime()
      ) /
        1000
    )
  );
}


function isExpired(
  expiresAt:
    string,
  now:
    Date
) {
  const expires =
    new Date(
      expiresAt
    ).getTime();

  return (
    !Number.isFinite(
      expires
    ) ||
    expires <=
      now.getTime()
  );
}


function isAttemptStatus(
  value:
    unknown
): value is SimulationAttemptStatus {
  return (
    value ===
      "in_progress" ||
    value ===
      "completed" ||
    value ===
      "expired" ||
    value ===
      "revoked"
  );
}


function normalizeAttemptRow(
  value:
    unknown
): AttemptRow | null {
  if (
    !isPlainObject(
      value
    )
  ) {
    return null;
  }

  if (
    !Number.isInteger(
      value.id
    ) ||
    typeof value.token !==
      "string" ||
    !Number.isInteger(
      value.user_id
    ) ||
    !Number.isInteger(
      value.simulation_id
    ) ||
    !isAttemptStatus(
      value.status
    ) ||
    typeof value.started_at !==
      "string" ||
    typeof value.expires_at !==
      "string" ||
    typeof value.question_snapshot !==
      "string" ||
    typeof value.created_at !==
      "string" ||
    typeof value.updated_at !==
      "string"
  ) {
    return null;
  }

  return {
    id:
      Number(
        value.id
      ),

    token:
      value.token,

    user_id:
      Number(
        value.user_id
      ),

    simulation_id:
      Number(
        value.simulation_id
      ),

    status:
      value.status,

    started_at:
      value.started_at,

    expires_at:
      value.expires_at,

    completed_at:
      typeof value.completed_at ===
        "string"
        ? value.completed_at
        : null,

    question_snapshot:
      value.question_snapshot,

    created_at:
      value.created_at,

    updated_at:
      value.updated_at,
  };
}


export function parseSimulationAttemptSnapshot(
  value:
    string
): SimulationAttemptSnapshot {
  let parsed:
    unknown;

  try {
    parsed =
      JSON.parse(
        value
      );
  } catch {
    throw new Error(
      "Snapshot da tentativa inválido."
    );
  }


  if (
    !isPlainObject(
      parsed
    ) ||
    parsed.version !==
      1 ||
    !isPlainObject(
      parsed.simulation
    ) ||
    !Array.isArray(
      parsed.questions
    )
  ) {
    throw new Error(
      "Snapshot da tentativa inválido."
    );
  }


  const simulation =
    parsed.simulation;


  if (
    !Number.isInteger(
      simulation.id
    ) ||
    typeof simulation.title !==
      "string" ||
    typeof simulation.bank !==
      "string" ||
    !Number.isInteger(
      simulation.timeLimit
    ) ||
    Number(
      simulation.timeLimit
    ) <=
      0
  ) {
    throw new Error(
      "Snapshot da tentativa inválido."
    );
  }


  const questions =
    parsed.questions.map(
      (
        rawQuestion
      ) => {
        if (
          !isPlainObject(
            rawQuestion
          ) ||
          !Number.isInteger(
            rawQuestion.id
          ) ||
          !Number.isInteger(
            rawQuestion.position
          ) ||
          typeof rawQuestion.subject !==
            "string" ||
          typeof rawQuestion.questionText !==
            "string" ||
          !Array.isArray(
            rawQuestion.options
          ) ||
          !rawQuestion.options.every(
            (
              option
            ) =>
              typeof option ===
                "string"
          ) ||
          !Number.isInteger(
            rawQuestion.correctAnswer
          ) ||
          Number(
            rawQuestion.correctAnswer
          ) <
            0 ||
          Number(
            rawQuestion.correctAnswer
          ) >=
            rawQuestion.options.length
        ) {
          throw new Error(
            "Snapshot da tentativa inválido."
          );
        }


        return {
          id:
            Number(
              rawQuestion.id
            ),

          position:
            Number(
              rawQuestion.position
            ),

          subject:
            rawQuestion.subject,

          questionText:
            rawQuestion.questionText,

          options:
            [
              ...rawQuestion.options,
            ],

          difficulty:
            typeof rawQuestion.difficulty ===
              "string"
              ? rawQuestion.difficulty
              : null,

          correctAnswer:
            Number(
              rawQuestion.correctAnswer
            ),

          explanation:
            typeof rawQuestion.explanation ===
              "string"
              ? rawQuestion.explanation
              : null,
        };
      }
    );


  if (
    questions.length ===
    0
  ) {
    throw new Error(
      "Snapshot da tentativa não possui questões."
    );
  }


  return {
    version:
      1,

    simulation: {
      id:
        Number(
          simulation.id
        ),

      title:
        simulation.title,

      bank:
        simulation.bank,

      timeLimit:
        Number(
          simulation.timeLimit
        ),
    },

    questions,
  };
}


function buildPublicAttempt(
  row:
    AttemptRow,
  snapshot:
    SimulationAttemptSnapshot,
  now:
    Date
): PublicSimulationAttempt {
  return {
    token:
      row.token,

    status:
      "in_progress",

    startedAt:
      row.started_at,

    expiresAt:
      row.expires_at,

    serverNow:
      toIso(
        now
      ),

    secondsRemaining:
      secondsRemaining(
        row.expires_at,
        now
      ),

    simulation: {
      id:
        snapshot
          .simulation
          .id,

      title:
        snapshot
          .simulation
          .title,

      bank:
        snapshot
          .simulation
          .bank,

      timeLimit:
        snapshot
          .simulation
          .timeLimit,

      totalQuestions:
        snapshot
          .questions
          .length,
    },

    /**
     * Nunca enviar correctAnswer ou explanation
     * antes da finalização.
     */
    questions:
      snapshot.questions.map(
        (
          question
        ) => ({
          id:
            question.id,

          position:
            question.position,

          subject:
            question.subject,

          questionText:
            question.questionText,

          options:
            [
              ...question.options,
            ],

          difficulty:
            question.difficulty,
        })
      ),
  };
}


function getActiveAttemptRow(
  userId:
    number,
  simulationId:
    number
) {
  const sqlite =
    getSqliteConnection();

  return normalizeAttemptRow(
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
          question_snapshot,
          created_at,
          updated_at
        FROM simulation_attempts
        WHERE
          user_id = ?
          AND simulation_id = ?
          AND status = 'in_progress'
        ORDER BY id DESC
        LIMIT 1
      `)
      .get(
        userId,
        simulationId
      )
  );
}


function getAttemptRowByToken(
  simulationId:
    number,
  token:
    string
) {
  const sqlite =
    getSqliteConnection();

  return normalizeAttemptRow(
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
          question_snapshot,
          created_at,
          updated_at
        FROM simulation_attempts
        WHERE
          simulation_id = ?
          AND token = ?
        LIMIT 1
      `)
      .get(
        simulationId,
        token
      )
  );
}


function expireStaleAttempt(
  userId:
    number,
  simulationId:
    number,
  now:
    Date
) {
  const sqlite =
    getSqliteConnection();

  const nowIso =
    toIso(
      now
    );

  sqlite
    .prepare(`
      UPDATE simulation_attempts
      SET
        status = 'expired',
        updated_at = ?
      WHERE
        user_id = ?
        AND simulation_id = ?
        AND status = 'in_progress'
        AND expires_at <= ?
    `)
    .run(
      nowIso,
      userId,
      simulationId,
      nowIso
    );
}


function changeAttemptStatus(
  attemptId:
    number,
  status:
    SimulationAttemptStatus,
  now:
    Date
) {
  const sqlite =
    getSqliteConnection();

  sqlite
    .prepare(`
      UPDATE simulation_attempts
      SET
        status = ?,
        updated_at = ?
      WHERE id = ?
    `)
    .run(
      status,
      toIso(
        now
      ),
      attemptId
    );
}


function revokeOpenAttempts(
  userId:
    number,
  simulationId:
    number,
  now:
    Date
) {
  const sqlite =
    getSqliteConnection();

  sqlite
    .prepare(`
      UPDATE simulation_attempts
      SET
        status = 'revoked',
        updated_at = ?
      WHERE
        user_id = ?
        AND simulation_id = ?
        AND status = 'in_progress'
    `)
    .run(
      toIso(
        now
      ),
      userId,
      simulationId
    );
}


function parseAttemptOrInvalidate(
  row:
    AttemptRow,
  now:
    Date
): SimulationAttemptSnapshot | null {
  try {
    return parseSimulationAttemptSnapshot(
      row.question_snapshot
    );
  } catch {
    changeAttemptStatus(
      row.id,
      "revoked",
      now
    );

    return null;
  }
}


async function buildNewAttemptSnapshot(
  simulationId:
    number
): Promise<SimulationAttemptSnapshot | null> {
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

        timeLimit:
          simulations.timeLimit,

        active:
          simulations.active,
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
    !simulation ||
    simulation.active !==
      true ||
    !Number.isInteger(
      simulation.timeLimit
    ) ||
    simulation.timeLimit <=
      0
  ) {
    return null;
  }


  const questionRows =
    await getSimulationQuestionRows(
      simulationId
    );


  if (
    questionRows.length ===
      0 ||
    questionRows.some(
      (
        question
      ) =>
        question.active !==
        true
    )
  ) {
    return null;
  }


  const snapshotQuestions:
    SimulationAttemptQuestionSnapshot[] =
    [];


  try {
    for (
      const question of
        questionRows
    ) {
      const options =
        parseSimulationQuestionOptions(
          question.options
        );


      if (
        !Number.isInteger(
          question.correctAnswer
        ) ||
        question.correctAnswer <
          0 ||
        question.correctAnswer >=
          options.length
      ) {
        return null;
      }


      snapshotQuestions.push({
        id:
          question.id,

        position:
          question.position,

        subject:
          question.subject,

        questionText:
          question.questionText,

        options,

        difficulty:
          question.difficulty,

        correctAnswer:
          question.correctAnswer,

        explanation:
          question.explanation,
      });
    }
  } catch {
    return null;
  }


  return {
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

    questions:
      snapshotQuestions,
  };
}


export async function startOrResumeSimulationAttempt(
  userId:
    number,
  simulationId:
    number,
  now:
    Date =
    new Date()
): Promise<StartSimulationAttemptDecision> {
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
    return {
      ok:
        false,

      reason:
        "invalid_input",
    };
  }


  await initDatabase();


  const access =
    await resolveSimulationAccess(
      userId,
      simulationId
    );


  if (
    !access.allowed
  ) {
    /**
     * Refund, rejeição posterior ou despublicação
     * revogam uma tentativa ainda aberta.
     */
    revokeOpenAttempts(
      userId,
      simulationId,
      now
    );

    return {
      ok:
        false,

      reason:
        access.reason,
    };
  }


  const sqlite =
    getSqliteConnection();


  /**
   * Primeiro verificamos se existe uma tentativa
   * que deve ser retomada.
   *
   * Isso ocorre ANTES de ler as questões atuais:
   * alterações administrativas posteriores ao
   * início não devem modificar uma prova em curso.
   */
  const existingAttempt =
    sqlite.transaction(
      () => {
        expireStaleAttempt(
          userId,
          simulationId,
          now
        );

        return getActiveAttemptRow(
          userId,
          simulationId
        );
      }
    )();


  if (
    existingAttempt
  ) {
    const snapshot =
      parseAttemptOrInvalidate(
        existingAttempt,
        now
      );


    if (
      !snapshot
    ) {
      return {
        ok:
          false,

        reason:
          "attempt_invalid",
      };
    }


    return {
      ok:
        true,

      resumed:
        true,

      attempt:
        buildPublicAttempt(
          existingAttempt,
          snapshot,
          now
        ),
    };
  }


  const snapshot =
    await buildNewAttemptSnapshot(
      simulationId
    );


  if (
    !snapshot
  ) {
    return {
      ok:
        false,

      reason:
        "simulation_unavailable",
    };
  }


  const startedAt =
    toIso(
      now
    );

  const expiresAt =
    toIso(
      new Date(
        now.getTime() +
          snapshot
            .simulation
            .timeLimit *
            60 *
            1000
      )
    );

  const serializedSnapshot =
    JSON.stringify(
      snapshot
    );


  /**
   * A segunda verificação dentro da transação
   * evita duas tentativas simultâneas caso duas
   * requisições de início cheguem quase juntas.
   *
   * O índice UNIQUE parcial é a última camada
   * de proteção no próprio SQLite.
   */
  const createdOrExisting =
    sqlite.transaction(
      () => {
        expireStaleAttempt(
          userId,
          simulationId,
          now
        );


        const raceWinner =
          getActiveAttemptRow(
            userId,
            simulationId
          );


        if (
          raceWinner
        ) {
          return {
            row:
              raceWinner,

            resumed:
              true,
          };
        }


        let token =
          generateAttemptToken();


        for (
          let attempt =
            0;
          attempt <
            3;
          attempt +=
            1
        ) {
          try {
            sqlite
              .prepare(`
                INSERT INTO simulation_attempts (
                  token,
                  user_id,
                  simulation_id,
                  status,
                  started_at,
                  expires_at,
                  question_snapshot,
                  updated_at
                )
                VALUES (
                  ?,
                  ?,
                  ?,
                  'in_progress',
                  ?,
                  ?,
                  ?,
                  ?
                )
              `)
              .run(
                token,
                userId,
                simulationId,
                startedAt,
                expiresAt,
                serializedSnapshot,
                startedAt
              );

            break;
          } catch (
            error
          ) {
            const message =
              error instanceof
              Error
                ? error.message
                : "";

            /**
             * Colisão de token é astronomicamente
             * improvável, mas o código continua
             * fail-safe.
             */
            if (
              message.includes(
                "simulation_attempts.token"
              )
            ) {
              token =
                generateAttemptToken();

              continue;
            }

            throw error;
          }
        }


        const inserted =
          getAttemptRowByToken(
            simulationId,
            token
          );


        if (
          !inserted
        ) {
          throw new Error(
            "Falha ao criar tentativa do simulado."
          );
        }


        return {
          row:
            inserted,

          resumed:
            false,
        };
      }
    )();


  const finalSnapshot =
    parseAttemptOrInvalidate(
      createdOrExisting.row,
      now
    );


  if (
    !finalSnapshot
  ) {
    return {
      ok:
        false,

      reason:
        "attempt_invalid",
    };
  }


  return {
    ok:
      true,

    resumed:
      createdOrExisting
        .resumed,

    attempt:
      buildPublicAttempt(
        createdOrExisting.row,
        finalSnapshot,
        now
      ),
  };
}


export async function getActiveSimulationAttemptForUser(
  userId:
    number,
  simulationId:
    number,
  now:
    Date =
    new Date()
): Promise<ResolveSimulationAttemptDecision> {
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
    return {
      ok:
        false,

      reason:
        "invalid_input",
    };
  }


  await initDatabase();


  /**
   * Antes de procurar uma tentativa aberta,
   * convertemos qualquer tentativa vencida
   * para expired.
   *
   * Isso também libera o índice UNIQUE parcial
   * para uma futura nova tentativa.
   */
  const sqlite =
    getSqliteConnection();


  const activeAttempt =
    sqlite.transaction(
      () => {
        expireStaleAttempt(
          userId,
          simulationId,
          now
        );


        return getActiveAttemptRow(
          userId,
          simulationId
        );
      }
    )();


  if (
    !activeAttempt
  ) {
    return {
      ok:
        false,

      reason:
        "attempt_not_found",
    };
  }


  /**
   * A resolução normal continua sendo a
   * autoridade para:
   *
   * - owner;
   * - entitlement;
   * - refund;
   * - despublicação;
   * - expiração;
   * - integridade do snapshot.
   */
  return resolveSimulationAttemptForUser(
    userId,
    simulationId,
    activeAttempt.token,
    now
  );
}


export async function resolveSimulationAttemptForUser(
  userId:
    number,
  simulationId:
    number,
  token:
    string,
  now:
    Date =
    new Date()
): Promise<ResolveSimulationAttemptDecision> {
  if (
    !isValidId(
      userId
    ) ||
    !isValidId(
      simulationId
    ) ||
    !isValidAttemptToken(
      token
    ) ||
    !Number.isFinite(
      now.getTime()
    )
  ) {
    return {
      ok:
        false,

      reason:
        "invalid_input",
    };
  }


  await initDatabase();


  const row =
    getAttemptRowByToken(
      simulationId,
      token
    );


  /**
   * Não revelamos se a tentativa pertence a
   * outro usuário.
   *
   * Isso evita enumeração horizontal.
   */
  if (
    !row ||
    row.user_id !==
      userId
  ) {
    return {
      ok:
        false,

      reason:
        "attempt_not_found",
    };
  }


  if (
    row.status ===
    "completed"
  ) {
    return {
      ok:
        false,

      reason:
        "attempt_completed",
    };
  }


  if (
    row.status ===
    "expired"
  ) {
    return {
      ok:
        false,

      reason:
        "attempt_expired",
    };
  }


  if (
    row.status ===
    "revoked"
  ) {
    return {
      ok:
        false,

      reason:
        "attempt_revoked",
    };
  }


  if (
    isExpired(
      row.expires_at,
      now
    )
  ) {
    changeAttemptStatus(
      row.id,
      "expired",
      now
    );

    return {
      ok:
        false,

      reason:
        "attempt_expired",
    };
  }


  /**
   * Entitlement é revalidado também durante
   * uma tentativa em andamento.
   *
   * Portanto refund/rejected/despublicação
   * bloqueiam continuação da prova.
   */
  const access =
    await resolveSimulationAccess(
      userId,
      simulationId
    );


  if (
    !access.allowed
  ) {
    changeAttemptStatus(
      row.id,
      "revoked",
      now
    );

    return {
      ok:
        false,

      reason:
        "access_revoked",

      accessReason:
        access.reason,
    };
  }


  const snapshot =
    parseAttemptOrInvalidate(
      row,
      now
    );


  if (
    !snapshot
  ) {
    return {
      ok:
        false,

      reason:
        "attempt_invalid",
    };
  }


  return {
    ok:
      true,

    attempt:
      buildPublicAttempt(
        row,
        snapshot,
        now
      ),
  };
}