import {
  sqliteTable,
  text,
  integer,
  real,
} from "drizzle-orm/sqlite-core";

import {
  sql,
} from "drizzle-orm";


// ==========================================
// TABELA DE USUÁRIOS
// ==========================================

export const users =
  sqliteTable(
    "users",
    {
      id:
        integer(
          "id"
        ).primaryKey({
          autoIncrement:
            true,
        }),

      email:
        text(
          "email"
        )
          .notNull()
          .unique(),

      passwordHash:
        text(
          "password_hash"
        ).notNull(),

      name:
        text(
          "name"
        ),

      cpf:
        text(
          "cpf"
        ),

      phone:
        text(
          "phone"
        ),

      role:
        text(
          "role",
          {
            enum: [
              "user",
              "admin",
            ],
          }
        )
          .notNull()
          .default(
            "user"
          ),

      createdAt:
        text(
          "created_at"
        )
          .notNull()
          .default(
            sql`(datetime('now'))`
          ),

      updatedAt:
        text(
          "updated_at"
        )
          .notNull()
          .default(
            sql`(datetime('now'))`
          ),
    }
  );


// ==========================================
// TABELA DE PRODUTOS (APOSTILAS)
// ==========================================

export const products =
  sqliteTable(
    "products",
    {
      id:
        integer(
          "id"
        ).primaryKey({
          autoIncrement:
            true,
        }),

      slug:
        text(
          "slug"
        )
          .notNull()
          .unique(),

      title:
        text(
          "title"
        ).notNull(),

      shortTitle:
        text(
          "short_title"
        ),

      category:
        text(
          "category"
        ),

      bank:
        text(
          "bank"
        ),

      level:
        text(
          "level"
        ),

      /**
       * Organização responsável pelo concurso.
       *
       * Exemplos:
       *
       * Transpetro
       * Petrobras
       * Banco do Brasil
       */
      organization:
        text(
          "organization"
        ),

      /**
       * Slug explícito da landing de concurso.
       *
       * Exemplo:
       *
       * transpetro
       *
       * →
       *
       * /concurso/transpetro
       */
      contestSlug:
        text(
          "contest_slug"
        ),

      pages:
        integer(
          "pages"
        ),

      questions:
        integer(
          "questions"
        ),

      oldPrice:
        real(
          "old_price"
        ),

      price:
        real(
          "price"
        ).notNull(),

      pixPrice:
        real(
          "pix_price"
        ),

      updated:
        text(
          "updated"
        ),

      cover:
        text(
          "cover"
        ),

      coverClass:
        text(
          "cover_class"
        ),

      kicker:
        text(
          "kicker"
        ),

      description:
        text(
          "description"
        ),

      /**
       * SEO customizado.
       *
       * Quando null, a aplicação utilizará
       * title/description como fallback.
       */
      seoTitle:
        text(
          "seo_title"
        ),

      seoDescription:
        text(
          "seo_description"
        ),

      highlights:
        text(
          "highlights"
        ),

      syllabus:
        text(
          "syllabus"
        ),

      testimonial:
        text(
          "testimonial"
        ),

      mpLink:
        text(
          "mp_link"
        ),

      /**
       * Referência privada gerenciada do PDF.
       */
      pdfPath:
        text(
          "pdf_path"
        ),

      active:
        integer(
          "active",
          {
            mode:
              "boolean",
          }
        ).default(
          true
        ),

      /**
       * Data da primeira publicação.
       *
       * Não é controlada diretamente pelo cliente.
       */
      publishedAt:
        text(
          "published_at"
        ),

      createdAt:
        text(
          "created_at"
        )
          .notNull()
          .default(
            sql`(datetime('now'))`
          ),

      updatedAt:
        text(
          "updated_at"
        )
          .notNull()
          .default(
            sql`(datetime('now'))`
          ),
    }
  );


// ==========================================
// TABELA DE PEDIDOS
// ==========================================

export const orders =
  sqliteTable(
    "orders",
    {
      id:
        integer(
          "id"
        ).primaryKey({
          autoIncrement:
            true,
        }),

      userId:
        integer(
          "user_id"
        )
          .notNull()
          .references(
            () =>
              users.id
          ),

      status:
        text(
          "status",
          {
            enum: [
              "pending",
              "approved",
              "rejected",
              "refunded",
            ],
          }
        )
          .notNull()
          .default(
            "pending"
          ),

      paymentMethod:
        text(
          "payment_method"
        ),

      mpPaymentId:
        text(
          "mp_payment_id"
        ),

      subtotal:
        real(
          "subtotal"
        ).notNull(),

      discount:
        real(
          "discount"
        ).default(
          0
        ),

      total:
        real(
          "total"
        ).notNull(),

      coupon:
        text(
          "coupon"
        ),

      createdAt:
        text(
          "created_at"
        )
          .notNull()
          .default(
            sql`(datetime('now'))`
          ),

      updatedAt:
        text(
          "updated_at"
        )
          .notNull()
          .default(
            sql`(datetime('now'))`
          ),
    }
  );


// ==========================================
// TABELA DE ITENS DO PEDIDO
// ==========================================

export const orderItems =
  sqliteTable(
    "order_items",
    {
      id:
        integer(
          "id"
        ).primaryKey({
          autoIncrement:
            true,
        }),

      orderId:
        integer(
          "order_id"
        )
          .notNull()
          .references(
            () =>
              orders.id
          ),

      productId:
        integer(
          "product_id"
        )
          .notNull()
          .references(
            () =>
              products.id
          ),

      quantity:
        integer(
          "quantity"
        )
          .notNull()
          .default(
            1
          ),

      unitPrice:
        real(
          "unit_price"
        ).notNull(),

      createdAt:
        text(
          "created_at"
        )
          .notNull()
          .default(
            sql`(datetime('now'))`
          ),
    }
  );


