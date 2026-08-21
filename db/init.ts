import { pathToFileURL } from "node:url";
import { getDb, getSqliteConnection } from "./index";
import { runMigrations } from "./migrations";

type DatabaseInstance = ReturnType<typeof getDb>;

/**
 * Promise compartilhada de inicialização.
 *
 * Em uma aplicação Next.js várias requisições podem tentar
 * inicializar o banco quase simultaneamente.
 *
 * Guardando a Promise, todas passam a aguardar a mesma
 * inicialização em vez de executar migrations repetidamente.
 */
let initializationPromise: Promise<DatabaseInstance> | null = null;

/**
 * Inicializa o banco de dados da aplicação.
 *
 * Esta função é segura para ser chamada várias vezes durante
 * a vida do processo Node.js. As migrations serão verificadas
 * somente na primeira chamada.
 */
export function initDatabase(): Promise<DatabaseInstance> {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    console.log("🚀 Inicializando banco de dados...");

    const sqlite = getSqliteConnection();

    console.log("📋 Verificando migrations do SQLite...");

    const migrationResult = runMigrations(sqlite);

    if (migrationResult.applied.length === 0) {
      console.log(
        `✅ Banco atualizado. ${migrationResult.total} migration(s) já aplicada(s).`
      );
    } else {
      console.log(
        `✅ Banco atualizado. ${migrationResult.applied.length} migration(s) aplicada(s) nesta inicialização.`
      );
    }

    return getDb();
  })().catch((error) => {
    /**
     * Se a inicialização falhar, limpamos a Promise.
     *
     * Isso permite uma nova tentativa depois que a causa
     * do problema for corrigida.
     */
    initializationPromise = null;

    console.error("❌ Falha ao inicializar banco de dados:", error);

    throw error;
  });

  return initializationPromise;
}

/**
 * Permite executar:
 *
 * npm run db:init
 * npm run db:migrate
 */
const executedDirectly =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (executedDirectly) {
  initDatabase()
    .then(() => {
      console.log("✅ Inicialização concluída!");
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}