import {
  closeDatabase,
} from "../db/index";

import {
  loadProductsToDb,
} from "../lib/json-loader-runtime";

/**
 * ============================================================
 * CLI - CARGA DE PRODUTOS
 * ============================================================
 *
 * Executado através de:
 *
 *   npm run db:load-products
 *
 * Responsabilidades:
 *
 * 1. carregar data/products.json;
 * 2. validar os produtos;
 * 3. sincronizar os registros com SQLite;
 * 4. fechar a conexão ao terminar;
 * 5. retornar exit code diferente de zero em caso de erro.
 *
 * Este wrapper evita código inline com "tsx -e" e torna
 * a operação reutilizável, testável e adequada para CI/CD.
 */

async function main(): Promise<void> {
  console.log(
    "📦 Iniciando sincronização de produtos..."
  );

  try {
    const processed =
      await loadProductsToDb();

    console.log(
      `✅ Sincronização concluída. ${processed} produto(s) processado(s).`
    );
  } catch (error) {
    console.error(
      "❌ Falha ao carregar produtos:"
    );

    if (
      error instanceof Error
    ) {
      console.error(
        error.message
      );

      if (
        process.env.NODE_ENV !==
        "production"
      ) {
        console.error(
          error.stack
        );
      }
    } else {
      console.error(
        String(error)
      );
    }

    process.exitCode = 1;
  } finally {
    /**
     * Este é um processo CLI.
     *
     * Diferentemente do servidor Next.js,
     * não existe motivo para manter a conexão
     * SQLite aberta depois da operação.
     */
    closeDatabase();
  }
}

void main();