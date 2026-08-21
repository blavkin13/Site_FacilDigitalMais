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