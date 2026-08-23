import {
  and,
  asc,
  eq,
  inArray,
} from "drizzle-orm";

import {
  getDb,
  getSqliteConnection,
} from "../db/index";

import {
  initDatabase,
} from "../db/init";

import {
  products,
  questions,
  simulationProducts,
  simulationQuestions,
  simulations,
  type Simulation,
} from "../db/schema";

import type {
  SimulationPublicationContext,
} from "./simulation-publication";


type PublicationOverrides = {
  simulation?:
    Partial<
      Pick<
        Simulation,
        | "title"
        | "bank"
        | "timeLimit"
      >
    >;

  productIds?:
    number[];

  questionIds?:
    number[];
};


export function parseSimulationQuestionOptions(
  value:
    string
): string[] {
  const parsed:
    unknown =
    JSON.parse(
      value
    );

  if (
    !Array.isArray(
      parsed
    ) ||
    parsed.length <
      2 ||
    !parsed.every(
      (
        option
      ) =>
        typeof option ===
          "string"
    )
  ) {
    throw new Error(
      "Questão possui alternativas inválidas no banco."
    );
  }

  return parsed;
}


export async function getSimulationProductIds(
  simulationId:
    number
): Promise<number[]> {
  await initDatabase();

  const db =
    getDb();

  const rows =
    await db
      .select({
        productId:
          simulationProducts.productId,
      })
      .from(
        simulationProducts
      )
      .where(
        eq(
          simulationProducts.simulationId,
          simulationId
        )
      )
      .orderBy(
        asc(
          simulationProducts.productId
        )
      )
      .all();

  return rows.map(
    (
      row
    ) =>
      row.productId
  );
}


export async function getSimulationQuestionIds(
  simulationId:
    number
): Promise<number[]> {
  await initDatabase();

  const db =
    getDb();

  const rows =
    await db
      .select({
        questionId:
          simulationQuestions.questionId,
      })
      .from(
        simulationQuestions
      )
      .where(
        eq(
          simulationQuestions.simulationId,
          simulationId
        )
      )
      .orderBy(
        asc(
          simulationQuestions.position
        )
      )
      .all();

  return rows.map(
    (
      row
    ) =>
      row.questionId
  );
}


export async function findMissingProductIds(
  productIds:
    number[]
): Promise<number[]> {
  if (
    productIds.length ===
    0
  ) {
    return [];
  }

  await initDatabase();

  const db =
    getDb();

  const existing =
    await db
      .select({
        id:
          products.id,
      })
      .from(
        products
      )
      .where(
        inArray(
          products.id,
          productIds
        )
      )
      .all();

  const existingIds =
    new Set(
      existing.map(
        (
          product
        ) =>
          product.id
      )
    );

  return productIds.filter(
    (
      id
    ) =>
      !existingIds.has(
        id
      )
  );
}


export async function findMissingQuestionIds(
  questionIds:
    number[]
): Promise<number[]> {
  if (
    questionIds.length ===
    0
  ) {
    return [];
  }

  await initDatabase();

  const db =
    getDb();

  const existing =
    await db
      .select({
        id:
          questions.id,
      })
      .from(
        questions
      )
      .where(
        inArray(
          questions.id,
          questionIds
        )
      )
      .all();

  const existingIds =
    new Set(
      existing.map(
        (
          question
        ) =>
          question.id
      )
    );

  return questionIds.filter(
    (
      id
    ) =>
      !existingIds.has(
        id
      )
  );
}


export async function replaceSimulationProductIds(
  simulationId:
    number,
  productIds:
    number[]
) {
  await initDatabase();

  const sqlite =
    getSqliteConnection();

  const replace =
    sqlite.transaction(
      () => {
        sqlite
          .prepare(`
            DELETE FROM simulation_products
            WHERE simulation_id = ?
          `)
          .run(
            simulationId
          );

        const insert =
          sqlite.prepare(`
            INSERT INTO simulation_products (
              simulation_id,
              product_id
            )
            VALUES (?, ?)
          `);

        for (
          const productId of
            productIds
        ) {
          insert.run(
            simulationId,
            productId
          );
        }
      }
    );

  replace();
}


export async function replaceSimulationQuestionIds(
  simulationId:
    number,
  questionIds:
    number[]
) {
  await initDatabase();

  const sqlite =
    getSqliteConnection();

  const replace =
    sqlite.transaction(
      () => {
        sqlite
          .prepare(`
            DELETE FROM simulation_questions
            WHERE simulation_id = ?
          `)
          .run(
            simulationId
          );

        const insert =
          sqlite.prepare(`
            INSERT INTO simulation_questions (
              simulation_id,
              question_id,
              position
            )
            VALUES (?, ?, ?)
          `);

        questionIds.forEach(
          (
            questionId,
            index
          ) => {
            insert.run(
              simulationId,
              questionId,
              index +
                1
            );
          }
        );
      }
    );

  replace();
}


export async function getSimulationPublicationContext(
  simulationId:
    number,
  overrides:
    PublicationOverrides =
    {}
): Promise<SimulationPublicationContext | null> {
  await initDatabase();

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
    return null;
  }


  const productIds =
    overrides.productIds ??
    await getSimulationProductIds(
      simulationId
    );


  const questionIds =
    overrides.questionIds ??
    await getSimulationQuestionIds(
      simulationId
    );


  const selectedQuestions =
    questionIds.length ===
      0
      ? []
      : await db
          .select({
            id:
              questions.id,

            active:
              questions.active,
          })
          .from(
            questions
          )
          .where(
            inArray(
              questions.id,
              questionIds
            )
          )
          .all();


  return {
    simulation: {
      title:
        overrides
          .simulation
          ?.title ??
        simulation.title,

      bank:
        overrides
          .simulation
          ?.bank ??
        simulation.bank,

      timeLimit:
        overrides
          .simulation
          ?.timeLimit ??
        simulation.timeLimit,
    },

    productIds,

    questionIds,

    questions:
      selectedQuestions.map(
        (
          question
        ) => ({
          id:
            question.id,

          active:
            question.active ===
            true,
        })
      ),
  };
}


export async function getSimulationQuestionRows(
  simulationId:
    number
) {
  await initDatabase();

  const db =
    getDb();

  return db
    .select({
      id:
        questions.id,

      subject:
        questions.subject,

      questionText:
        questions.questionText,

      options:
        questions.options,

      difficulty:
        questions.difficulty,

      correctAnswer:
        questions.correctAnswer,

      explanation:
        questions.explanation,

      active:
        questions.active,

      position:
        simulationQuestions.position,
    })
    .from(
      simulationQuestions
    )
    .innerJoin(
      questions,
      eq(
        questions.id,
        simulationQuestions.questionId
      )
    )
    .where(
      eq(
        simulationQuestions.simulationId,
        simulationId
      )
    )
    .orderBy(
      asc(
        simulationQuestions.position
      )
    )
    .all();
}


export async function getActiveSimulationIdsUsingQuestion(
  questionId:
    number
): Promise<number[]> {
  await initDatabase();

  const db =
    getDb();

  const rows =
    await db
      .select({
        simulationId:
          simulations.id,
      })
      .from(
        simulationQuestions
      )
      .innerJoin(
        simulations,
        eq(
          simulations.id,
          simulationQuestions.simulationId
        )
      )
      .where(
        and(
          eq(
            simulationQuestions.questionId,
            questionId
          ),

          eq(
            simulations.active,
            true
          )
        )
      )
      .all();

  return Array.from(
    new Set(
      rows.map(
        (
          row
        ) =>
          row.simulationId
      )
    )
  );
}