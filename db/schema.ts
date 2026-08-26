import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
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

      /**
       * Referência externa gerada pela aplicação.
       *
       * Pedidos anteriores à migration 0006 podem
       * permanecer sem valor.
       *
       * Todo novo pedido criado pelo checkout deverá
       * possuir uma referência imprevisível e única.
       */
      externalReference:
        text(
          "external_reference"
        ),

      /**
       * Identificador da preferência criada no
       * Mercado Pago.
       *
       * Nullable para compatibilidade com pedidos
       * históricos e fluxos que ainda não chegaram
       * à criação da preferência.
       */
      preferenceId:
        text(
          "preference_id"
        ),

      /**
       * Identificador do pagamento confirmado/
       * consultado no Mercado Pago.
       *
       * Nullable enquanto o pedido ainda não possuir
       * pagamento associado.
       */
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
    },
    (
      table
    ) => [
      /**
       * SQLite permite múltiplos NULL em índices
       * UNIQUE.
       *
       * Assim preservamos pedidos históricos sem
       * referência, mas impedimos colisões entre
       * novos pedidos.
       */
      uniqueIndex(
        "uq_orders_external_reference"
      )
        .on(
          table.externalReference
        )
        .where(
          sql`${table.externalReference} IS NOT NULL`
        ),

      uniqueIndex(
        "uq_orders_preference_id"
      )
        .on(
          table.preferenceId
        )
        .where(
          sql`${table.preferenceId} IS NOT NULL`
        ),

      uniqueIndex(
        "uq_orders_mp_payment_id"
      )
        .on(
          table.mpPaymentId
        )
        .where(
          sql`${table.mpPaymentId} IS NOT NULL`
        ),
    ]
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

      /**
       * Alternativas serializadas em JSON.
       *
       * O domínio administrativo trabalha com
       * string[], mas a persistência continua
       * compatível com a estrutura SQLite atual.
       */
      options:
        text(
          "options"
        ).notNull(),

      /**
       * Índice zero-based da alternativa correta.
       *
       * Este campo é estritamente interno.
       * APIs destinadas ao aluno nunca devem
       * expô-lo antes da submissão.
       */
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

      /**
       * Questões não são apagadas fisicamente
       * pelo painel.
       *
       * Uma questão arquivada permanece no banco
       * para preservar referências e resultados
       * históricos.
       */
      active:
        integer(
          "active",
          {
            mode:
              "boolean",
          }
        )
          .notNull()
          .default(
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

      /**
       * Nullable apenas por compatibilidade de
       * migration com bancos já existentes.
       *
       * Novas operações administrativas sempre
       * preencherão este campo.
       */
      updatedAt:
        text(
          "updated_at"
        ),
    },
    (
      table
    ) => [
      index(
        "idx_questions_active_bank_subject"
      ).on(
        table.active,
        table.bank,
        table.subject
      ),
    ]
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

      /**
       * Tempo limite em minutos.
       */
      timeLimit:
        integer(
          "time_limit"
        ).notNull(),

      /**
       * CAMPO LEGADO.
       *
       * Permanece temporariamente para permitir
       * uma transição segura dos dados antigos.
       *
       * A partir da Fase 4, a fonte de verdade para
       * composição do simulado será:
       *
       * simulation_questions
       *
       * Novos simulados administrativos utilizarão
       * "[]" neste campo.
       */
      questionIds:
        text(
          "question_ids"
        ).notNull(),

      /**
       * active continua compatível com simulados
       * legados.
       *
       * A API administrativa da Fase 4 sempre criará
       * novos simulados explicitamente com active=false.
       */
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
       * Data da primeira publicação administrativa.
       *
       * Simulados legados que já estavam ativos
       * receberão created_at durante a migration.
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
        ),
    },
    (
      table
    ) => [
      index(
        "idx_simulations_active"
      ).on(
        table.active
      ),
    ]
  );


// ==========================================
// PRODUTOS LIBERADORES DE SIMULADOS
// ==========================================

/**
 * Relação muitos-para-muitos:
 *
 * simulation_products
 *
 * Um simulado pode ser liberado por várias
 * apostilas.
 *
 * Uma apostila também pode liberar vários
 * simulados.
 *
 * Essa tabela será a base do entitlement:
 *
 * order_items.product_id
 *          ↓
 * simulation_products.product_id
 *          ↓
 * simulations.id
 */
export const simulationProducts =
  sqliteTable(
    "simulation_products",
    {
      id:
        integer(
          "id"
        ).primaryKey({
          autoIncrement:
            true,
        }),

      simulationId:
        integer(
          "simulation_id"
        )
          .notNull()
          .references(
            () =>
              simulations.id,
            {
              onDelete:
                "cascade",
            }
          ),

      productId:
        integer(
          "product_id"
        )
          .notNull()
          .references(
            () =>
              products.id,
            {
              onDelete:
                "cascade",
            }
          ),

      createdAt:
        text(
          "created_at"
        )
          .notNull()
          .default(
            sql`(datetime('now'))`
          ),
    },
    (
      table
    ) => [
      uniqueIndex(
        "uq_simulation_products_simulation_product"
      ).on(
        table.simulationId,
        table.productId
      ),

      index(
        "idx_simulation_products_product_id"
      ).on(
        table.productId
      ),
    ]
  );


// ==========================================
// QUESTÕES DOS SIMULADOS
// ==========================================

