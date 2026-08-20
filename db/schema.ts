import { sqliteTable, text, integer, real, blob } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Tabela de Usuários
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  cpf: text("cpf"),
  phone: text("phone"),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Tabela de Produtos (Apostilas)
export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  shortTitle: text("short_title"),
  category: text("category"),
  bank: text("bank"),
  level: text("level"),
  pages: integer("pages"),
  questions: integer("questions"),
  oldPrice: real("old_price"),
  price: real("price").notNull(),
  pixPrice: real("pix_price"),
  updated: text("updated"),
  cover: text("cover"),
  coverClass: text("cover_class"),
  kicker: text("kicker"),
  description: text("description"),
  highlights: text("highlights"), // JSON array
  syllabus: text("syllabus"), // JSON array
  testimonial: text("testimonial"), // JSON object
  mpLink: text("mp_link"), // Link do Mercado Pago
  pdfPath: text("pdf_path"), // Caminho do PDF no storage
  active: integer("active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Tabela de Pedidos
export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  status: text("status", { enum: ["pending", "approved", "rejected", "refunded"] }).notNull().default("pending"),
  paymentMethod: text("payment_method"),
  mpPaymentId: text("mp_payment_id"), // ID do pagamento no Mercado Pago
  subtotal: real("subtotal").notNull(),
  discount: real("discount").default(0),
  total: real("total").notNull(),
  coupon: text("coupon"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Tabela de Itens do Pedido
export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull().references(() => orders.id),
  productId: integer("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: real("unit_price").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// Tabela de Questões (Simulados)
export const questions = sqliteTable("questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bank: text("bank").notNull(), // Cesgranrio, Cebraspe, etc
  subject: text("subject").notNull(), // Português, Matemática, etc
  questionText: text("question_text").notNull(),
  options: text("options").notNull(), // JSON array de alternativas
  correctAnswer: integer("correct_answer").notNull(), // Índice da resposta correta (0-4)
  explanation: text("explanation"),
  difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] }).default("medium"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// Tabela de Simulados (Provas)
export const simulations = sqliteTable("simulations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  bank: text("bank").notNull(),
  description: text("description"),
  timeLimit: integer("time_limit").notNull(), // em minutos
  questionIds: text("question_ids").notNull(), // JSON array de IDs de questões
  active: integer("active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// Tabela de Resultados de Simulados
export const simulationResults = sqliteTable("simulation_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  simulationId: integer("simulation_id").notNull().references(() => simulations.id),
  score: integer("score").notNull(), // número de acertos
  totalQuestions: integer("total_questions").notNull(),
  timeSpent: integer("time_spent").notNull(), // em segundos
  answers: text("answers").notNull(), // JSON array com respostas do usuário
  completedAt: text("completed_at").notNull().default(sql`(datetime('now'))`),
});

// Tabela de Sessões (para autenticação)
export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// Tabela de Downloads Protegidos (PDFs temporários)
export const protectedDownloads = sqliteTable("protected_downloads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  productId: integer("product_id").notNull().references(() => products.id),
  orderId: integer("order_id").references(() => orders.id),
  downloadToken: text("download_token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// Exportar todos os schemas
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type Simulation = typeof simulations.$inferSelect;
export type NewSimulation = typeof simulations.$inferInsert;
export type SimulationResult = typeof simulationResults.$inferSelect;
export type NewSimulationResult = typeof simulationResults.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;