// ==========================================
// TABELA DE QUESTÕES
// ==========================================

export const questions =
  sqliteTable(
    "questions",
    {
      id:
        integer(
          "id"
        ).primaryKey({
          autoIncrement:
            true,
        }),

      bank:
        text(
          "bank"
        ).notNull(),

      subject:
        text(
          "subject"
        ).notNull(),

      questionText:
        text(
          "question_text"
        ).notNull(),

      options:
        text(
          "options"
        ).notNull(),

      correctAnswer:
        integer(
          "correct_answer"
        ).notNull(),

      explanation:
        text(
          "explanation"
        ),

      difficulty:
        text(
          "difficulty",
          {
            enum: [
              "easy",
              "medium",
              "hard",
            ],
          }
        ).default(
          "medium"
        ),

      createdAt:
        text(
          "created_at"
        )
          .notNull()
          .default(
            sql`(datetime('now'))`
          ),
    }
  );


// ==========================================
// TABELA DE SIMULADOS
// ==========================================

export const simulations =
  sqliteTable(
    "simulations",
    {
      id:
        integer(
          "id"
        ).primaryKey({
          autoIncrement:
            true,
        }),

      title:
        text(
          "title"
        ).notNull(),

      bank:
        text(
          "bank"
        ).notNull(),

      description:
        text(
          "description"
        ),

      timeLimit:
        integer(
          "time_limit"
        ).notNull(),

      questionIds:
        text(
          "question_ids"
        ).notNull(),

      active:
        integer(
          "active",
          {
            mode:
              "boolean",
          }
        ).default(
          true
        ),

      createdAt:
        text(
          "created_at"
        )
          .notNull()
          .default(
            sql`(datetime('now'))`
          ),
    }
  );


// ==========================================
// TABELA DE RESULTADOS
// ==========================================

export const simulationResults =
  sqliteTable(
    "simulation_results",
    {
      id:
        integer(
          "id"
        ).primaryKey({
          autoIncrement:
            true,
        }),

      userId:
        integer(
          "user_id"
        )
          .notNull()
          .references(
            () =>
              users.id
          ),

      simulationId:
        integer(
          "simulation_id"
        )
          .notNull()
          .references(
            () =>
              simulations.id
          ),

      score:
        integer(
          "score"
        ).notNull(),

      totalQuestions:
        integer(
          "total_questions"
        ).notNull(),

      timeSpent:
        integer(
          "time_spent"
        ).notNull(),

      answers:
        text(
          "answers"
        ).notNull(),

      completedAt:
        text(
          "completed_at"
        )
          .notNull()
          .default(
            sql`(datetime('now'))`
          ),
    }
  );


// ==========================================
// TABELA DE SESSÕES
// ==========================================

export const sessions =
  sqliteTable(
    "sessions",
    {
      id:
        integer(
          "id"
        ).primaryKey({
          autoIncrement:
            true,
        }),

      userId:
        integer(
          "user_id"
        )
          .notNull()
          .references(
            () =>
              users.id
          ),

      token:
        text(
          "token"
        )
          .notNull()
          .unique(),

      expiresAt:
        text(
          "expires_at"
        ).notNull(),

      createdAt:
        text(
          "created_at"
        )
          .notNull()
          .default(
            sql`(datetime('now'))`
          ),
    }
  );


// ==========================================
// DOWNLOADS PROTEGIDOS
// ==========================================

export const protectedDownloads =
  sqliteTable(
    "protected_downloads",
    {
      id:
        integer(
          "id"
        ).primaryKey({
          autoIncrement:
            true,
        }),

      userId:
        integer(
          "user_id"
        )
          .notNull()
          .references(
            () =>
              users.id
          ),

      productId:
        integer(
          "product_id"
        )
          .notNull()
          .references(
            () =>
              products.id
          ),

      orderId:
        integer(
          "order_id"
        ).references(
          () =>
            orders.id
        ),

      downloadToken:
        text(
          "download_token"
        )
          .notNull()
          .unique(),

      expiresAt:
        text(
          "expires_at"
        ).notNull(),

      createdAt:
        text(
          "created_at"
        )
          .notNull()
          .default(
            sql`(datetime('now'))`
          ),
    }
  );


// ==========================================
// TIPOS EXPORTADOS
// ==========================================

export type User =
  typeof users.$inferSelect;

export type NewUser =
  typeof users.$inferInsert;

export type Product =
  typeof products.$inferSelect;

export type NewProduct =
  typeof products.$inferInsert;

export type Order =
  typeof orders.$inferSelect;

export type NewOrder =
  typeof orders.$inferInsert;

export type OrderItem =
  typeof orderItems.$inferSelect;

export type NewOrderItem =
  typeof orderItems.$inferInsert;

export type Question =
  typeof questions.$inferSelect;

export type NewQuestion =
  typeof questions.$inferInsert;

export type Simulation =
  typeof simulations.$inferSelect;

export type NewSimulation =
  typeof simulations.$inferInsert;

export type SimulationResult =
  typeof simulationResults.$inferSelect;

export type NewSimulationResult =
  typeof simulationResults.$inferInsert;

export type Session =
  typeof sessions.$inferSelect;

export type NewSession =
  typeof sessions.$inferInsert;

export type ProtectedDownload =
  typeof protectedDownloads.$inferSelect;

export type NewProtectedDownload =
  typeof protectedDownloads.$inferInsert;