/**
 * Substitui o antigo simulations.question_ids
 * como fonte de verdade.
 *
 * position é 1-based:
 *
 * 1 = primeira questão
 * 2 = segunda questão
 * ...
 */
export const simulationQuestions =
  sqliteTable(
    "simulation_questions",
    {
      id:
        integer(
          "id"
        ).primaryKey({
          autoIncrement:
            true,
        }),

      simulationId:
        integer(
          "simulation_id"
        )
          .notNull()
          .references(
            () =>
              simulations.id,
            {
              onDelete:
                "cascade",
            }
          ),

      questionId:
        integer(
          "question_id"
        )
          .notNull()
          .references(
            () =>
              questions.id,
            {
              onDelete:
                "cascade",
            }
          ),

      position:
        integer(
          "position"
        ).notNull(),

      createdAt:
        text(
          "created_at"
        )
          .notNull()
          .default(
            sql`(datetime('now'))`
          ),
    },
    (
      table
    ) => [
      uniqueIndex(
        "uq_simulation_questions_simulation_question"
      ).on(
        table.simulationId,
        table.questionId
      ),

      uniqueIndex(
        "uq_simulation_questions_simulation_position"
      ).on(
        table.simulationId,
        table.position
      ),

      index(
        "idx_simulation_questions_question_id"
      ).on(
        table.questionId
      ),
    ]
  );


// ==========================================
// TENTATIVAS SERVER-SIDE DE SIMULADOS
// ==========================================

/**
 * Representa uma execução real de prova.
 *
 * A tentativa nasce no servidor e congela:
 *
 * - horário de início;
 * - horário de expiração;
 * - composição da prova;
 * - conteúdo das questões;
 * - gabaritos usados para correção futura.
 *
 * O navegador recebe somente a versão pública
 * do snapshot, sem gabarito e explicação.
 */
export const simulationAttempts =
  sqliteTable(
    "simulation_attempts",
    {
      id:
        integer(
          "id"
        ).primaryKey({
          autoIncrement:
            true,
        }),

      /**
       * Identificador público não sequencial.
       *
       * Não expomos o ID inteiro da tentativa
       * nas rotas destinadas ao aluno.
       */
      token:
        text(
          "token"
        )
          .notNull()
          .unique(),

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

      status:
        text(
          "status",
          {
            enum: [
              "in_progress",
              "completed",
              "expired",
              "revoked",
            ],
          }
        )
          .notNull()
          .default(
            "in_progress"
          ),

      /**
       * Ambos são definidos exclusivamente
       * pelo servidor.
       */
      startedAt:
        text(
          "started_at"
        ).notNull(),

      expiresAt:
        text(
          "expires_at"
        ).notNull(),

      completedAt:
        text(
          "completed_at"
        ),

      /**
       * Snapshot privado da prova no momento
       * em que a tentativa foi iniciada.
       *
       * Contém inclusive correctAnswer e
       * explanation para que alterações futuras
       * no banco de questões não modifiquem uma
       * tentativa já iniciada.
       */
      questionSnapshot:
        text(
          "question_snapshot"
        ).notNull(),

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
    },
    (
      table
    ) => [
      /**
       * Um usuário pode ter várias tentativas
       * históricas, mas somente uma aberta por
       * simulado.
       */
      uniqueIndex(
        "uq_simulation_attempts_active_user_simulation"
      )
        .on(
          table.userId,
          table.simulationId
        )
        .where(
          sql`${table.status} = 'in_progress'`
        ),

      index(
        "idx_simulation_attempts_user_simulation_status"
      ).on(
        table.userId,
        table.simulationId,
        table.status
      ),

      index(
        "idx_simulation_attempts_status_expires"
      ).on(
        table.status,
        table.expiresAt
      ),
    ]
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

      /**
       * Nullable para preservar resultados
       * anteriores à Fase 4.3.
       *
       * Novos resultados serão obrigatoriamente
       * relacionados a uma tentativa server-side
       * quando o submit for migrado na 4.3B.
       */
      attemptId:
        integer(
          "attempt_id"
        ).references(
          () =>
            simulationAttempts.id
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

      /**
       * Respostas enviadas pelo aluno.
       *
       * Mantido para compatibilidade com os
       * resultados já existentes.
       */
      answers:
        text(
          "answers"
        ).notNull(),

      /**
       * Snapshot imutável do resultado.
       *
       * Novos resultados armazenam:
       *
       * - enunciados;
       * - alternativas;
       * - resposta selecionada;
       * - resposta correta;
       * - explicação;
       * - matéria.
       */
      snapshot:
        text(
          "snapshot"
        ),

      completedAt:
        text(
          "completed_at"
        )
          .notNull()
          .default(
            sql`(datetime('now'))`
          ),
    },
    (
      table
    ) => [
      uniqueIndex(
        "uq_simulation_results_attempt_id"
      ).on(
        table.attemptId
      ),

      index(
        "idx_simulation_results_user_simulation"
      ).on(
        table.userId,
        table.simulationId
      ),
    ]
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


export type SimulationProduct =
  typeof simulationProducts.$inferSelect;

export type NewSimulationProduct =
  typeof simulationProducts.$inferInsert;


export type SimulationQuestion =
  typeof simulationQuestions.$inferSelect;

export type NewSimulationQuestion =
  typeof simulationQuestions.$inferInsert;

export type SimulationAttempt =
  typeof simulationAttempts.$inferSelect;

export type NewSimulationAttempt =
  typeof simulationAttempts.$inferInsert;

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