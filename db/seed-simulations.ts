import {
  pathToFileURL,
} from "node:url";

import {
  initDatabase,
} from "./init";

import {
  getDb,
} from "./index";

import {
  questions,
  simulationQuestions,
  simulations,
  type NewQuestion,
} from "./schema";


/**
 * Formato utilizado exclusivamente pelo seed.
 *
 * No SQLite, options é armazenado como JSON em TEXT.
 * No arquivo de seed mantemos string[] por legibilidade
 * e serializamos apenas no momento da inserção.
 */
type SeedQuestion =
  Omit<
    NewQuestion,
    | "options"
    | "id"
    | "createdAt"
    | "difficulty"
  > & {
    options:
      string[];

    difficulty:
      NonNullable<
        NewQuestion["difficulty"]
      >;
  };


type SeedSimulationInput = {
  title:
    string;

  bank:
    string;

  description:
    string;

  timeLimit:
    number;

  questionIds:
    number[];
};


/**
 * Cria um simulado de desenvolvimento no formato
 * normalizado da Fase 4.
 *
 * IMPORTANTE:
 *
 * - simulations.question_ids recebe apenas "[]";
 * - simulation_questions é a fonte de verdade;
 * - active=false;
 * - nenhuma apostila é vinculada automaticamente.
 *
 * O administrador deverá escolher explicitamente
 * quais produtos liberam o simulado antes de publicá-lo.
 */
async function createDraftSimulation(
  input:
    SeedSimulationInput
) {
  const db =
    getDb();

  const now =
    new Date()
      .toISOString();


  const inserted =
    await db
      .insert(
        simulations
      )
      .values({
        title:
          input.title,

        bank:
          input.bank,

        description:
          input.description,

        timeLimit:
          input.timeLimit,

        /**
         * Campo legado.
         *
         * Não é mais utilizado como fonte de verdade.
         */
        questionIds:
          "[]",

        /**
         * Seed nunca publica conteúdo automaticamente.
         *
         * Ainda falta associação explícita com produto.
         */
        active:
          false,

        publishedAt:
          null,

        updatedAt:
          now,
      })
      .returning();


  const simulation =
    inserted[0];


  if (
    !simulation
  ) {
    throw new Error(
      `Falha ao criar o simulado "${input.title}".`
    );
  }


  if (
    input.questionIds.length >
    0
  ) {
    await db
      .insert(
        simulationQuestions
      )
      .values(
        input.questionIds.map(
          (
            questionId,
            index
          ) => ({
            simulationId:
              simulation.id,

            questionId,

            /**
             * position é 1-based.
             */
            position:
              index +
              1,
          })
        )
      );
  }


  return simulation;
}


