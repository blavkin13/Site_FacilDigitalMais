import type {
  Question,
  Simulation,
} from "../db/schema";


export type SimulationPublicationIssue = {
  field:
    | "title"
    | "bank"
    | "timeLimit"
    | "products"
    | "questions";

  message:
    string;
};


type PublishableSimulation =
  Pick<
    Simulation,
    | "title"
    | "bank"
    | "timeLimit"
  >;


type PublicationQuestion =
  Pick<
    Question,
    | "id"
    | "active"
  >;


export type SimulationPublicationContext = {
  simulation:
    PublishableSimulation;

  productIds:
    number[];

  questionIds:
    number[];

  questions:
    PublicationQuestion[];
};


function hasText(
  value:
    string | null | undefined
): boolean {
  return (
    typeof value ===
      "string" &&
    value.trim().length >
      0
  );
}


function uniquePositiveIds(
  values:
    number[]
): number[] {
  return Array.from(
    new Set(
      values.filter(
        (
          value
        ) =>
          Number.isInteger(
            value
          ) &&
          value >
            0
      )
    )
  );
}


/**
 * Validação editorial central do Simulado.
 *
 * O frontend utilizará a mesma regra para exibir
 * o checklist de publicação, enquanto a API
 * administrativa repetirá a validação de forma
 * independente antes de publicar.
 */
export function getSimulationPublicationIssues(
  context:
    SimulationPublicationContext
): SimulationPublicationIssue[] {
  const issues:
    SimulationPublicationIssue[] =
    [];


  if (
    !hasText(
      context
        .simulation
        .title
    )
  ) {
    issues.push({
      field:
        "title",

      message:
        "Título é obrigatório para publicação.",
    });
  }


  if (
    !hasText(
      context
        .simulation
        .bank
    )
  ) {
    issues.push({
      field:
        "bank",

      message:
        "Banca é obrigatória para publicação.",
    });
  }


  if (
    !Number.isInteger(
      context
        .simulation
        .timeLimit
    ) ||
    context
      .simulation
      .timeLimit <=
      0
  ) {
    issues.push({
      field:
        "timeLimit",

      message:
        "Tempo de prova deve ser maior que zero.",
    });
  }


  const productIds =
    uniquePositiveIds(
      context.productIds
    );


  if (
    productIds.length ===
    0
  ) {
    issues.push({
      field:
        "products",

      message:
        "Associe pelo menos uma apostila ao simulado.",
    });
  }


  const questionIds =
    uniquePositiveIds(
      context.questionIds
    );


  if (
    questionIds.length ===
    0
  ) {
    issues.push({
      field:
        "questions",

      message:
        "Adicione pelo menos uma questão ao simulado.",
    });


    return issues;
  }


  const existingQuestionIds =
    new Set(
      context
        .questions
        .map(
          (
            question
          ) =>
            question.id
        )
    );


  const missingQuestionIds =
    questionIds.filter(
      (
        questionId
      ) =>
        !existingQuestionIds.has(
          questionId
        )
    );


  if (
    missingQuestionIds.length >
    0
  ) {
    issues.push({
      field:
        "questions",

      message:
        missingQuestionIds.length ===
        1
          ? "Uma questão selecionada não existe mais."
          : `${missingQuestionIds.length} questões selecionadas não existem mais.`,
    });
  }


  const inactiveQuestionIds =
    context
      .questions
      .filter(
        (
          question
        ) =>
          questionIds.includes(
            question.id
          ) &&
          question.active !==
            true
      )
      .map(
        (
          question
        ) =>
          question.id
      );


  if (
    inactiveQuestionIds.length >
    0
  ) {
    issues.push({
      field:
        "questions",

      message:
        inactiveQuestionIds.length ===
        1
          ? "Uma questão selecionada está arquivada."
          : `${inactiveQuestionIds.length} questões selecionadas estão arquivadas.`,
    });
  }


  return issues;
}


export function isSimulationReadyForPublication(
  context:
    SimulationPublicationContext
): boolean {
  return (
    getSimulationPublicationIssues(
      context
    ).length ===
    0
  );
}