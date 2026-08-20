import { drizzle } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import * as schema from "./schema";

let dbInstance: any = null;

export function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  // Detectar ambiente: Cloudflare Workers ou Node.js local
  const isCloudflare = typeof (globalThis as any).caches !== "undefined" || 
                       typeof (globalThis as any).WebSocketPair !== "undefined";

  if (isCloudflare) {
    // Ambiente Cloudflare Workers (produção)
    const { env } = require("cloudflare:workers");
    if (!env.DB) {
      throw new Error(
        "Cloudflare D1 binding `DB` is unavailable."
      );
    }
    dbInstance = drizzleD1(env.DB, { schema });
    console.log("🌩️  Conectado ao Cloudflare D1");
  } else {
    // Ambiente Node.js local (desenvolvimento)
    const dbPath = join(process.cwd(), "data", "dev.db");
    const dbDir = dirname(dbPath);
    
    // Criar diretório se não existir
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
    
    // Criar ou abrir banco SQLite local
    const sqlite = new Database(dbPath);
    
    // Habilitar WAL mode para melhor performance
    sqlite.pragma("journal_mode = WAL");
    
    dbInstance = drizzle(sqlite, { schema });
    console.log("💾 Conectado ao SQLite local:", dbPath);
  }

  return dbInstance;
}