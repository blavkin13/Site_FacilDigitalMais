import { drizzle } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as schema from "./schema";

let dbInstance: any = null;

// ==========================================
// DETECÇÃO DO AMBIENTE
// ==========================================

function detectCodespacePath(): string | null {
  // Método 1: Variável de ambiente do Codespace
  const codespaceName = process.env.CODESPACE_NAME;
  const repository = process.env.GITHUB_REPOSITORY;
  
  if (codespaceName || repository) {
    // Caminho padrão do Codespace
    const possiblePaths = [
      "/workspaces/Site_FacilDigitalMais",
      "/workspaces/site_facildigitalmais",
      `/workspaces/${codespaceName}`,
    ];
    
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        console.log(`🎯 Codespace detectado: ${path}`);
        return path;
      }
    }
  }

  // Método 2: Verificar caminhos comuns
  const commonPaths = [
    "/workspaces/Site_FacilDigitalMais",
    process.cwd(),
    dirname(process.cwd()),
  ];

  for (const path of commonPaths) {
    if (path && existsSync(path) && existsSync(join(path, "package.json"))) {
      return path;
    }
  }

  return null;
}

function getProjectRoot(): string {
  // Tentar detectar ambiente Codespace primeiro
  const codespacePath = detectCodespacePath();
  if (codespacePath) {
    return codespacePath;
  }

  // Método ESM: import.meta.url
  try {
    if (typeof import.meta !== "undefined" && import.meta.url && !import.meta.url.includes("virtual:")) {
      const currentFile = fileURLToPath(import.meta.url);
      const currentDir = dirname(currentFile);
      return dirname(currentDir);
    }
  } catch {}

  // Fallback: process.cwd()
  return process.cwd();
}

// ==========================================
// GARANTIR DIRETÓRIO DE DADOS
// ==========================================

function ensureDataDir(root: string): string {
  const dataDir = join(root, "data");
  
  // Se o diretório já existe, retornar
  if (existsSync(dataDir)) {
    return dataDir;
  }

  // Tentar criar
  try {
    mkdirSync(dataDir, { recursive: true });
    console.log(`📁 Diretório criado: ${dataDir}`);
    return dataDir;
  } catch (err: any) {
    // Se não conseguir criar, verificar se o arquivo existe mesmo assim
    const dbPath = join(dataDir, "dev.db");
    if (existsSync(dbPath)) {
      console.log(`📁 Diretório inacessível, mas banco existe: ${dbPath}`);
      return dataDir;
    }
    throw new Error(`Não foi possível criar ${dataDir}: ${err.message}`);
  }
}

// ==========================================
// CRIAR INSTÂNCIA DO BANCO
// ==========================================

function createSqliteDb(root: string): any {
  const dataDir = ensureDataDir(root);
  const dbPath = join(dataDir, "dev.db");

  // Se o arquivo não existe, inicializar
  if (!existsSync(dbPath)) {
    console.log(`📄 Arquivo ${dbPath} não existe. Será criado.`);
  } else {
    console.log(`📄 Abrindo banco existente: ${dbPath}`);
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  return drizzle(sqlite, { schema });
}

function createMemoryDb(): any {
  console.warn("⚠️  Usando banco em memória (dados não serão persistidos)");
  const sqlite = new Database(":memory:");
  
  // Criar tabelas básicas em memória
  sqlite.exec(`
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
    
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      price REAL NOT NULL,
      active INTEGER DEFAULT 1
    );
    
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      total REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  
  return drizzle(sqlite, { schema });
}

// ==========================================
// FUNÇÃO PRINCIPAL EXPORTADA
// ==========================================

export function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  // 1. Tentar Cloudflare D1 (produção)
  try {
    if (
      typeof (globalThis as any).caches !== "undefined" ||
      typeof (globalThis as any).WebSocketPair !== "undefined"
    ) {
      try {
        const { env } = require("cloudflare:workers");
        if (env && env.DB) {
          dbInstance = drizzleD1(env.DB, { schema });
          console.log("🌩️  Conectado ao Cloudflare D1");
          return dbInstance;
        }
      } catch {}
    }
  } catch {}

  // 2. Tentar SQLite local
  const projectRoot = getProjectRoot();
  console.log(`🔍 Raiz do projeto detectada: ${projectRoot}`);

  try {
    dbInstance = createSqliteDb(projectRoot);
    console.log("💾 Conectado ao SQLite local");
    return dbInstance;
  } catch (sqliteError: any) {
    console.warn(`⚠️  Falha ao abrir SQLite local: ${sqliteError.message}`);
    
    // 3. Fallback: banco em memória
    try {
      dbInstance = createMemoryDb();
      console.log("🧠 Usando banco em memória (dados temporários)");
      return dbInstance;
    } catch (memError: any) {
      console.error(`❌ Falha crítica no banco: ${memError.message}`);
      throw new Error(
        "Não foi possível inicializar o banco de dados. " +
        "Verifique as permissões de arquivo ou execute 'npm run db:init' primeiro."
      );
    }
  }
}