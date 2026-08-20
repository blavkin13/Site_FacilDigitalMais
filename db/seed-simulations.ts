import { initDatabase } from "./init.js";
import { getDb } from "./index.js";
import { questions, simulations } from "./schema.js";

export async function seedSimulations() {
  console.log("🌱 Iniciando seed de simulados e questões...");

  await initDatabase();
  const db = getDb();

  // Verificar se já existem questões
  const existingQuestions = await db.select().from(questions).all();
  let allQuestions = existingQuestions;

  if (existingQuestions.length > 0) {
    console.log(`ℹ️  Já existem ${existingQuestions.length} questões. Pulando seed de questões.`);
  } else {
    console.log("❓ Criando questões de teste...");

    const questionsData = [
      {
        bank: "Cesgranrio",
        subject: "Língua Portuguesa",
        questionText: "Na frase 'O relatório foi feito pelos analistas', a voz verbal é:",
        options: ["Ativa", "Passiva analítica", "Passiva sintética", "Reflexiva"],
        correctAnswer: 1,
        explanation: "A voz passiva analítica é formada por verbo ser + particípio, com sujeito paciente.",
        difficulty: "medium",
      },
      {
        bank: "Cesgranrio",
        subject: "Língua Portuguesa",
        questionText: "A alternativa em que a concordância verbal está CORRETA é:",
        options: [
          "Fazem dois anos que estudo.",
          "Houveram muitos candidatos.",
          "Existem várias possibilidades.",
          "Aluga-se apartamentos."
        ],
        correctAnswer: 2,
        explanation: "O verbo 'existir' concorda com o sujeito 'várias possibilidades' no plural.",
        difficulty: "easy",
      },
      {
        bank: "Cesgranrio",
        subject: "Raciocínio Lógico",
        questionText: "Se todo A é B, e nenhum B é C, então:",
        options: [
          "Todo A é C",
          "Nenhum A é C",
          "Algum A é C",
          "Todo C é A"
        ],
        correctAnswer: 1,
        explanation: "Se todo A é B e nenhum B é C, então por transitividade nenhum A pode ser C.",
        difficulty: "medium",
      },
      {
        bank: "Cesgranrio",
        subject: "Raciocínio Lógico",
        questionText: "A negação de 'todos os alunos estudam' é:",
        options: [
          "Nenhum aluno estuda",
          "Alguns alunos não estudam",
          "Todos os alunos não estudam",
          "Existem alunos que estudam"
        ],
        correctAnswer: 1,
        explanation: "A negação de uma proposição universal afirmativa é uma proposição particular negativa.",
        difficulty: "easy",
      },
      {
        bank: "Cesgranrio",
        subject: "Informática",
        questionText: "No Excel, a função utilizada para somar valores condicionais é:",
        options: ["SOMA", "SOMASE", "CONT.SE", "MÉDIASE"],
        correctAnswer: 1,
        explanation: "A função SOMASE (ou SOMASES) soma células que atendem a um critério especificado.",
        difficulty: "easy",
      },
      {
        bank: "Cesgranrio",
        subject: "Direito Administrativo",
        questionText: "O princípio da impessoalidade na administração pública tem como consequência:",
        options: [
          "A proibição de promoção pessoal de autoridades",
          "A exigência de licitação",
          "O controle judicial dos atos",
          "A publicidade dos atos administrativos"
        ],
        correctAnswer: 0,
        explanation: "A impessoalidade veda a promoção pessoal de agentes públicos em obras e serviços.",
        difficulty: "hard",
      },
      {
        bank: "Cebraspe",
        subject: "Língua Portuguesa",
        questionText: "Julgue: Na frase 'Embora estudasse muito, não passou', a oração subordinada é concessiva.",
        options: ["Certo", "Errado"],
        correctAnswer: 0,
        explanation: "A conjunção 'embora' introduz oração subordinada adverbial concessiva.",
        difficulty: "medium",
      },
      {
        bank: "Cebraspe",
        subject: "Direito Constitucional",
        questionText: "Julgue: Os direitos fundamentais têm aplicabilidade imediata, conforme art. 5º, § 1º, da CF.",
        options: ["Certo", "Errado"],
        correctAnswer: 0,
        explanation: "O § 1º do art. 5º da CF estabelece que as normas definidoras de direitos e garantias fundamentais têm aplicabilidade imediata.",
        difficulty: "easy",
      },
    ];

    // Inserir UMA POR UMA (evita problemas de bulk insert no SQLite)
    for (const q of questionsData) {
      await db.insert(questions).values({
        ...q,
        options: JSON.stringify(q.options),
      });
      console.log(`  ✅ Questão criada: ${q.subject} (${q.bank})`);
    }

    // Buscar todas as questões recém-criadas
    allQuestions = await db.select().from(questions).all();
    console.log(`  ✅ Total: ${allQuestions.length} questões criadas`);
  }

  // Verificar se já existem simulados
  const existingSimulations = await db.select().from(simulations).all();
  if (existingSimulations.length > 0) {
    console.log(`ℹ️  Já existem ${existingSimulations.length} simulados. Pulando seed de simulados.`);
  } else {
    console.log("📝 Criando simulados...");

    // Agrupar questões por banca
    const cesgranrioQuestions = allQuestions.filter((q) => q.bank === "Cesgranrio");
    const cebraspeQuestions = allQuestions.filter((q) => q.bank === "Cebraspe");

    // Simulado Cesgranrio 1
    if (cesgranrioQuestions.length >= 3) {
      await db.insert(simulations).values({
        title: "Transpetro - Cesgranrio Simulado 01",
        bank: "Cesgranrio",
        description: "Simulado no estilo Cesgranrio com questões de português, raciocínio e informática.",
        timeLimit: 30,
        questionIds: JSON.stringify(cesgranrioQuestions.slice(0, 6).map((q) => q.id)),
        active: true,
      });
      console.log(`  ✅ Simulado criado: Transpetro - Cesgranrio Simulado 01`);
    }

    // Simulado Cebraspe
    if (cebraspeQuestions.length >= 2) {
      await db.insert(simulations).values({
        title: "Estilo Cebraspe - Certo/Errado",
        bank: "Cebraspe",
        description: "Simulado no padrão certo/errado da banca Cebraspe.",
        timeLimit: 20,
        questionIds: JSON.stringify(cebraspeQuestions.map((q) => q.id)),
        active: true,
      });
      console.log(`  ✅ Simulado criado: Estilo Cebraspe - Certo/Errado`);
    }
  }

  console.log("✅ Seed de simulados concluído!");
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  seedSimulations()
    .then(() => {
      console.log("✅ Seed de simulados concluído!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Falha:", error);
      process.exit(1);
    });
}