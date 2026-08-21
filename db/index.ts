import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import * as schema from "./schema";

let dbInstance: ReturnType<typeof drizzle> | null = null;

function getDatabasePath(): string {
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH;
  }

  const dataDir = join(process.cwd(), "data");

  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  return join(dataDir, "dev.db");
}

export function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = getDatabasePath();

  const dbDir = dirname(dbPath);

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  console.log(`💾 Banco SQLite: ${dbPath}`);

  const sqlite = new Database(dbPath);

  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  dbInstance = drizzle(sqlite, { schema });

  return dbInstance;
}