import {
  existsSync,
} from "node:fs";

import {
  isAbsolute,
} from "node:path";

import Database
  from "better-sqlite3";

import {
  getDatabasePath,
} from "../db/index";

import {
  collectPaymentDiagnostics,
  formatPaymentDiagnostics,
  PaymentDiagnosticsError,
} from "../lib/payment-observability";


interface CliOptions {
  json:
    boolean;

  pendingOlderThanHours:
    number;

  recentLimit:
    number;
}


function fail(
  message:
    string
): never {
  throw new PaymentDiagnosticsError(
    message
  );
}


function parseIntegerOption(
  value:
    string,

  name:
    string,

  minimum:
    number,

  maximum:
    number
): number {
  const parsed =
    Number(
      value
    );


  if (
    !Number.isInteger(
      parsed
    ) ||
    parsed <
      minimum ||
    parsed >
      maximum
  ) {
    fail(
      `${name} deve ser inteiro entre ${minimum} e ${maximum}.`
    );
  }


  return parsed;
}


function parseOptions(
  args:
    string[]
): CliOptions {
  let json =
    false;

  let pendingOlderThanHours =
    24;

  let recentLimit =
    25;


  for (
    const argument
    of args
  ) {
    if (
      argument ===
      "--json"
    ) {
      json =
        true;

      continue;
    }


    if (
      argument.startsWith(
        "--pending-hours="
      )
    ) {
      pendingOlderThanHours =
        parseIntegerOption(
          argument.slice(
            "--pending-hours="
              .length
          ),
          "--pending-hours",
          1,
          24 * 365
        );

      continue;
    }


    if (
      argument.startsWith(
        "--limit="
      )
    ) {
      recentLimit =
        parseIntegerOption(
          argument.slice(
            "--limit="
              .length
          ),
          "--limit",
          1,
          100
        );

      continue;
    }


    fail(
      `Argumento não reconhecido: ${argument}`
    );
  }


  return {
    json,
    pendingOlderThanHours,
    recentLimit,
  };
}


function validateProductionDatabaseConfiguration():
  void {
  if (
    process.env.NODE_ENV !==
    "production"
  ) {
    return;
  }


  const configuredPath =
    process.env
      .DATABASE_PATH
      ?.trim();


  if (
    !configuredPath
  ) {
    fail(
      "DATABASE_PATH é obrigatório para diagnóstico em produção."
    );
  }


  if (
    !isAbsolute(
      configuredPath
    )
  ) {
    fail(
      "DATABASE_PATH deve ser absoluto em produção."
    );
  }
}


function main() {
  const options =
    parseOptions(
      process.argv.slice(
        2
      )
    );


  validateProductionDatabaseConfiguration();


  const databasePath =
    getDatabasePath();


  /**
   * O diagnóstico jamais cria banco novo.
   */
  if (
    !existsSync(
      databasePath
    )
  ) {
    fail(
      `Banco SQLite não encontrado: ${databasePath}`
    );
  }


  const sqlite =
    new Database(
      databasePath,
      {
        readonly:
          true,

        fileMustExist:
          true,
      }
    );


  try {
    /**
     * Segunda defesa contra qualquer escrita
     * acidental introduzida futuramente.
     */
    sqlite.pragma(
      "query_only = ON"
    );


    const report =
      collectPaymentDiagnostics(
        sqlite,
        {
          pendingOlderThanHours:
            options
              .pendingOlderThanHours,

          recentLimit:
            options
              .recentLimit,
        }
      );


    if (
      options.json
    ) {
      process.stdout.write(
        `${JSON.stringify(
          report,
          null,
          2
        )}\n`
      );

      return;
    }


    process.stdout.write(
      `${formatPaymentDiagnostics(
        report
      )}\n`
    );
  } finally {
    sqlite.close();
  }
}


try {
  main();
} catch (
  error
) {
  if (
    error instanceof
    PaymentDiagnosticsError
  ) {
    console.error(
      `❌ Diagnóstico financeiro indisponível: ${error.message}`
    );
  } else {
    /**
     * Não imprimimos objeto Error completo.
     *
     * Stack traces podem carregar detalhes
     * desnecessários do ambiente operacional.
     */
    console.error(
      "❌ Falha inesperada durante o diagnóstico financeiro."
    );
  }


  process.exitCode =
    1;
}