import {
  getSqliteConnection,
} from "../db/index";

import {
  initDatabase,
} from "../db/init";

import {
  getSimulationRanking,
  type FinalizedDetailedAnswer,
} from "./simulation-attempt-submit";


type ResultDatabaseRow = {
  id:
    number;

  userId:
    number;

  simulationId:
    number;

  attemptId:
    number | null;

  score:
    number;

  totalQuestions:
    number;

  timeSpent:
    number;

  answers:
    string;

  snapshot:
    string | null;

  completedAt:
    string;

  currentSimulationTitle:
    string | null;

  currentSimulationBank:
    string | null;

  currentTimeLimit:
    number | null;
};


type ParsedResultSnapshot = {
  version:
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
  };

  questions:
    FinalizedDetailedAnswer[];
};


export type PublicSimulationResult = {
  id:
    number;

  simulationId:
    number;

  score:
    number;

  totalQuestions:
    number;

  percentage:
    number;

  timeSpent:
    number;

  completedAt:
    string;

  simulationTitle:
    string;

  simulationBank:
    string;

  timeLimit:
    number | null;

  timeUp:
    boolean;

  authoritativeTime:
    boolean;

  reviewAvailable:
    boolean;

  detailedAnswers:
    FinalizedDetailedAnswer[];
};


