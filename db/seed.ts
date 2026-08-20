import { initDatabase } from "./init";
import { registerUser } from "../lib/auth";
import { getDb } from "./index";
import { users } from "./schema";
import { eq } from "drizzle-orm";

export async function seedAdmin() {
  console.log("🌱 Iniciando seed do administrador...");
  
  // Inicializar banco primeiro
  await initDatabase();
  
  const adminEmail = "digicopiamix@facildigitalmais.com";
  const adminPassword = "5290Digi$";
  const adminName = "Administrador Sistema";
  
  try {
    const db = getDb();
    
    // Verificar se admin já existe
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, adminEmail))
      .get();
    
    if (existing) {
      console.log("ℹ️  Administrador já existe no banco de dados.");
      console.log(`   Email: ${existing.email}`);
      console.log(`   ID: ${existing.id}`);
      console.log(`   Role: ${existing.role}`);
      return existing;
    }
    
    // Criar novo admin
    const admin = await registerUser(
      adminEmail,
      adminPassword,
      adminName,
      undefined,
      undefined,
      "admin"
    );
    
    if (admin) {
      console.log("✅ Administrador criado com sucesso!");
      console.log(`   Email: ${adminEmail}`);
      console.log(`   ID: ${admin.id}`);
      console.log(`   Role: ${admin.role}`);
    }
    
    return admin;
  } catch (error) {
    console.error("❌ Erro ao criar administrador:", error);
    throw error;
  }
}

// Executar seed se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  seedAdmin().then(() => {
    console.log("✅ Seed concluído!");
    process.exit(0);
  }).catch((error) => {
    console.error("❌ Falha no seed:", error);
    process.exit(1);
  });
}