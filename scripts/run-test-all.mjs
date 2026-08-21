import {
  createHash,
} from "node:crypto";

import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  readlinkSync,
} from "node:fs";

import {
  join,
  relative,
} from "node:path";

import {
  spawnSync,
} from "node:child_process";


const projectRoot =
  process.cwd();


const dataDirectory =
  join(
    projectRoot,
    "data"
  );


function hashFile(
  path
) {
  return createHash(
    "sha256"
  )
    .update(
      readFileSync(
        path
      )
    )
    .digest(
      "hex"
    );
}


/**
 * Produz uma assinatura determinística de todo o diretório
 * persistente data/.
 *
 * São considerados:
 *
 * - nomes dos arquivos;
 * - nomes dos diretórios;
 * - conteúdo dos arquivos;
 * - links simbólicos.
 *
 * Datas de acesso/modificação não entram na assinatura.
 */
export function snapshotDataDirectory() {
  if (
    !existsSync(
      dataDirectory
    )
  ) {
    return "DATA_DIRECTORY_MISSING";
  }


  const records = [];


  function walk(
    directory
  ) {
    const entries =
      readdirSync(
        directory
      ).sort();


    for (
      const entry of entries
    ) {
      const absolutePath =
        join(
          directory,
          entry
        );


      const relativePath =
        relative(
          dataDirectory,
          absolutePath
        )
          .replaceAll(
            "\\",
            "/"
          );


      const stats =
        lstatSync(
          absolutePath
        );


      if (
        stats.isSymbolicLink()
      ) {
        records.push(
          `L:${relativePath}:${readlinkSync(absolutePath)}`
        );

        continue;
      }


      if (
        stats.isDirectory()
      ) {
        records.push(
          `D:${relativePath}`
        );


        walk(
          absolutePath
        );

        continue;
      }


      if (
        stats.isFile()
      ) {
        records.push(
          `F:${relativePath}:${hashFile(absolutePath)}`
        );
      }
    }
  }


  walk(
    dataDirectory
  );


  return createHash(
    "sha256"
  )
    .update(
      records.join(
        "\n"
      )
    )
    .digest(
      "hex"
    );
}


function npmCommand() {
  return process.platform ===
    "win32"
    ? "npm.cmd"
    : "npm";
}


function runScript(
  script
) {
  console.log(
    `\n🧪 [GUARD] Executando npm run ${script}\n`
  );


  return spawnSync(
    npmCommand(),
    [
      "run",
      script,
    ],
    {
      cwd:
        projectRoot,

      stdio:
        "inherit",

      env: {
        ...process.env,

        FACILDIGITAL_TEST_GUARD:
          "1",
      },
    }
  );
}


const scripts =
  process.argv.slice(
    2
  );


if (
  scripts.length === 0
) {
  console.error(
    "❌ Nenhuma suíte foi fornecida ao guard global."
  );


  process.exit(
    1
  );
}


const beforeSnapshot =
  snapshotDataDirectory();


console.log(
  "🛡️  Proteção de testes ativada."
);


console.log(
  `🛡️  Snapshot inicial de data/: ${beforeSnapshot}`
);


let failedScript =
  null;


let failedStatus =
  0;


for (
  const script of scripts
) {
  const result =
    runScript(
      script
    );


  if (
    result.error
  ) {
    console.error(
      `❌ Não foi possível executar ${script}:`,
      result.error
    );


    failedScript =
      script;


    failedStatus =
      1;


    break;
  }


  if (
    result.status !==
    0
  ) {
    failedScript =
      script;


    failedStatus =
      result.status ??
      1;


    break;
  }
}


const afterSnapshot =
  snapshotDataDirectory();


console.log(
  `\n🛡️  Snapshot final de data/: ${afterSnapshot}`
);


const dataChanged =
  beforeSnapshot !==
  afterSnapshot;


if (
  dataChanged
) {
  console.error(
    [
      "",
      "❌ VIOLAÇÃO DE ISOLAMENTO:",
      "o diretório persistente data/ foi alterado durante npm run test:all.",
      "",
      "Nenhuma suíte automatizada pode modificar:",
      "- data/dev.db",
      "- data/protected/",
      "- products.json",
      "- qualquer outro arquivo persistente em data/.",
      "",
      "O test:all será considerado com falha.",
    ].join(
      "\n"
    )
  );
}


if (
  failedScript
) {
  console.error(
    `\n❌ Suíte com falha: ${failedScript}`
  );
}


if (
  dataChanged ||
  failedScript
) {
  process.exit(
    failedStatus ||
      1
  );
}


console.log(
  [
    "",
    "✅ Todas as suítes passaram.",
    "✅ Build de produção passou.",
    "✅ Diretório data/ permaneceu byte a byte inalterado.",
    "✅ Isolamento global confirmado.",
  ].join(
    "\n"
  )
);