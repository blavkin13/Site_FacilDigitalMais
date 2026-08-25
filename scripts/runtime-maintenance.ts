import {
  closeDatabase,
} from "../db/index";

import {
  runRuntimeMaintenance,
} from "../lib/runtime-maintenance";


async function main() {
  const apply =
    process.argv.includes(
      "--apply"
    );


  console.log(
    apply
      ? "🛠️ Executando manutenção operacional..."
      : "🔎 Inspecionando manutenção operacional..."
  );


  const report =
    await runRuntimeMaintenance({
      apply,
    });


  console.log(
    ""
  );


  console.log(
    "⏰ Tentativas vencidas ainda marcadas como in_progress:",
    report.staleAttempts
  );


  console.log(
    "🔐 Sessões expiradas ainda presentes:",
    report.staleSessions
  );


  if (
    apply
  ) {
    console.log(
      ""
    );


    console.log(
      "✅ Manutenção aplicada."
    );


    console.log(
      "   Tentativas marcadas expired:",
      report.expiredAttempts
    );


    console.log(
      "   Sessões removidas:",
      report.removedSessions
    );


    console.log(
      "   PRAGMA optimize:",
      report.optimizeExecuted
        ? "executado"
        : "não executado"
    );
  } else {
    console.log(
      ""
    );


    console.log(
      "ℹ️ Nenhum dado foi alterado."
    );


    console.log(
      "   Para aplicar: npm run maintenance:runtime:apply"
    );
  }
}


main()
  .catch(
    (
      error
    ) => {
      console.error(
        "❌ Falha na manutenção operacional:",
        error
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