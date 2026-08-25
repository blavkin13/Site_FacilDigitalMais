import type {
  NewQuestion,
} from "../db/schema";


type UnknownRecord =
  Record<
    string,
    unknown
  >;


export type QuestionDifficulty =
  | "easy"
  | "medium"
  | "hard";


export class AdminQuestionValidationError
  extends Error {
  field:
    string | null;

  constructor(
    message:
      string,
    field:
      string | null =
      null
  ) {
    super(
      message
    );

    this.name =
      "AdminQuestionValidationError";

    this.field =
      field;
  }
}


export type AdminQuestionCreateData =
  Pick<
    NewQuestion,
    | "bank"
    | "subject"
    | "questionText"
    | "options"
    | "correctAnswer"
    | "explanation"
    | "difficulty"
    | "active"
    | "updatedAt"
  >;


export type AdminQuestionUpdates = {
  bank?:
    string;

  subject?:
    string;

  questionText?:
    string;

  options?:
    string;

  correctAnswer?:
    number;

  explanation?:
    string | null;

  difficulty?:
    QuestionDifficulty;

  active?:
    boolean;
};


function isPlainObject(
  value:
    unknown
): value is UnknownRecord {
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


function requireObject(
  input:
    unknown
): UnknownRecord {
  if (
    !isPlainObject(
      input
    )
  ) {
    throw new AdminQuestionValidationError(
      "O corpo da requisição deve ser um objeto JSON."
    );
  }

  return input;
}


function assertAllowedFields(
  body:
    UnknownRecord,
  allowed:
    readonly string[]
) {
  const allowedSet =
    new Set(
      allowed
    );

  for (
    const field of
      Object.keys(
        body
      )
  ) {
    if (
      !allowedSet.has(
        field
      )
    ) {
      throw new AdminQuestionValidationError(
        `Campo "${field}" não é permitido.`,
        field
      );
    }
  }
}


function requireText(
  value:
    unknown,
  field:
    string,
  label:
    string,
  maxLength:
    number
): string {
  if (
    typeof value !==
    "string"
  ) {
    throw new AdminQuestionValidationError(
      `${label} é obrigatório.`,
      field
    );
  }

  const normalized =
    value.trim();

  if (
    !normalized
  ) {
    throw new AdminQuestionValidationError(
      `${label} é obrigatório.`,
      field
    );
  }

  if (
    normalized.length >
    maxLength
  ) {
    throw new AdminQuestionValidationError(
      `${label} excede o tamanho máximo de ${maxLength} caracteres.`,
      field
    );
  }

  return normalized;
}


function optionalText(
  value:
    unknown,
  field:
    string,
  label:
    string,
  maxLength:
    number
): string | null {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return null;
  }

  if (
    typeof value !==
    "string"
  ) {
    throw new AdminQuestionValidationError(
      `${label} deve ser texto.`,
      field
    );
  }

  const normalized =
    value.trim();

  if (
    normalized.length >
    maxLength
  ) {
    throw new AdminQuestionValidationError(
      `${label} excede o tamanho máximo de ${maxLength} caracteres.`,
      field
    );
  }

  return normalized ||
    null;
}


function validateOptionsArray(
  value:
    unknown
): string[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    throw new AdminQuestionValidationError(
      "options deve ser um array de alternativas.",
      "options"
    );
  }


  if (
    value.length <
      2 ||
    value.length >
      5
  ) {
    throw new AdminQuestionValidationError(
      "A questão deve possuir entre 2 e 5 alternativas.",
      "options"
    );
  }


  const options =
    value.map(
      (
        option,
        index
      ) => {
        if (
          typeof option !==
          "string"
        ) {
          throw new AdminQuestionValidationError(
            `Alternativa ${index + 1} deve ser texto.`,
            "options"
          );
        }

        const normalized =
          option.trim();

        if (
          !normalized
        ) {
          throw new AdminQuestionValidationError(
            `Alternativa ${index + 1} não pode ser vazia.`,
            "options"
          );
        }

        if (
          normalized.length >
          2000
        ) {
          throw new AdminQuestionValidationError(
            `Alternativa ${index + 1} excede o tamanho permitido.`,
            "options"
          );
        }

        return normalized;
      }
    );


  if (
    new Set(
      options
    ).size !==
    options.length
  ) {
    throw new AdminQuestionValidationError(
      "As alternativas da questão não podem ser duplicadas.",
      "options"
    );
  }


  return options;
}


function validateCorrectAnswer(
  value:
    unknown,
  optionsLength?:
    number
): number {
  if (
    !Number.isInteger(
      value
    ) ||
    Number(
      value
    ) <
      0
  ) {
    throw new AdminQuestionValidationError(
      "correctAnswer deve ser um índice inteiro válido.",
      "correctAnswer"
    );
  }

  const correctAnswer =
    Number(
      value
    );

  if (
    optionsLength !==
      undefined &&
    correctAnswer >=
      optionsLength
  ) {
    throw new AdminQuestionValidationError(
      "correctAnswer aponta para uma alternativa inexistente.",
      "correctAnswer"
    );
  }

  return correctAnswer;
}


