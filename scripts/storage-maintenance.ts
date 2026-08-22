import {
  initDatabase,
} from "../db/init";

import {
  runManagedStorageMaintenance,
} from "../lib/admin-product-storage-maintenance";


async function main() {
  const apply =
    process.argv.includes(
      "--apply"
    );


  await initDatabase();


  console.log(
    apply
      ? "🧹 Executando manutenção do armazenamento..."
      : "🔎 Inspecionando armazenamento em modo seguro..."
  );


  const report =
    await runManagedStorageMaintenance({
      apply,
    });


  console.log(
    ""
  );


  console.log(
    "📦 Referências quebradas:",
    report
      .brokenReferences
      .length
  );


  for (
    const issue of
      report
        .brokenReferences
  ) {
    console.log(
      `  - Produto ${issue.productId} / ${issue.field}: ${issue.message}`
    );
  }


  console.log(
    ""
  );


  console.log(
    "🖼️ Capas órfãs:",
    report
      .managedAssets
      .coverOrphans
      .length
  );


  console.log(
    "📄 PDFs originais órfãos:",
    report
      .managedAssets
      .pdfOrphans
      .length
  );


  console.log(
    "⏰ Downloads expirados:",
    report
      .protectedDownloads
      .expiredRecords
      .length
  );


  console.log(
    "⚠️ Expirações inválidas:",
    report
      .protectedDownloads
      .invalidExpiryRecords
      .length
  );


  console.log(
    "🗑️ PDFs protegidos órfãos:",
    report
      .protectedDownloads
      .orphanFiles
      .length
  );


  if (
    apply
  ) {
    console.log(
      ""
    );


    console.log(
      "✅ Limpeza aplicada."
    );


    console.log(
      "  Capas removidas:",
      report
        .managedAssets
        .removedCoverOrphans
    );


    console.log(
      "  PDFs originais removidos:",
      report
        .managedAssets
        .removedPdfOrphans
    );


    console.log(
      "  Registros expirados removidos:",
      report
        .protectedDownloads
        .removedRecords
    );


    console.log(
      "  PDFs protegidos expirados removidos:",
      report
        .protectedDownloads
        .removedFiles
    );


    console.log(
      "  PDFs protegidos órfãos removidos:",
      report
        .protectedDownloads
        .removedOrphanFiles
    );
  } else {
    console.log(
      ""
    );


    console.log(
      "ℹ️ Nenhum arquivo foi alterado."
    );


    console.log(
      "   Para aplicar a limpeza: npm run storage:cleanup"
    );
  }
}


main().catch(
  (
    error
  ) => {
    console.error(
      "❌ Falha na manutenção do armazenamento:",
      error
    );


    process.exitCode =
      1;
  }
);