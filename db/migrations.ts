import { createHash } from "node:crypto";
import Database from "better-sqlite3";

type SqliteDatabase = InstanceType<typeof Database>;

interface Migration {
  id: string;
  description: string;
  sql: string;
}

interface AppliedMigrationRow {
  id: string;
  description: string;
  checksum: string;
  applied_at: string;
}

export interface MigrationResult {
  applied: string[];
  alreadyApplied: number;
  total: number;
}

/**
 * IMPORTANTE
 * ==========
 *
 * Depois que uma migration for aplicada em qualquer banco,
 * seu conteúdo NÃO deve mais ser alterado.
 *
 * Toda alteração futura no schema deve criar uma nova migration.
 *
 * Exemplo:
 *
 * 0001_initial_schema
 * 0002_product_metadata
 * 0003_simulation_relations
 *
 * Isso permite atualizar bancos existentes sem destruir dados.
 */
const migrations: Migration[] = [
  {
    id: "0001_initial_schema",
    description: "Schema inicial da plataforma Facil Digital+",
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT,
        cpf TEXT,
        phone TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        short_title TEXT,
        category TEXT,
        bank TEXT,
        level TEXT,
        pages INTEGER,
        questions INTEGER,
        old_price REAL,
        price REAL NOT NULL,
        pix_price REAL,
        updated TEXT,
        cover TEXT,
        cover_class TEXT,
        kicker TEXT,
        description TEXT,
        highlights TEXT,
        syllabus TEXT,
        testimonial TEXT,
        mp_link TEXT,
        pdf_path TEXT,
        active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'pending',
        payment_method TEXT,
        mp_payment_id TEXT,
        subtotal REAL NOT NULL,
        discount REAL DEFAULT 0,
        total REAL NOT NULL,
        coupon TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bank TEXT NOT NULL,
        subject TEXT NOT NULL,
        question_text TEXT NOT NULL,
        options TEXT NOT NULL,
        correct_answer INTEGER NOT NULL,
        explanation TEXT,
        difficulty TEXT DEFAULT 'medium',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS simulations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        bank TEXT NOT NULL,
        description TEXT,
        time_limit INTEGER NOT NULL,
        question_ids TEXT NOT NULL,
        active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS simulation_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        simulation_id INTEGER NOT NULL REFERENCES simulations(id),
        score INTEGER NOT NULL,
        total_questions INTEGER NOT NULL,
        time_spent INTEGER NOT NULL,
        answers TEXT NOT NULL,
        completed_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS protected_downloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        order_id INTEGER REFERENCES orders(id),
        download_token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
  {
    id: "0002_product_editorial_metadata",
    description: "Metadados editoriais, SEO e publicação de apostilas",
    sql: `
      ALTER TABLE products
        ADD COLUMN organization TEXT;

      ALTER TABLE products
        ADD COLUMN contest_slug TEXT;

      ALTER TABLE products
        ADD COLUMN seo_title TEXT;

      ALTER TABLE products
        ADD COLUMN seo_description TEXT;

      ALTER TABLE products
        ADD COLUMN published_at TEXT;

      CREATE INDEX IF NOT EXISTS
        idx_products_active_contest_slug
        ON products(active, contest_slug);
    `,
  },
  {
    id: "0003_simulation_management",
    description: "Relacionamentos, publicação e histórico de simulados",
    sql: `
      ALTER TABLE questions
        ADD COLUMN active INTEGER NOT NULL DEFAULT 1;

      ALTER TABLE questions
        ADD COLUMN updated_at TEXT;

      UPDATE questions
      SET updated_at = created_at
      WHERE updated_at IS NULL;


      ALTER TABLE simulations
        ADD COLUMN updated_at TEXT;

      ALTER TABLE simulations
        ADD COLUMN published_at TEXT;

      UPDATE simulations
      SET
        updated_at = created_at,
        published_at = CASE
          WHEN active = 1
            THEN created_at
          ELSE published_at
        END
      WHERE
        updated_at IS NULL
        OR (
          active = 1
          AND published_at IS NULL
        );


      ALTER TABLE simulation_results
        ADD COLUMN snapshot TEXT;


      CREATE TABLE IF NOT EXISTS simulation_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        simulation_id INTEGER NOT NULL
          REFERENCES simulations(id)
          ON DELETE CASCADE,
        product_id INTEGER NOT NULL
          REFERENCES products(id)
          ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (
          simulation_id,
          product_id
        )
      );


      CREATE TABLE IF NOT EXISTS simulation_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        simulation_id INTEGER NOT NULL
          REFERENCES simulations(id)
          ON DELETE CASCADE,
        question_id INTEGER NOT NULL
          REFERENCES questions(id)
          ON DELETE CASCADE,
        position INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (
          simulation_id,
          question_id
        ),
        UNIQUE (
          simulation_id,
          position
        )
      );


      CREATE INDEX IF NOT EXISTS
        idx_simulation_products_product_id
        ON simulation_products(product_id);


      CREATE INDEX IF NOT EXISTS
        idx_simulation_questions_question_id
        ON simulation_questions(question_id);


      CREATE INDEX IF NOT EXISTS
        idx_simulations_active
        ON simulations(active);


      CREATE INDEX IF NOT EXISTS
        idx_questions_active_bank_subject
        ON questions(active, bank, subject);


      CREATE INDEX IF NOT EXISTS
        idx_simulation_results_user_simulation
        ON simulation_results(user_id, simulation_id);


      CREATE INDEX IF NOT EXISTS
        idx_orders_user_status
        ON orders(user_id, status);


      CREATE INDEX IF NOT EXISTS
        idx_order_items_product_order
        ON order_items(product_id, order_id);


      /*
       * Migra question_ids legado para a nova
       * tabela relacional.
       *
       * JSON inválido é tratado como array vazio,
       * evitando abortar a migration inteira.
       */
      INSERT OR IGNORE INTO simulation_questions (
        simulation_id,
        question_id,
        position
      )
      SELECT
        simulations.id,
        CAST(
          legacy_question.value
          AS INTEGER
        ),
        CAST(
          legacy_question.key
          AS INTEGER
        ) + 1
      FROM
        simulations,
        json_each(
          CASE
            WHEN json_valid(
              simulations.question_ids
            )
              THEN simulations.question_ids
            ELSE '[]'
          END
        ) AS legacy_question
      INNER JOIN questions
        ON questions.id =
          CAST(
            legacy_question.value
            AS INTEGER
          )
      WHERE
        legacy_question.type = 'integer';
    `,
  },

  {
    id: "0004_simulation_attempts",
    description: "Tentativas server-side seguras de simulados",
    sql: `
      CREATE TABLE IF NOT EXISTS simulation_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        token TEXT NOT NULL UNIQUE,

        user_id INTEGER NOT NULL
          REFERENCES users(id),

        simulation_id INTEGER NOT NULL
          REFERENCES simulations(id),

        status TEXT NOT NULL
          DEFAULT 'in_progress'
          CHECK (
            status IN (
              'in_progress',
              'completed',
              'expired',
              'revoked'
            )
          ),

        started_at TEXT NOT NULL,

        expires_at TEXT NOT NULL,

        completed_at TEXT,

        question_snapshot TEXT NOT NULL,

        created_at TEXT NOT NULL
          DEFAULT (datetime('now')),

        updated_at TEXT NOT NULL
          DEFAULT (datetime('now'))
      );


      ALTER TABLE simulation_results
        ADD COLUMN attempt_id INTEGER
          REFERENCES simulation_attempts(id);


      /*
       * Uma tentativa concluída só pode originar
       * um resultado.
       *
       * SQLite permite múltiplos NULL em índices
       * UNIQUE, preservando resultados legados.
       */
      CREATE UNIQUE INDEX IF NOT EXISTS
        uq_simulation_results_attempt_id
        ON simulation_results(attempt_id);


      /*
       * Um aluno pode possuir diversas tentativas
       * históricas do mesmo simulado, porém apenas
       * UMA tentativa in_progress por vez.
       */
      CREATE UNIQUE INDEX IF NOT EXISTS
        uq_simulation_attempts_active_user_simulation
        ON simulation_attempts(
          user_id,
          simulation_id
        )
        WHERE status = 'in_progress';


      CREATE INDEX IF NOT EXISTS
        idx_simulation_attempts_user_simulation_status
        ON simulation_attempts(
          user_id,
          simulation_id,
          status
        );


      CREATE INDEX IF NOT EXISTS
        idx_simulation_attempts_status_expires
        ON simulation_attempts(
          status,
          expires_at
        );
    `,
  },

  {
    id:
      "0005_runtime_performance_indexes",

    description:
      "Índices operacionais para sessões, resultados, pedidos e downloads",

    sql: `
      /*
       * validateSession() já possui UNIQUE(token),
       * porém tarefas de manutenção precisam
       * localizar sessões vencidas por expires_at.
       */
      CREATE INDEX IF NOT EXISTS
        idx_sessions_expires_at
        ON sessions(expires_at);


      /*
       * Rotação de senha administrativa e
       * revokeUserSessions() trabalham por user_id.
       */
      CREATE INDEX IF NOT EXISTS
        idx_sessions_user_id
        ON sessions(user_id);


      /*
       * Ranking carrega todos os resultados de
       * determinado simulado.
       *
       * O índice existente:
       *
       *   (user_id, simulation_id)
       *
       * não é adequado para uma consulta cuja
       * primeira condição seja simulation_id.
       */
      CREATE INDEX IF NOT EXISTS
        idx_simulation_results_simulation_id
        ON simulation_results(simulation_id);


      /*
       * Histórico do aluno:
       *
       * WHERE user_id = ?
       * ORDER BY completed_at DESC
       */
      CREATE INDEX IF NOT EXISTS
        idx_simulation_results_user_completed_at
        ON simulation_results(
          user_id,
          completed_at DESC
        );


      /*
       * O índice histórico:
       *
       *   (product_id, order_id)
       *
       * é útil no sentido produto → pedido.
       *
       * Entitlement frequentemente percorre:
       *
       *   pedido → itens → produto
       *
       * portanto também precisamos da direção
       * inversa.
       */
      CREATE INDEX IF NOT EXISTS
        idx_order_items_order_product
        ON order_items(
          order_id,
          product_id
        );


      /*
       * Limpeza de links de download expirados.
       */
      CREATE INDEX IF NOT EXISTS
        idx_protected_downloads_expires_at
        ON protected_downloads(expires_at);
    `,
  },

  {
    id:
      "0006_payment_order_identity",

    description:
      "Identidade externa e índices únicos para pedidos Mercado Pago",

    sql: `
      /*
       * Pedidos históricos permanecem compatíveis:
       *
       * external_reference e preference_id são
       * nullable na migration.
       *
       * A aplicação passará a exigir
       * external_reference para todo novo pedido.
       */
      ALTER TABLE orders
        ADD COLUMN external_reference TEXT;

      ALTER TABLE orders
        ADD COLUMN preference_id TEXT;

      /*
       * Uma referência externa identifica
       * exatamente um pedido.
       *
       * NULL continua permitido para pedidos
       * anteriores à migration.
       */
      CREATE UNIQUE INDEX
        uq_orders_external_reference
        ON orders(external_reference)
        WHERE external_reference IS NOT NULL;

      /*
       * Uma preferência Mercado Pago não pode ser
       * associada silenciosamente a pedidos
       * diferentes.
       */
      CREATE UNIQUE INDEX
        uq_orders_preference_id
        ON orders(preference_id)
        WHERE preference_id IS NOT NULL;

      /*
       * Um payment_id real deve identificar no
       * máximo um pedido.
       *
       * Esta constraint funciona como segunda
       * camada de idempotência do webhook.
       */
      CREATE UNIQUE INDEX
        uq_orders_mp_payment_id
        ON orders(mp_payment_id)
        WHERE mp_payment_id IS NOT NULL;
    `,
  },

];

/**
 * Gera um checksum imutável para cada migration.
 *
 * Se uma migration já aplicada for modificada posteriormente,
 * o sistema detectará a alteração e interromperá a inicialização.
 */
function calculateChecksum(migration: Migration): string {
  return createHash("sha256")
    .update(`${migration.id}\n${migration.description}\n${migration.sql}`)
    .digest("hex");
}

/**
 * Verifica se existem IDs duplicados na lista de migrations.
 */
function validateMigrationDefinitions(): void {
  const ids = new Set<string>();

  for (const migration of migrations) {
    if (ids.has(migration.id)) {
      throw new Error(
        `Migration duplicada encontrada: ${migration.id}`
      );
    }

    ids.add(migration.id);
  }
}

/**
 * Cria a tabela interna responsável pelo histórico das migrations.
 *
 * Essa tabela não pertence ao domínio comercial da aplicação,
 * portanto não precisa existir em db/schema.ts.
 */
function ensureMigrationTable(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/**
 * Retorna todas as migrations já registradas no banco.
 */
function getAppliedMigrations(
  db: SqliteDatabase
): AppliedMigrationRow[] {
  return db
    .prepare(`
      SELECT
        id,
        description,
        checksum,
        applied_at
      FROM schema_migrations
      ORDER BY id
    `)
    .all() as AppliedMigrationRow[];
}

/**
 * Valida o histórico existente.
 *
 * Duas situações são consideradas perigosas:
 *
 * 1. O banco possuir uma migration desconhecida pela aplicação.
 * 2. O conteúdo de uma migration antiga ter sido modificado.
 *
 * Em ambos os casos a aplicação interrompe a inicialização para
 * evitar corrupção ou regressão silenciosa do banco.
 */
function validateAppliedMigrations(
  appliedMigrations: AppliedMigrationRow[]
): void {
  const migrationMap = new Map(
    migrations.map((migration) => [migration.id, migration])
  );

  for (const appliedMigration of appliedMigrations) {
    const migration = migrationMap.get(appliedMigration.id);

    if (!migration) {
      throw new Error(
        [
          `O banco possui uma migration desconhecida:`,
          appliedMigration.id,
          "",
          "Isso normalmente significa que o banco foi atualizado",
          "por uma versão mais nova da aplicação.",
        ].join(" ")
      );
    }

    const expectedChecksum = calculateChecksum(migration);

    if (expectedChecksum !== appliedMigration.checksum) {
      throw new Error(
        [
          `A migration ${migration.id} foi modificada depois de aplicada.`,
          "Migrations antigas são imutáveis.",
          "Crie uma nova migration em vez de editar a anterior.",
        ].join(" ")
      );
    }
  }
}

/**
 * Executa todas as migrations pendentes.
 *
 * Cada migration é aplicada dentro de uma transação SQLite.
 * Se algum comando falhar, toda a migration atual é revertida.
 */
export function runMigrations(
  db: SqliteDatabase
): MigrationResult {
  validateMigrationDefinitions();

  ensureMigrationTable(db);

  const appliedMigrations = getAppliedMigrations(db);

  validateAppliedMigrations(appliedMigrations);

  const appliedIds = new Set(
    appliedMigrations.map((migration) => migration.id)
  );

  const pendingMigrations = migrations.filter(
    (migration) => !appliedIds.has(migration.id)
  );

  const appliedNow: string[] = [];

  for (const migration of pendingMigrations) {
    const checksum = calculateChecksum(migration);

    const applyMigration = db.transaction(() => {
      db.exec(migration.sql);

      db.prepare(`
        INSERT INTO schema_migrations (
          id,
          description,
          checksum
        )
        VALUES (?, ?, ?)
      `).run(
        migration.id,
        migration.description,
        checksum
      );
    });

    console.log(
      `🔄 Aplicando migration ${migration.id}: ${migration.description}`
    );

    applyMigration();

    appliedNow.push(migration.id);

    console.log(`✅ Migration ${migration.id} aplicada.`);
  }

  return {
    applied: appliedNow,
    alreadyApplied: appliedMigrations.length,
    total: migrations.length,
  };
}