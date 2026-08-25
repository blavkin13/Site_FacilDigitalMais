import {
  randomBytes,
} from "node:crypto";

import {
  mkdir,
  readdir,
  unlink,
} from "node:fs/promises";

import {
  isAbsolute,
  join,
} from "node:path";

import Database from "better-sqlite3";

import {
  getSqliteConnection,
} from "../db/index";

import {
  initDatabase,
} from "../db/init";


const BACKUP_PREFIX =
  "facildigital-sqlite-";

const BACKUP_EXTENSION =
  ".db";

const DEFAULT_RETENTION =
  14;

const MAX_RETENTION =
  365;


export type DatabaseBackupResult = {
  path:
    string;

  filename:
    string;

  integrity:
    "ok";

  removedOldBackups:
    number;

  retentionCount:
    number;
};


function formatBackupTimestamp(
  date:
    Date
) {
  return date
    .toISOString()
    .replace(
      /[-:]/g,
      ""
    )
    .replace(
      ".",
      "-"
    );
}


function parseRetention(
  value:
    number |
    string |
    undefined
) {
  if (
    value ===
    undefined
  ) {
    const configured =
      process.env
        .DATABASE_BACKUP_RETENTION
        ?.trim();


    if (
      !configured
    ) {
      return DEFAULT_RETENTION;
    }


    value =
      configured;
  }


  const parsed =
    Number(
      value
    );


  if (
    !Number.isInteger(
      parsed
    ) ||
    parsed <
      1 ||
    parsed >
      MAX_RETENTION
  ) {
    throw new Error(
      `DATABASE_BACKUP_RETENTION deve estar entre 1 e ${MAX_RETENTION}.`
    );
  }


  return parsed;
}


export function getDatabaseBackupDirectory(
  explicitDirectory?:
    string
) {
  const configured =
    explicitDirectory
      ?.trim() ||
    process.env
      .DATABASE_BACKUP_DIR
      ?.trim();


  /**
   * No ambiente local mantemos um fallback
   * estático dentro de data/backups.
   *
   * Em produção exigimos explicitamente um
   * diretório absoluto fora do diretório de
   * release da aplicação.
   */
  if (
    !configured
  ) {
    if (
      process.env.NODE_ENV ===
      "production"
    ) {
      throw new Error(
        "DATABASE_BACKUP_DIR deve ser configurado em produção."
      );
    }


    return join(
      process.cwd(),
      "data",
      "backups"
    );
  }


  if (
    !isAbsolute(
      configured
    )
  ) {
    throw new Error(
      "DATABASE_BACKUP_DIR deve ser um caminho absoluto."
    );
  }


  return configured;
}


async function verifyBackupIntegrity(
  backupPath:
    string
) {
  const backup =
    new Database(
      backupPath,
      {
        readonly:
          true,

        fileMustExist:
          true,
      }
    );


  try {
    const integrity =
      backup.pragma(
        "integrity_check",
        {
          simple:
            true,
        }
      );


    if (
      integrity !==
      "ok"
    ) {
      throw new Error(
        `Backup SQLite inválido: ${String(
          integrity
        )}`
      );
    }
  } finally {
    backup.close();
  }
}


async function cleanupOldBackups(
  directory:
    string,
  retentionCount:
    number
) {
  const files =
    await readdir(
      directory,
      {
        withFileTypes:
          true,
      }
    );


  /**
   * O timestamp ISO normalizado vem no início do
   * nome, portanto ordenação lexical descendente
   * também representa newest → oldest.
   *
   * Somente arquivos criados por esta rotina
   * entram na retenção.
   */
  const backups =
    files
      .filter(
        (
          entry
        ) =>
          entry.isFile() &&
          entry.name.startsWith(
            BACKUP_PREFIX
          ) &&
          entry.name.endsWith(
            BACKUP_EXTENSION
          )
      )
      .map(
        (
          entry
        ) =>
          entry.name
      )
      .sort(
        (
          a,
          b
        ) =>
          b.localeCompare(
            a
          )
      );


  const oldBackups =
    backups.slice(
      retentionCount
    );


  let removed =
    0;


  for (
    const filename of
      oldBackups
  ) {
    await unlink(
      join(
        directory,
        filename
      )
    );


    removed +=
      1;
  }


  return removed;
}


export async function createDatabaseBackup({
  backupDirectory,
  retentionCount,
  now =
    new Date(),
}: {
  backupDirectory?:
    string;

  retentionCount?:
    number;

  now?:
    Date;
} = {}): Promise<DatabaseBackupResult> {
  if (
    !(now instanceof Date) ||
    !Number.isFinite(
      now.getTime()
    )
  ) {
    throw new Error(
      "Data inválida para criação do backup."
    );
  }


  const directory =
    getDatabaseBackupDirectory(
      backupDirectory
    );


  const retention =
    parseRetention(
      retentionCount
    );


  await mkdir(
    directory,
    {
      recursive:
        true,

      mode:
        0o750,
    }
  );


  await initDatabase();


  const sqlite =
    getSqliteConnection();


  const timestamp =
    formatBackupTimestamp(
      now
    );


  const randomSuffix =
    randomBytes(
      4
    ).toString(
      "hex"
    );


  const filename =
    `${BACKUP_PREFIX}${timestamp}-${randomSuffix}${BACKUP_EXTENSION}`;


  const destination =
    join(
      directory,
      filename
    );


  /**
   * IMPORTANTE:
   *
   * Não usamos:
   *
   *   copyFile(prod.db, backup.db)
   *
   * O banco opera em WAL e uma simples cópia do
   * arquivo principal pode não representar todo o
   * estado confirmado.
   *
   * better-sqlite3 usa a Online Backup API do
   * SQLite e produz um banco consistente.
   */
  await sqlite.backup(
    destination
  );


  /**
   * O backup só é considerado concluído depois
   * que a cópia consegue ser aberta e passar por
   * PRAGMA integrity_check.
   */
  await verifyBackupIntegrity(
    destination
  );


  /**
   * A retenção só é executada depois que o backup
   * novo foi criado e validado.
   *
   * Assim nunca apagamos backups antigos antes de
   * sabermos que o novo é utilizável.
   */
  const removedOldBackups =
    await cleanupOldBackups(
      directory,
      retention
    );


  return {
    path:
      destination,

    filename,

    integrity:
      "ok",

    removedOldBackups,

    retentionCount:
      retention,
  };
}