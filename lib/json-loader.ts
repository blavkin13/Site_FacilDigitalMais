import { readFile, writeFile, readdir } from "fs/promises";
import { join } from "path";
import { getDb } from "../db/index";
import { products, questions, simulations } from "../db/schema";
import { eq } from "drizzle-orm";

// Interface para produto JSON
export interface ProductJson {
  slug: string;
  title: string;
  shortTitle?: string;
  category?: string;
  bank?: string;
  level?: string;
  pages?: number;
  questions?: number;
  oldPrice?: number;
  price: number;
  pixPrice?: number;
  updated?: string;
  cover?: string;
  coverClass?: string;
  kicker?: string;
  description?: string;
  highlights?: string[];
  syllabus?: Array<{
    title: string;
    pages: number;
    questions: number;
    topics: string[];
  }>;
  testimonial?: {
    name: string;
    role: string;
    quote: string;
    score: string;
  };
  mpLink?: string;
  pdfPath?: string;
}

// Interface para questão JSON
export interface QuestionJson {
  bank: string;
  subject: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  difficulty?: "easy" | "medium" | "hard";
}

// Interface para simulado JSON
export interface SimulationJson {
  title: string;
  bank: string;
  description?: string;
  timeLimit: number;
  questionIds: number[];
}

// Carregar produtos de arquivo JSON
export async function loadProductsFromJson(filePath: string): Promise<void> {
  const db = getDb();
  
  try {
    const content = await readFile(filePath, "utf-8");
    const productsData: ProductJson[] = JSON.parse(content);
    
    console.log(`📦 Carregando ${productsData.length} produtos...`);
    
    for (const product of productsData) {
      // Verificar se produto já existe
      const existing = await db
        .select()
        .from(products)
        .where(eq(products.slug, product.slug))
        .get();
      
      const productData = {
        ...product,
        highlights: product.highlights ? JSON.stringify(product.highlights) : null,
        syllabus: product.syllabus ? JSON.stringify(product.syllabus) : null,
        testimonial: product.testimonial ? JSON.stringify(product.testimonial) : null,
      };
      
      if (existing) {
        // Atualizar produto existente
        await db
          .update(products)
          .set(productData)
          .where(eq(products.slug, product.slug));
        console.log(`  ✏️  Atualizado: ${product.title}`);
      } else {
        // Criar novo produto
        await db.insert(products).values(productData);
        console.log(`  ✅ Criado: ${product.title}`);
      }
    }
    
    console.log("✅ Produtos carregados com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao carregar produtos:", error);
    throw error;
  }
}

// Carregar questões de arquivo JSON
export async function loadQuestionsFromJson(filePath: string): Promise<void> {
  const db = getDb();
  
  try {
    const content = await readFile(filePath, "utf-8");
    const questionsData: QuestionJson[] = JSON.parse(content);
    
    console.log(`❓ Carregando ${questionsData.length} questões...`);
    
    for (const question of questionsData) {
      await db.insert(questions).values({
        ...question,
        options: JSON.stringify(question.options),
      });
      console.log(`  ✅ Questão criada: ${question.subject}`);
    }
    
    console.log("✅ Questões carregadas com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao carregar questões:", error);
    throw error;
  }
}

// Carregar simulados de arquivo JSON
export async function loadSimulationsFromJson(filePath: string): Promise<void> {
  const db = getDb();
  
  try {
    const content = await readFile(filePath, "utf-8");
    const simulationsData: SimulationJson[] = JSON.parse(content);
    
    console.log(`📝 Carregando ${simulationsData.length} simulados...`);
    
    for (const sim of simulationsData) {
      await db.insert(simulations).values({
        ...sim,
        questionIds: JSON.stringify(sim.questionIds),
      });
      console.log(`  ✅ Simulado criado: ${sim.title}`);
    }
    
    console.log("✅ Simulados carregados com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao carregar simulados:", error);
    throw error;
  }
}

// Função para monitorar mudanças em arquivos JSON (hot-reload)
export async function watchJsonFile(filePath: string, callback: () => Promise<void>): Promise<void> {
  const { watch } = await import("fs");
  
  let timeout: NodeJS.Timeout | null = null;
  
  watch(filePath, () => {
    // Debounce para evitar múltiplas chamadas
    if (timeout) clearTimeout(timeout);
    
    timeout = setTimeout(async () => {
      console.log(`🔄 Arquivo alterado: ${filePath}`);
      try {
        await callback();
      } catch (error) {
        console.error("❌ Erro ao recarregar:", error);
      }
    }, 1000);
  });
  
  console.log(`👀 Monitorando: ${filePath}`);
}