function validateDifficulty(
  value:
    unknown
): QuestionDifficulty {
  if (
    value !==
      "easy" &&
    value !==
      "medium" &&
    value !==
      "hard"
  ) {
    throw new AdminQuestionValidationError(
      'difficulty deve ser "easy", "medium" ou "hard".',
      "difficulty"
    );
  }

  return value;
}


export function validateAdminQuestionId(
  value:
    unknown
): number {
  let parsed:
    number;

  if (
    typeof value ===
      "number"
  ) {
    parsed =
      value;
  } else if (
    typeof value ===
      "string" &&
    /^\d+$/.test(
      value
    )
  ) {
    parsed =
      Number(
        value
      );
  } else {
    throw new AdminQuestionValidationError(
      "ID da questão inválido.",
      "id"
    );
  }

  if (
    !Number.isInteger(
      parsed
    ) ||
    parsed <=
      0
  ) {
    throw new AdminQuestionValidationError(
      "ID da questão inválido.",
      "id"
    );
  }

  return parsed;
}


export function parseStoredQuestionOptions(
  value:
    string
): string[] {
  let parsed:
    unknown;

  try {
    parsed =
      JSON.parse(
        value
      );
  } catch {
    throw new AdminQuestionValidationError(
      "As alternativas armazenadas da questão são inválidas.",
      "options"
    );
  }

  return validateOptionsArray(
    parsed
  );
}


export function assertValidAdminQuestionState(
  options:
    string,
  correctAnswer:
    number
) {
  const parsedOptions =
    parseStoredQuestionOptions(
      options
    );

  validateCorrectAnswer(
    correctAnswer,
    parsedOptions.length
  );
}


export function validateAdminQuestionCreate(
  input:
    unknown
): AdminQuestionCreateData {
  const body =
    requireObject(
      input
    );

  assertAllowedFields(
    body,
    [
      "bank",
      "subject",
      "questionText",
      "options",
      "correctAnswer",
      "explanation",
      "difficulty",
    ]
  );


  const options =
    validateOptionsArray(
      body.options
    );


  const correctAnswer =
    validateCorrectAnswer(
      body.correctAnswer,
      options.length
    );


  return {
    bank:
      requireText(
        body.bank,
        "bank",
        "Banca",
        120
      ),

    subject:
      requireText(
        body.subject,
        "subject",
        "Matéria",
        200
      ),

    questionText:
      requireText(
        body.questionText,
        "questionText",
        "Enunciado",
        15000
      ),

    options:
      JSON.stringify(
        options
      ),

    correctAnswer,

    explanation:
      optionalText(
        body.explanation,
        "explanation",
        "Explicação",
        15000
      ),

    difficulty:
      body.difficulty ===
        undefined
        ? "medium"
        : validateDifficulty(
            body.difficulty
          ),

    active:
      true,

    updatedAt:
      new Date()
        .toISOString(),
  };
}


export function validateAdminQuestionPatch(
  input:
    unknown
): {
  id:
    number;

  updates:
    AdminQuestionUpdates;
} {
  const body =
    requireObject(
      input
    );

  assertAllowedFields(
    body,
    [
      "id",
      "bank",
      "subject",
      "questionText",
      "options",
      "correctAnswer",
      "explanation",
      "difficulty",
      "active",
    ]
  );


  const id =
    validateAdminQuestionId(
      body.id
    );

  const updates:
    AdminQuestionUpdates =
    {};


  if (
    Object.hasOwn(
      body,
      "bank"
    )
  ) {
    updates.bank =
      requireText(
        body.bank,
        "bank",
        "Banca",
        120
      );
  }


  if (
    Object.hasOwn(
      body,
      "subject"
    )
  ) {
    updates.subject =
      requireText(
        body.subject,
        "subject",
        "Matéria",
        200
      );
  }


  if (
    Object.hasOwn(
      body,
      "questionText"
    )
  ) {
    updates.questionText =
      requireText(
        body.questionText,
        "questionText",
        "Enunciado",
        15000
      );
  }


  if (
    Object.hasOwn(
      body,
      "options"
    )
  ) {
    updates.options =
      JSON.stringify(
        validateOptionsArray(
          body.options
        )
      );
  }


  if (
    Object.hasOwn(
      body,
      "correctAnswer"
    )
  ) {
    updates.correctAnswer =
      validateCorrectAnswer(
        body.correctAnswer
      );
  }


  if (
    Object.hasOwn(
      body,
      "explanation"
    )
  ) {
    updates.explanation =
      optionalText(
        body.explanation,
        "explanation",
        "Explicação",
        15000
      );
  }


  if (
    Object.hasOwn(
      body,
      "difficulty"
    )
  ) {
    updates.difficulty =
      validateDifficulty(
        body.difficulty
      );
  }


  if (
    Object.hasOwn(
      body,
      "active"
    )
  ) {
    if (
      typeof body.active !==
      "boolean"
    ) {
      throw new AdminQuestionValidationError(
        'Campo "active" deve ser booleano.',
        "active"
      );
    }

    updates.active =
      body.active;
  }


  if (
    Object.keys(
      updates
    ).length ===
    0
  ) {
    throw new AdminQuestionValidationError(
      "Nenhum campo válido foi informado para atualização."
    );
  }


  return {
    id,
    updates,
  };
}