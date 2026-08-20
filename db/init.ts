import { getDb } from "./index";
import * as schema from "./schema";

export async function initDatabase() {
  console.log("🚀 Inicializando banco de dados...");
  
  const db = getDb();
  
  // Verificar se estamos em ambiente local (SQLite)
  const isCloudflare = typeof (globalThis as any).caches !== "undefined";
  
  if (!isCloudflare) {
    console.log("📋 Criando tabelas no SQLite local...");
    
    // Criar tabelas manualmente (SQLite não suporta drizzle push direto)
    const sql = (db as any).session?.prepareQuery;
    
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT,
        cpf TEXT,
        phone TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      
      `CREATE TABLE IF NOT EXISTS products (
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
      )`,
      
      `CREATE TABLE IF NOT EXISTS orders (
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
      )`,
      
      `CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      
      `CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bank TEXT NOT NULL,
        subject TEXT NOT NULL,
        question_text TEXT NOT NULL,
        options TEXT NOT NULL,
        correct_answer INTEGER NOT NULL,
        explanation TEXT,
        difficulty TEXT DEFAULT 'medium',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      
      `CREATE TABLE IF NOT EXISTS simulations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        bank TEXT NOT NULL,
        description TEXT,
        time_limit INTEGER NOT NULL,
        question_ids TEXT NOT NULL,
        active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      
      `CREATE TABLE IF NOT EXISTS simulation_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        simulation_id INTEGER NOT NULL REFERENCES simulations(id),
        score INTEGER NOT NULL,
        total_questions INTEGER NOT NULL,
        time_spent INTEGER NOT NULL,
        answers TEXT NOT NULL,
        completed_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      
      `CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      
      `CREATE TABLE IF NOT EXISTS protected_downloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        order_id INTEGER REFERENCES orders(id),
        download_token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    ];
    
    for (const createTable of tables) {
      try {
        (db as any).run(createTable);
      } catch (error: any) {
        if (!error.message.includes("already exists")) {
          console.error("Erro ao criar tabela:", error.message);
        }
      }
    }
    
    console.log("✅ Tabelas criadas com sucesso!");
  } else {
    console.log("☁️  Ambiente Cloudflare detectado - tabelas devem ser criadas via migrations");
  }
  
  return db;
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  initDatabase().then(() => {
    console.log("✅ Inicialização concluída!");
    process.exit(0);
  }).catch((error) => {
    console.error("❌ Falha na inicialização:", error);
    process.exit(1);
  });
}