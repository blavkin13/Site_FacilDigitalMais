import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import * as schema from "./schema";

type SqliteDatabase = InstanceType<typeof Database>;

let sqliteInstance: SqliteDatabase | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

/**
 * Retorna o caminho absoluto do banco SQLite.
 *
 * Prioridade:
 * 1. DATABASE_PATH definido no ambiente.
 * 2. data/dev.db dentro do projeto.
 */
export function getDatabasePath(): string {
  const configuredPath = process.env.DATABASE_PATH?.trim();

  if (configuredPath) {
    return isAbsolute(configuredPath)
      ? configuredPath
      : resolve(process.cwd(), configuredPath);
  }

  const dataDir = join(process.cwd(), "data");

  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  return join(dataDir, "dev.db");
}

/**
 * Garante que o diretório onde o banco será armazenado exista.
 */
function ensureDatabaseDirectory(databasePath: string): void {
  const databaseDirectory = dirname(databasePath);

  if (!existsSync(databaseDirectory)) {
    mkdirSync(databaseDirectory, { recursive: true });
  }
}

/**
 * Retorna a conexão SQLite nativa.
 *
 * A conexão é singleton dentro do processo Node.
 * Isso evita abrir uma nova conexão para cada request.
 */
export function getSqliteConnection(): SqliteDatabase {
  if (sqliteInstance) {
    return sqliteInstance;
  }

  const databasePath = getDatabasePath();

  ensureDatabaseDirectory(databasePath);

  console.log(`💾 Banco SQLite: ${databasePath}`);

  const sqlite = new Database(databasePath);

  // WAL melhora a concorrência entre leituras e escritas.
  sqlite.pragma("journal_mode = WAL");

  // Garante que as foreign keys definidas no schema sejam respeitadas.
  sqlite.pragma("foreign_keys = ON");

  // Evita erros SQLITE_BUSY em pequenas concorrências de escrita.
  sqlite.pragma("busy_timeout = 5000");

  sqliteInstance = sqlite;

  return sqliteInstance;
}

/**
 * Retorna a instância Drizzle ORM associada à conexão SQLite.
 *
 * Também é singleton dentro do processo Node.
 */
export function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = drizzle(getSqliteConnection(), { schema });

  return dbInstance;
}

/**
 * Fecha a conexão SQLite.
 *
 * Normalmente o servidor Next.js mantém a conexão aberta durante
 * toda a vida do processo.
 *
 * Esta função é especialmente útil para testes e encerramentos
 * controlados de scripts CLI.
 */
export function closeDatabase(): void {
  if (sqliteInstance?.open) {
    sqliteInstance.close();
  }

  sqliteInstance = null;
  dbInstance = null;
}