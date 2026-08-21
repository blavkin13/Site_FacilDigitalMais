import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import {
  existsSync,
  mkdirSync,
} from "node:fs";
import {
  isAbsolute,
  join,
} from "node:path";
import * as schema from "./schema";

type SqliteDatabase = InstanceType<typeof Database>;

let sqliteInstance: SqliteDatabase | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

/**
 * Garante que a pasta local data/ exista.
 *
 * O caminho é propositalmente estático e limitado ao diretório
 * data/ para que o Turbopack não interprete o acesso como uma
 * leitura potencial de todo o projeto.
 */
function ensureLocalDataDirectory(): void {
  const dataDirectory = join(
    process.cwd(),
    "data"
  );

  if (!existsSync(dataDirectory)) {
    mkdirSync(dataDirectory, {
      recursive: true,
    });
  }
}

/**
 * Converte os formatos relativos aceitos de DATABASE_PATH
 * para somente o nome do arquivo.
 *
 * Formatos válidos:
 *
 * DATABASE_PATH=dev.db
 * DATABASE_PATH=data/dev.db
 * DATABASE_PATH=./data/dev.db
 *
 * Caminhos absolutos também são aceitos, mas são tratados
 * diretamente em getDatabasePath().
 */
function getRelativeDatabaseFilename(
  configuredPath: string
): string {
  const normalizedPath = configuredPath
    .trim()
    .replace(/\\/g, "/");

  if (!normalizedPath) {
    return "dev.db";
  }

  /**
   * Nome simples:
   *
   * dev.db
   * producao.db
   */
  if (!normalizedPath.includes("/")) {
    if (
      normalizedPath === "." ||
      normalizedPath === ".."
    ) {
      throw new Error(
        "DATABASE_PATH relativo inválido."
      );
    }

    return normalizedPath;
  }

  /**
   * Compatibilidade com:
   *
   * data/dev.db
   * ./data/dev.db
   */
  const dataPathMatch = normalizedPath.match(
    /^(?:\.\/)?data\/([^/]+)$/
  );

  if (dataPathMatch) {
    const filename = dataPathMatch[1];

    if (
      !filename ||
      filename === "." ||
      filename === ".."
    ) {
      throw new Error(
        "DATABASE_PATH relativo inválido."
      );
    }

    return filename;
  }

  throw new Error(
    [
      "DATABASE_PATH relativo deve apontar",
      "para um arquivo dentro da pasta data/.",
      "Use, por exemplo:",
      "DATABASE_PATH=dev.db",
      "ou utilize um caminho absoluto em produção.",
    ].join(" ")
  );
}

/**
 * Retorna o caminho do banco SQLite.
 *
 * Desenvolvimento:
 *   data/dev.db
 *
 * Produção:
 *   DATABASE_PATH pode receber um caminho absoluto.
 *
 * Exemplos:
 *
 * DATABASE_PATH=dev.db
 *
 * ou:
 *
 * DATABASE_PATH=/var/www/facil-digital-plus/data/prod.db
 */
export function getDatabasePath(): string {
  const configuredPath =
    process.env.DATABASE_PATH?.trim();

  /**
   * Em produção podemos utilizar um caminho absoluto
   * provisionado diretamente na VPS.
   */
  if (
    configuredPath &&
    isAbsolute(configuredPath)
  ) {
    return configuredPath;
  }

  /**
   * Caminhos relativos ficam obrigatoriamente
   * confinados à pasta data/.
   */
  ensureLocalDataDirectory();

  const databaseFilename = configuredPath
    ? getRelativeDatabaseFilename(configuredPath)
    : "dev.db";

  return join(
    process.cwd(),
    "data",
    databaseFilename
  );
}

/**
 * Retorna a conexão SQLite nativa.
 *
 * A conexão é singleton dentro do processo Node.
 */
export function getSqliteConnection(): SqliteDatabase {
  if (sqliteInstance) {
    return sqliteInstance;
  }

  const databasePath = getDatabasePath();

  console.log(
    `💾 Banco SQLite: ${databasePath}`
  );

  const sqlite = new Database(databasePath);

  /**
   * WAL permite melhor concorrência entre
   * leitura e escrita.
   */
  sqlite.pragma("journal_mode = WAL");

  /**
   * Ativa integridade referencial.
   */
  sqlite.pragma("foreign_keys = ON");

  /**
   * Aguarda pequenas concorrências de escrita
   * antes de retornar SQLITE_BUSY.
   */
  sqlite.pragma("busy_timeout = 5000");

  sqliteInstance = sqlite;

  return sqliteInstance;
}

/**
 * Retorna a instância Drizzle ORM.
 *
 * Também é singleton dentro do processo.
 */
export function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = drizzle(
    getSqliteConnection(),
    {
      schema,
    }
  );

  return dbInstance;
}

/**
 * Fecha explicitamente a conexão.
 *
 * Utilizado principalmente pelos testes e scripts CLI.
 */
export function closeDatabase(): void {
  if (sqliteInstance?.open) {
    sqliteInstance.close();
  }

  sqliteInstance = null;
  dbInstance = null;
}