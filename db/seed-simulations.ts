import { pathToFileURL } from "node:url";

import {
  initDatabase,
} from "./init";

import {
  getDb,
} from "./index";

import {
  questions,
  simulations,
  type NewQuestion,
} from "./schema";

/**
 * Formato utilizado exclusivamente pelo seed.
 *
 * No banco, "options" é armazenado como JSON em uma coluna TEXT.
 * Porém, no arquivo de seed é mais seguro e legível trabalhar
 * com um array de strings e serializá-lo somente no momento
 * da inserção.
 *
 * O tipo de "difficulty" é derivado diretamente do schema
 * Drizzle para impedir valores inválidos.
 */
type SeedQuestion = Omit<
  NewQuestion,
  "options" | "id" | "createdAt" | "difficulty"
> & {
  options: string[];
  difficulty: NonNullable<
    NewQuestion["difficulty"]
  >;
};

export async function seedSimulations() {
  console.log(
    "🌱 Iniciando seed de simulados e questões..."
  );

  await initDatabase();

  const db = getDb();

  // ============================================================
  // QUESTÕES
  // ============================================================

  const existingQuestions = await db
    .select()
    .from(questions)
    .all();

  let allQuestions = existingQuestions;

  if (existingQuestions.length > 0) {
    console.log(
      `ℹ️  Já existem ${existingQuestions.length} questões. Pulando seed de questões.`
    );
  } else {
    console.log(
      "❓ Criando questões de teste..."
    );

    /**
     * O tipo explícito SeedQuestion é importante.
     *
     * Sem ele, o TypeScript pode inferir:
     *
     *   difficulty: string
     *
     * em vez de:
     *
     *   "easy" | "medium" | "hard"
     *
     * o que não é aceito pelo schema Drizzle.
     */
    const questionsData: SeedQuestion[] = [
      {
        bank: "Cesgranrio",
        subject: "Língua Portuguesa",
        questionText:
          "Na frase 'O relatório foi feito pelos analistas', a voz verbal é:",
        options: [
          "Ativa",
          "Passiva analítica",
          "Passiva sintética",
          "Reflexiva",
        ],
        correctAnswer: 1,
        explanation:
          "A voz passiva analítica é formada por verbo ser + particípio, com sujeito paciente.",
        difficulty: "medium",
      },
      {
        bank: "Cesgranrio",
        subject: "Língua Portuguesa",
        questionText:
          "A alternativa em que a concordância verbal está CORRETA é:",
        options: [
          "Fazem dois anos que estudo.",
          "Houveram muitos candidatos.",
          "Existem várias possibilidades.",
          "Aluga-se apartamentos.",
        ],
        correctAnswer: 2,
        explanation:
          "O verbo 'existir' concorda com o sujeito 'várias possibilidades' no plural.",
        difficulty: "easy",
      },
      {
        bank: "Cesgranrio",
        subject: "Raciocínio Lógico",
        questionText:
          "Se todo A é B, e nenhum B é C, então:",
        options: [
          "Todo A é C",
          "Nenhum A é C",
          "Algum A é C",
          "Todo C é A",
        ],
        correctAnswer: 1,
        explanation:
          "Se todo A é B e nenhum B é C, então por transitividade nenhum A pode ser C.",
        difficulty: "medium",
      },
      {
        bank: "Cesgranrio",
        subject: "Raciocínio Lógico",
        questionText:
          "A negação de 'todos os alunos estudam' é:",
        options: [
          "Nenhum aluno estuda",
          "Alguns alunos não estudam",
          "Todos os alunos não estudam",
          "Existem alunos que estudam",
        ],
        correctAnswer: 1,
        explanation:
          "A negação de uma proposição universal afirmativa é uma proposição particular negativa.",
        difficulty: "easy",
      },
      {
        bank: "Cesgranrio",
        subject: "Informática",
        questionText:
          "No Excel, a função utilizada para somar valores condicionais é:",
        options: [
          "SOMA",
          "SOMASE",
          "CONT.SE",
          "MÉDIASE",
        ],
        correctAnswer: 1,
        explanation:
          "A função SOMASE (ou SOMASES) soma células que atendem a um critério especificado.",
        difficulty: "easy",
      },
      {
        bank: "Cesgranrio",
        subject: "Direito Administrativo",
        questionText:
          "O princípio da impessoalidade na administração pública tem como consequência:",
        options: [
          "A proibição de promoção pessoal de autoridades",
          "A exigência de licitação",
          "O controle judicial dos atos",
          "A publicidade dos atos administrativos",
        ],
        correctAnswer: 0,
        explanation:
          "A impessoalidade veda a promoção pessoal de agentes públicos em obras e serviços.",
        difficulty: "hard",
      },
      {
        bank: "Cebraspe",
        subject: "Língua Portuguesa",
        questionText:
          "Julgue: Na frase 'Embora estudasse muito, não passou', a oração subordinada é concessiva.",
        options: [
          "Certo",
          "Errado",
        ],
        correctAnswer: 0,
        explanation:
          "A conjunção 'embora' introduz oração subordinada adverbial concessiva.",
        difficulty: "medium",
      },
      {
        bank: "Cebraspe",
        subject: "Direito Constitucional",
        questionText:
          "Julgue: Os direitos fundamentais têm aplicabilidade imediata, conforme art. 5º, § 1º, da CF.",
        options: [
          "Certo",
          "Errado",
        ],
        correctAnswer: 0,
        explanation:
          "O § 1º do art. 5º da CF estabelece que as normas definidoras de direitos e garantias fundamentais têm aplicabilidade imediata.",
        difficulty: "easy",
      },
    ];

    /**
     * Inserção individual.
     *
     * Antes de enviar ao Drizzle, convertemos options[]
     * para a representação JSON persistida no SQLite.
     */
    for (const question of questionsData) {
      const questionToInsert: NewQuestion = {
        ...question,
        options: JSON.stringify(
          question.options
        ),
      };

      await db
        .insert(questions)
        .values(questionToInsert);

      console.log(
        `  ✅ Questão criada: ${question.subject} (${question.bank})`
      );
    }

    allQuestions = await db
      .select()
      .from(questions)
      .all();

    console.log(
      `  ✅ Total: ${allQuestions.length} questões criadas`
    );
  }

  // ============================================================
  // SIMULADOS
  // ============================================================

  const existingSimulations = await db
    .select()
    .from(simulations)
    .all();

  if (
    existingSimulations.length > 0
  ) {
    console.log(
      `ℹ️  Já existem ${existingSimulations.length} simulados. Pulando seed de simulados.`
    );
  } else {
    console.log(
      "📝 Criando simulados..."
    );

    const cesgranrioQuestions =
      allQuestions.filter(
        (question) =>
          question.bank ===
          "Cesgranrio"
      );

    const cebraspeQuestions =
      allQuestions.filter(
        (question) =>
          question.bank ===
          "Cebraspe"
      );

    // ==========================================================
    // SIMULADO CESGRANRIO
    // ==========================================================

    if (
      cesgranrioQuestions.length >= 3
    ) {
      await db
        .insert(simulations)
        .values({
          title:
            "Transpetro - Cesgranrio Simulado 01",

          bank:
            "Cesgranrio",

          description:
            "Simulado no estilo Cesgranrio com questões de português, raciocínio e informática.",

          timeLimit:
            30,

          questionIds:
            JSON.stringify(
              cesgranrioQuestions
                .slice(0, 6)
                .map(
                  (question) =>
                    question.id
                )
            ),

          active:
            true,
        });

      console.log(
        "  ✅ Simulado criado: Transpetro - Cesgranrio Simulado 01"
      );
    }

    // ==========================================================
    // SIMULADO CEBRASPE
    // ==========================================================

    if (
      cebraspeQuestions.length >= 2
    ) {
      await db
        .insert(simulations)
        .values({
          title:
            "Estilo Cebraspe - Certo/Errado",

          bank:
            "Cebraspe",

          description:
            "Simulado no padrão certo/errado da banca Cebraspe.",

          timeLimit:
            20,

          questionIds:
            JSON.stringify(
              cebraspeQuestions.map(
                (question) =>
                  question.id
              )
            ),

          active:
            true,
        });

      console.log(
        "  ✅ Simulado criado: Estilo Cebraspe - Certo/Errado"
      );
    }
  }

  console.log(
    "✅ Seed de simulados concluído!"
  );
}

// ============================================================
// EXECUÇÃO DIRETA
// ============================================================

const executedDirectly =
  Boolean(process.argv[1]) &&
  import.meta.url ===
    pathToFileURL(
      process.argv[1]
    ).href;

if (executedDirectly) {
  seedSimulations()
    .then(() => {
      console.log(
        "✅ Seed de simulados concluído!"
      );

      process.exit(0);
    })
    .catch((error) => {
      console.error(
        "❌ Falha:",
        error
      );

      process.exit(1);
    });
}