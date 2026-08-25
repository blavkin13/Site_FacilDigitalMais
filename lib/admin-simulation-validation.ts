import type {
  NewSimulation,
} from "../db/schema";


type UnknownRecord =
  Record<
    string,
    unknown
  >;


export class AdminSimulationValidationError
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
      "AdminSimulationValidationError";

    this.field =
      field;
  }
}


export type AdminSimulationCreateData =
  Pick<
    NewSimulation,
    | "title"
    | "bank"
    | "description"
    | "timeLimit"
    | "questionIds"
    | "active"
    | "updatedAt"
  >;


export type AdminSimulationUpdates = {
  title?:
    string;

  bank?:
    string;

  description?:
    string | null;

  timeLimit?:
    number;

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
  value:
    unknown
): UnknownRecord {
  if (
    !isPlainObject(
      value
    )
  ) {
    throw new AdminSimulationValidationError(
      "O corpo da requisição deve ser um objeto JSON."
    );
  }

  return value;
}


function assertAllowedFields(
  value:
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
        value
      )
  ) {
    if (
      !allowedSet.has(
        field
      )
    ) {
      throw new AdminSimulationValidationError(
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
    throw new AdminSimulationValidationError(
      `${label} é obrigatório.`,
      field
    );
  }

  const normalized =
    value.trim();

  if (
    !normalized
  ) {
    throw new AdminSimulationValidationError(
      `${label} é obrigatório.`,
      field
    );
  }

  if (
    normalized.length >
    maxLength
  ) {
    throw new AdminSimulationValidationError(
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
    throw new AdminSimulationValidationError(
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
    throw new AdminSimulationValidationError(
      `${label} excede o tamanho máximo de ${maxLength} caracteres.`,
      field
    );
  }

  return normalized ||
    null;
}


function requireTimeLimit(
  value:
    unknown
): number {
  if (
    !Number.isInteger(
      value
    ) ||
    Number(
      value
    ) <=
      0 ||
    Number(
      value
    ) >
      1440
  ) {
    throw new AdminSimulationValidationError(
      "O tempo do simulado deve ser um número inteiro entre 1 e 1440 minutos.",
      "timeLimit"
    );
  }

  return Number(
    value
  );
}


function requireBoolean(
  value:
    unknown,
  field:
    string
): boolean {
  if (
    typeof value !==
    "boolean"
  ) {
    throw new AdminSimulationValidationError(
      `Campo "${field}" deve ser booleano.`,
      field
    );
  }

  return value;
}


export function validateAdminSimulationId(
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
    throw new AdminSimulationValidationError(
      "ID do simulado inválido.",
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
    throw new AdminSimulationValidationError(
      "ID do simulado inválido.",
      "id"
    );
  }

  return parsed;
}


export function validateAdminSimulationCreate(
  input:
    unknown
): AdminSimulationCreateData {
  const body =
    requireObject(
      input
    );

  assertAllowedFields(
    body,
    [
      "title",
      "bank",
      "description",
      "timeLimit",
    ]
  );

  const now =
    new Date()
      .toISOString();

  return {
    title:
      requireText(
        body.title,
        "title",
        "Título",
        200
      ),

    bank:
      requireText(
        body.bank,
        "bank",
        "Banca",
        120
      ),

    description:
      optionalText(
        body.description,
        "description",
        "Descrição",
        5000
      ),

    timeLimit:
      requireTimeLimit(
        body.timeLimit
      ),

    /**
     * Compatibilidade somente.
     *
     * O runtime novo nunca usará esta coluna
     * como fonte de verdade.
     */
    questionIds:
      "[]",

    /**
     * Todo simulado administrativo nasce
     * como rascunho.
     */
    active:
      false,

    updatedAt:
      now,
  };
}


export function validateAdminSimulationPatch(
  input:
    unknown
): {
  id:
    number;

  updates:
    AdminSimulationUpdates;
} {
  const body =
    requireObject(
      input
    );

  assertAllowedFields(
    body,
    [
      "id",
      "title",
      "bank",
      "description",
      "timeLimit",
      "active",
    ]
  );

  const id =
    validateAdminSimulationId(
      body.id
    );

  const updates:
    AdminSimulationUpdates =
    {};


  if (
    Object.hasOwn(
      body,
      "title"
    )
  ) {
    updates.title =
      requireText(
        body.title,
        "title",
        "Título",
        200
      );
  }


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
      "description"
    )
  ) {
    updates.description =
      optionalText(
        body.description,
        "description",
        "Descrição",
        5000
      );
  }


  if (
    Object.hasOwn(
      body,
      "timeLimit"
    )
  ) {
    updates.timeLimit =
      requireTimeLimit(
        body.timeLimit
      );
  }


  if (
    Object.hasOwn(
      body,
      "active"
    )
  ) {
    updates.active =
      requireBoolean(
        body.active,
        "active"
      );
  }


  if (
    Object.keys(
      updates
    ).length ===
    0
  ) {
    throw new AdminSimulationValidationError(
      "Nenhum campo válido foi informado para atualização."
    );
  }


  return {
    id,
    updates,
  };
}


export function validateAdminRelationIdsBody(
  input:
    unknown,
  field:
    "productIds" |
    "questionIds"
): number[] {
  const body =
    requireObject(
      input
    );

  assertAllowedFields(
    body,
    [
      field,
    ]
  );


  if (
    !Object.hasOwn(
      body,
      field
    ) ||
    !Array.isArray(
      body[field]
    )
  ) {
    throw new AdminSimulationValidationError(
      `Campo "${field}" deve ser um array.`,
      field
    );
  }


  if (
    body[field].length >
    1000
  ) {
    throw new AdminSimulationValidationError(
      `Campo "${field}" excede o limite permitido.`,
      field
    );
  }


  const ids =
    body[field].map(
      (
        value
      ) => {
        if (
          !Number.isInteger(
            value
          ) ||
          Number(
            value
          ) <=
            0
        ) {
          throw new AdminSimulationValidationError(
            `Campo "${field}" contém um ID inválido.`,
            field
          );
        }

        return Number(
          value
        );
      }
    );


  if (
    new Set(
      ids
    ).size !==
    ids.length
  ) {
    throw new AdminSimulationValidationError(
      `Campo "${field}" não pode conter IDs duplicados.`,
      field
    );
  }


  return ids;
}