export type SimulationHistoryEntry = {
  id:
    number;

  simulationId:
    number;

  simulationTitle:
    string;

  simulationBank:
    string;

  score:
    number;

  totalQuestions:
    number;

  percentage:
    number;

  timeSpent:
    number;

  completedAt:
    string;

  authoritativeTime:
    boolean;

  reviewAvailable:
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


function isPositiveInteger(
  value:
    unknown
) {
  return (
    Number.isInteger(
      value
    ) &&
    Number(
      value
    ) >
      0
  );
}


function parseDetailedAnswer(
  value:
    unknown
): FinalizedDetailedAnswer | null {
  if (
    !isPlainObject(
      value
    ) ||
    !isPositiveInteger(
      value.questionId
    ) ||
    typeof value.subject !==
      "string" ||
    typeof value.questionText !==
      "string" ||
    !Array.isArray(
      value.options
    ) ||
    !value.options.every(
      (
        option
      ) =>
        typeof option ===
        "string"
    ) ||
    !Number.isInteger(
      value.correctAnswer
    )
  ) {
    return null;
  }


  const options =
    [
      ...value.options,
    ] as string[];


  const correctAnswer =
    Number(
      value.correctAnswer
    );


  if (
    correctAnswer <
      0 ||
    correctAnswer >=
      options.length
  ) {
    return null;
  }


  let selectedOption:
    number | null;


  if (
    value.selectedOption ===
    null
  ) {
    selectedOption =
      null;
  } else if (
    Number.isInteger(
      value.selectedOption
    ) &&
    Number(
      value.selectedOption
    ) >=
      0 &&
    Number(
      value.selectedOption
    ) <
      options.length
  ) {
    selectedOption =
      Number(
        value.selectedOption
      );
  } else {
    return null;
  }


  const isCorrect =
    typeof value.isCorrect ===
      "boolean"
      ? value.isCorrect
      : (
          selectedOption !==
            null &&
          selectedOption ===
            correctAnswer
        );


  return {
    questionId:
      Number(
        value.questionId
      ),

    subject:
      value.subject,

    questionText:
      value.questionText,

    options,

    selectedOption,

    correctAnswer,

    isCorrect,

    explanation:
      typeof value.explanation ===
        "string"
        ? value.explanation
        : null,
  };
}


function parseResultSnapshot(
  value:
    string | null
): ParsedResultSnapshot | null {
  if (
    !value
  ) {
    return null;
  }


  let parsed:
    unknown;


  try {
    parsed =
      JSON.parse(
        value
      );
  } catch {
    return null;
  }


  if (
    !isPlainObject(
      parsed
    ) ||
    (
      parsed.version !==
        1 &&
      parsed.version !==
        2
    ) ||
    !isPlainObject(
      parsed.simulation
    ) ||
    !Array.isArray(
      parsed.questions
    )
  ) {
    return null;
  }


  const simulation =
    parsed.simulation;


  if (
    !isPositiveInteger(
      simulation.id
    ) ||
    typeof simulation.title !==
      "string" ||
    typeof simulation.bank !==
      "string" ||
    !isPositiveInteger(
      simulation.timeLimit
    )
  ) {
    return null;
  }


  const questions:
    FinalizedDetailedAnswer[] =
    [];


  for (
    const rawQuestion of
      parsed.questions
  ) {
    const question =
      parseDetailedAnswer(
        rawQuestion
      );


    if (
      !question
    ) {
      return null;
    }


    questions.push(
      question
    );
  }


  if (
    questions.length ===
    0
  ) {
    return null;
  }


  return {
    version:
      Number(
        parsed.version
      ),

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


function percentage(
  score:
    number,
  totalQuestions:
    number
) {
  if (
    totalQuestions <=
    0
  ) {
    return 0;
  }


  return Math.round(
    (
      score /
      totalQuestions
    ) *
      100
  );
}


function toPublicResult(
  row:
    ResultDatabaseRow
): PublicSimulationResult {
  const snapshot =
    parseResultSnapshot(
      row.snapshot
    );


  const simulationTitle =
    snapshot
      ?.simulation
      .title ||
    row.currentSimulationTitle ||
    "Simulado";


  const simulationBank =
    snapshot
      ?.simulation
      .bank ||
    row.currentSimulationBank ||
    "Banca não informada";


  const timeLimit =
    snapshot
      ?.simulation
      .timeLimit ??
    row.currentTimeLimit ??
    null;


  const timeUp =
    timeLimit !==
      null &&
    row.timeSpent >=
      timeLimit *
        60;


  return {
    id:
      row.id,

    simulationId:
      row.simulationId,

    score:
      row.score,

    totalQuestions:
      row.totalQuestions,

    percentage:
      percentage(
        row.score,
        row.totalQuestions
      ),

    timeSpent:
      row.timeSpent,

    completedAt:
      row.completedAt,

    simulationTitle,

    simulationBank,

    timeLimit,

    timeUp,

    authoritativeTime:
      row.attemptId !==
      null,

    reviewAvailable:
      Boolean(
        snapshot
      ),

    detailedAnswers:
      snapshot
        ?.questions ||
      [],
  };
}


function resultSelectSql() {
  return `
    SELECT
      r.id AS id,
      r.user_id AS userId,
      r.simulation_id AS simulationId,
      r.attempt_id AS attemptId,
      r.score AS score,
      r.total_questions AS totalQuestions,
      r.time_spent AS timeSpent,
      r.answers AS answers,
      r.snapshot AS snapshot,
      r.completed_at AS completedAt,
      s.title AS currentSimulationTitle,
      s.bank AS currentSimulationBank,
      s.time_limit AS currentTimeLimit
    FROM simulation_results r
    LEFT JOIN simulations s
      ON s.id = r.simulation_id
  `;
}


async function buildResultBundle(
  row:
    ResultDatabaseRow,
  userId:
    number
) {
  const result =
    toPublicResult(
      row
    );


  const rankingData =
    await getSimulationRanking(
      row.simulationId,
      userId
    );


  return {
    result,

    ranking:
      rankingData.ranking,

    userPosition:
      rankingData.userPosition,

    totalParticipants:
      rankingData.totalParticipants,
  };
}


/**
 * Owner-only.
 *
 * A query já inclui user_id no WHERE para não
 * revelar se um resultado de outro aluno existe.
 */
export async function getSimulationResultForUser(
  userId:
    number,
  simulationId:
    number,
  resultId:
    number
) {
  await initDatabase();


  if (
    !isPositiveInteger(
      userId
    ) ||
    !isPositiveInteger(
      simulationId
    ) ||
    !isPositiveInteger(
      resultId
    )
  ) {
    return null;
  }


  const sqlite =
    getSqliteConnection();


  const row =
    sqlite
      .prepare(`
        ${resultSelectSql()}
        WHERE
          r.id = ?
          AND r.simulation_id = ?
          AND r.user_id = ?
        LIMIT 1
      `)
      .get(
        resultId,
        simulationId,
        userId
      ) as
      | ResultDatabaseRow
      | undefined;


  if (
    !row
  ) {
    return null;
  }


  /**
   * Não revalidamos entitlement aqui.
   *
   * Resultado concluído é histórico do aluno.
   * Refund ou despublicação bloqueiam novas
   * tentativas, mas não apagam uma tentativa
   * legitimamente concluída.
   */
  return buildResultBundle(
    row,
    userId
  );
}


export async function getLatestSimulationResultForUser(
  userId:
    number,
  simulationId:
    number
) {
  await initDatabase();


  if (
    !isPositiveInteger(
      userId
    ) ||
    !isPositiveInteger(
      simulationId
    )
  ) {
    return null;
  }


  const sqlite =
    getSqliteConnection();


  const row =
    sqlite
      .prepare(`
        ${resultSelectSql()}
        WHERE
          r.simulation_id = ?
          AND r.user_id = ?
        ORDER BY
          r.completed_at DESC,
          r.id DESC
        LIMIT 1
      `)
      .get(
        simulationId,
        userId
      ) as
      | ResultDatabaseRow
      | undefined;


  if (
    !row
  ) {
    return null;
  }


  return buildResultBundle(
    row,
    userId
  );
}


export async function listSimulationResultsForUser(
  userId:
    number
): Promise<SimulationHistoryEntry[]> {
  await initDatabase();


  if (
    !isPositiveInteger(
      userId
    )
  ) {
    return [];
  }


  const sqlite =
    getSqliteConnection();


  const rows =
    sqlite
      .prepare(`
        ${resultSelectSql()}
        WHERE
          r.user_id = ?
        ORDER BY
          r.completed_at DESC,
          r.id DESC
        LIMIT 100
      `)
      .all(
        userId
      ) as ResultDatabaseRow[];


  return rows.map(
    (
      row
    ) => {
      const result =
        toPublicResult(
          row
        );


      return {
        id:
          result.id,

        simulationId:
          result.simulationId,

        simulationTitle:
          result.simulationTitle,

        simulationBank:
          result.simulationBank,

        score:
          result.score,

        totalQuestions:
          result.totalQuestions,

        percentage:
          result.percentage,

        timeSpent:
          result.timeSpent,

        completedAt:
          result.completedAt,

        authoritativeTime:
          result.authoritativeTime,

        reviewAvailable:
          result.reviewAvailable,
      };
    }
  );
}