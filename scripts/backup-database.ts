import {
  closeDatabase,
} from "../db/index";

import {
  createDatabaseBackup,
} from "../lib/database-backup";


async function main() {
  console.log(
    "💾 Iniciando backup consistente do SQLite..."
  );


  const result =
    await createDatabaseBackup();


  console.log(
    ""
  );


  console.log(
    "✅ Backup concluído."
  );


  console.log(
    `   Arquivo: ${result.path}`
  );


  console.log(
    `   Integridade: ${result.integrity}`
  );


  console.log(
    `   Retenção: ${result.retentionCount} backup(s)`
  );


  console.log(
    `   Backups antigos removidos: ${result.removedOldBackups}`
  );
}


main()
  .catch(
    (
      error
    ) => {
      console.error(
        "❌ Falha no backup do SQLite:",
        error instanceof
          Error
          ? error.message
          : error
      );


      process.exitCode =
        1;
    }
  )
  .finally(
    () => {
      closeDatabase();
    }
  );