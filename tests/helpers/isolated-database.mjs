import {
  mkdtempSync,
  rmSync,
} from "node:fs";

import {
  tmpdir,
} from "node:os";

import {
  join,
} from "node:path";

import {
  initDatabase,
} from "../../db/init.ts";

import {
  closeDatabase,
} from "../../db/index.ts";

import {
  seedAdmin,
} from "../../db/seed.ts";

import {
  seedTestOrders,
} from "../../db/seed-orders.ts";

import {
  seedSimulations,
} from "../../db/seed-simulations.ts";

import {
  loadProductsToDb,
} from "../../lib/json-loader-runtime.ts";


let activeContext = null;


/**
 * Restaura uma variável de ambiente exatamente ao estado
 * em que estava antes do teste.
 */
function restoreEnvironmentValue(
  name,
  previousValue
) {
  if (
    previousValue ===
    undefined
  ) {
    delete process.env[name];

    return;
  }


  process.env[name] =
    previousValue;
}


/**
 * Cria um ambiente SQLite descartável para uma suíte.
 *
 * IMPORTANTE:
 *
 * Cada arquivo de teste executado pelos scripts npm roda
 * em processo separado. Portanto, existe somente um banco
 * isolado por processo de teste.
 *
 * Nunca utilizar:
 *
 *   data/dev.db
 *
 * dentro dos testes de integração.
 */
export async function createIsolatedDatabase({
  admin = false,
  products = false,
  orders = false,
  simulations = false,
} = {}) {
  if (
    activeContext
  ) {
    throw new Error(
      "Já existe um banco isolado ativo neste processo."
    );
  }


  const rootDirectory =
    mkdtempSync(
      join(
        tmpdir(),
        "facildigital-test-"
      )
    );


  const databasePath =
    join(
      rootDirectory,
      "test.db"
    );


  const protectedPdfDirectory =
    join(
      rootDirectory,
      "protected"
    );


  const previousEnvironment = {
    DATABASE_PATH:
      process.env
        .DATABASE_PATH,

    PROTECTED_PDF_DIR:
      process.env
        .PROTECTED_PDF_DIR,

    NODE_ENV:
      process.env
        .NODE_ENV,
  };


  /**
   * Caminho absoluto.
   *
   * db/index.ts aceita caminhos absolutos para os bancos
   * provisionados externamente, o que também é ideal
   * para nosso SQLite temporário.
   */
  process.env.DATABASE_PATH =
    databasePath;

  process.env.PROTECTED_PDF_DIR =
    protectedPdfDirectory;

  process.env.NODE_ENV =
    "test";


  await initDatabase();


  /**
   * As dependências são automaticamente satisfeitas.
   *
   * Pedidos precisam:
   *   admin + produtos
   *
   * Simulados precisam:
   *   admin + produtos + pedido
   *
   * Isso permite que uma suíte peça somente o nível
   * de fixture de que realmente precisa.
   */
  const needsAdmin =
    admin ||
    orders ||
    simulations;


  const needsProducts =
    products ||
    orders ||
    simulations;


  if (
    needsAdmin
  ) {
    await seedAdmin();
  }


  if (
    needsProducts
  ) {
    await loadProductsToDb();
  }


  if (
    orders ||
    simulations
  ) {
    await seedTestOrders();
  }


  if (
    simulations
  ) {
    await seedSimulations();
  }


  let cleanedUp =
    false;


  const context = {
    rootDirectory,

    databasePath,

    protectedPdfDirectory,

    cleanup() {
      if (
        cleanedUp
      ) {
        return;
      }


      cleanedUp =
        true;


      /**
       * Fecha WAL/SHM antes de remover o diretório.
       */
      closeDatabase();


      rmSync(
        rootDirectory,
        {
          recursive: true,
          force: true,
        }
      );


      restoreEnvironmentValue(
        "DATABASE_PATH",
        previousEnvironment
          .DATABASE_PATH
      );


      restoreEnvironmentValue(
        "PROTECTED_PDF_DIR",
        previousEnvironment
          .PROTECTED_PDF_DIR
      );


      restoreEnvironmentValue(
        "NODE_ENV",
        previousEnvironment
          .NODE_ENV
      );


      activeContext =
        null;
    },
  };


  activeContext =
    context;


  return context;
}