export async function seedSimulations() {
  console.log(
    "🌱 Iniciando seed de simulados e questões..."
  );


  await initDatabase();

  const db =
    getDb();


  // ============================================================
  // QUESTÕES
  // ============================================================

  const existingQuestions =
    await db
      .select()
      .from(
        questions
      )
      .all();


  let allQuestions =
    existingQuestions;


  if (
    existingQuestions.length >
    0
  ) {
    console.log(
      `ℹ️ Já existem ${existingQuestions.length} questões. Pulando seed de questões.`
    );
  } else {
    console.log(
      "❓ Criando questões de teste..."
    );


    const now =
      new Date()
        .toISOString();


    const questionsData:
      SeedQuestion[] =
      [
        {
          bank:
            "Cesgranrio",

          subject:
            "Língua Portuguesa",

          questionText:
            "Na frase 'O relatório foi feito pelos analistas', a voz verbal é:",

          options: [
            "Ativa",
            "Passiva analítica",
            "Passiva sintética",
            "Reflexiva",
          ],

          correctAnswer:
            1,

          explanation:
            "A voz passiva analítica é formada por verbo ser + particípio, com sujeito paciente.",

          difficulty:
            "medium",

          active:
            true,

          updatedAt:
            now,
        },

        {
          bank:
            "Cesgranrio",

          subject:
            "Língua Portuguesa",

          questionText:
            "A alternativa em que a concordância verbal está CORRETA é:",

          options: [
            "Fazem dois anos que estudo.",
            "Houveram muitos candidatos.",
            "Existem várias possibilidades.",
            "Aluga-se apartamentos.",
          ],

          correctAnswer:
            2,

          explanation:
            "O verbo 'existir' concorda com o sujeito 'várias possibilidades' no plural.",

          difficulty:
            "easy",

          active:
            true,

          updatedAt:
            now,
        },

        {
          bank:
            "Cesgranrio",

          subject:
            "Raciocínio Lógico",

          questionText:
            "Se todo A é B, e nenhum B é C, então:",

          options: [
            "Todo A é C",
            "Nenhum A é C",
            "Algum A é C",
            "Todo C é A",
          ],

          correctAnswer:
            1,

          explanation:
            "Se todo A é B e nenhum B é C, então por transitividade nenhum A pode ser C.",

          difficulty:
            "medium",

          active:
            true,

          updatedAt:
            now,
        },

        {
          bank:
            "Cesgranrio",

          subject:
            "Raciocínio Lógico",

          questionText:
            "A negação de 'todos os alunos estudam' é:",

          options: [
            "Nenhum aluno estuda",
            "Alguns alunos não estudam",
            "Todos os alunos não estudam",
            "Existem alunos que estudam",
          ],

          correctAnswer:
            1,

          explanation:
            "A negação de uma proposição universal afirmativa é uma proposição particular negativa.",

          difficulty:
            "easy",

          active:
            true,

          updatedAt:
            now,
        },

        {
          bank:
            "Cesgranrio",

          subject:
            "Informática",

          questionText:
            "No Excel, a função utilizada para somar valores condicionais é:",

          options: [
            "SOMA",
            "SOMASE",
            "CONT.SE",
            "MÉDIASE",
          ],

          correctAnswer:
            1,

          explanation:
            "A função SOMASE (ou SOMASES) soma células que atendem a um critério especificado.",

          difficulty:
            "easy",

          active:
            true,

          updatedAt:
            now,
        },

        {
          bank:
            "Cesgranrio",

          subject:
            "Direito Administrativo",

          questionText:
            "O princípio da impessoalidade na administração pública tem como consequência:",

          options: [
            "A proibição de promoção pessoal de autoridades",
            "A exigência de licitação",
            "O controle judicial dos atos",
            "A publicidade dos atos administrativos",
          ],

          correctAnswer:
            0,

          explanation:
            "A impessoalidade veda a promoção pessoal de agentes públicos em obras e serviços.",

          difficulty:
            "hard",

          active:
            true,

          updatedAt:
            now,
        },

        {
          bank:
            "Cebraspe",

          subject:
            "Língua Portuguesa",

          questionText:
            "Julgue: Na frase 'Embora estudasse muito, não passou', a oração subordinada é concessiva.",

          options: [
            "Certo",
            "Errado",
          ],

          correctAnswer:
            0,

          explanation:
            "A conjunção 'embora' introduz oração subordinada adverbial concessiva.",

          difficulty:
            "medium",

          active:
            true,

          updatedAt:
            now,
        },

        {
          bank:
            "Cebraspe",

          subject:
            "Direito Constitucional",

          questionText:
            "Julgue: Os direitos fundamentais têm aplicabilidade imediata, conforme art. 5º, § 1º, da CF.",

          options: [
            "Certo",
            "Errado",
          ],

          correctAnswer:
            0,

          explanation:
            "O § 1º do art. 5º da CF estabelece que as normas definidoras de direitos e garantias fundamentais têm aplicabilidade imediata.",

          difficulty:
            "easy",

          active:
            true,

          updatedAt:
            now,
        },
      ];


    for (
      const question of
        questionsData
    ) {
      const questionToInsert:
        NewQuestion =
        {
          ...question,

          options:
            JSON.stringify(
              question.options
            ),
        };


      await db
        .insert(
          questions
        )
        .values(
          questionToInsert
        );


      console.log(
        `  ✅ Questão criada: ${question.subject} (${question.bank})`
      );
    }


    allQuestions =
      await db
        .select()
        .from(
          questions
        )
        .all();


    console.log(
      `  ✅ Total: ${allQuestions.length} questões criadas`
    );
  }


  // ============================================================
  // SIMULADOS
  // ============================================================

  const existingSimulations =
    await db
      .select()
      .from(
        simulations
      )
      .all();


  if (
    existingSimulations.length >
    0
  ) {
    console.log(
      `ℹ️ Já existem ${existingSimulations.length} simulados. Pulando seed de simulados.`
    );
  } else {
    console.log(
      "📝 Criando simulados em modo rascunho..."
    );


    /**
     * Questões arquivadas jamais entram em um novo
     * simulado criado pelo seed.
     */
    const activeQuestions =
      allQuestions.filter(
        (
          question
        ) =>
          question.active ===
          true
      );


    const cesgranrioQuestions =
      activeQuestions.filter(
        (
          question
        ) =>
          question.bank ===
          "Cesgranrio"
      );


    const cebraspeQuestions =
      activeQuestions.filter(
        (
          question
        ) =>
          question.bank ===
          "Cebraspe"
      );


    // ==========================================================
    // SIMULADO CESGRANRIO
    // ==========================================================

    if (
      cesgranrioQuestions.length >=
      3
    ) {
      const selectedIds =
        cesgranrioQuestions
          .slice(
            0,
            6
          )
          .map(
            (
              question
            ) =>
              question.id
          );


      const simulation =
        await createDraftSimulation({
          title:
            "Transpetro - Cesgranrio Simulado 01",

          bank:
            "Cesgranrio",

          description:
            "Simulado no estilo Cesgranrio com questões de português, raciocínio e informática.",

          timeLimit:
            30,

          questionIds:
            selectedIds,
        });


      console.log(
        `  ✅ Simulado rascunho criado: ${simulation.title}`
      );

      console.log(
        `     ${selectedIds.length} questão(ões) vinculada(s) via simulation_questions`
      );

      console.log(
        "     ⚠️ Nenhuma apostila vinculada automaticamente."
      );
    }


    // ==========================================================
    // SIMULADO CEBRASPE
    // ==========================================================

    if (
      cebraspeQuestions.length >=
      2
    ) {
      const selectedIds =
        cebraspeQuestions.map(
          (
            question
          ) =>
            question.id
        );


      const simulation =
        await createDraftSimulation({
          title:
            "Estilo Cebraspe - Certo/Errado",

          bank:
            "Cebraspe",

          description:
            "Simulado no padrão certo/errado da banca Cebraspe.",

          timeLimit:
            20,

          questionIds:
            selectedIds,
        });


      console.log(
        `  ✅ Simulado rascunho criado: ${simulation.title}`
      );

      console.log(
        `     ${selectedIds.length} questão(ões) vinculada(s) via simulation_questions`
      );

      console.log(
        "     ⚠️ Nenhuma apostila vinculada automaticamente."
      );
    }
  }


  console.log(
    "✅ Seed de simulados concluído."
  );
}


// ============================================================
// EXECUÇÃO DIRETA
// ============================================================

const executedDirectly =
  Boolean(
    process.argv[1]
  ) &&
  import.meta.url ===
    pathToFileURL(
      process.argv[1]
    ).href;


if (
  executedDirectly
) {
  seedSimulations()
    .then(
      () => {
        process.exit(
          0
        );
      }
    )
    .catch(
      (
        error
      ) => {
        console.error(
          "❌ Falha:",
          error
        );

        process.exit(
          1
        );
      }
    );
}