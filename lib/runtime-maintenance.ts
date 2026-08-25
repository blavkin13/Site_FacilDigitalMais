import {
  getSqliteConnection,
} from "../db/index";

import {
  initDatabase,
} from "../db/init";


export type RuntimeMaintenanceReport = {
  now:
    string;

  apply:
    boolean;

  staleAttempts:
    number;

  expiredAttempts:
    number;

  staleSessions:
    number;

  removedSessions:
    number;

  optimizeExecuted:
    boolean;
};


type CountRow = {
  total:
    number;
};


function readCount(
  value:
    CountRow | undefined
) {
  return Number(
    value?.total ??
    0
  );
}


export async function runRuntimeMaintenance({
  apply =
    false,

  now =
    new Date(),
}: {
  apply?:
    boolean;

  now?:
    Date;
} = {}): Promise<RuntimeMaintenanceReport> {
  if (
    !(now instanceof Date) ||
    !Number.isFinite(
      now.getTime()
    )
  ) {
    throw new Error(
      "Data inválida para manutenção operacional."
    );
  }


  await initDatabase();


  const sqlite =
    getSqliteConnection();


  const nowIso =
    now.toISOString();


  /**
   * Tentativas vencidas NÃO são apagadas.
   *
   * Apenas mudamos:
   *
   * in_progress → expired
   *
   * Isso preserva:
   *
   * - auditoria;
   * - integridade histórica;
   * - possíveis referências;
   * - snapshots existentes.
   */
  const staleAttempts =
    readCount(
      sqlite
        .prepare(`
          SELECT
            COUNT(*) AS total
          FROM simulation_attempts
          WHERE
            status = 'in_progress'
            AND expires_at <= ?
        `)
        .get(
          nowIso
        ) as
        | CountRow
        | undefined
    );


  /**
   * Sessões vencidas não têm valor histórico
   * e podem ser removidas definitivamente.
   */
  const staleSessions =
    readCount(
      sqlite
        .prepare(`
          SELECT
            COUNT(*) AS total
          FROM sessions
          WHERE expires_at <= ?
        `)
        .get(
          nowIso
        ) as
        | CountRow
        | undefined
    );


  if (
    !apply
  ) {
    return {
      now:
        nowIso,

      apply:
        false,

      staleAttempts,

      expiredAttempts:
        0,

      staleSessions,

      removedSessions:
        0,

      optimizeExecuted:
        false,
    };
  }


  const execute =
    sqlite.transaction(
      () => {
        const expiredAttempts =
          sqlite
            .prepare(`
              UPDATE simulation_attempts
              SET
                status = 'expired',
                updated_at = ?
              WHERE
                status = 'in_progress'
                AND expires_at <= ?
            `)
            .run(
              nowIso,
              nowIso
            );


        const removedSessions =
          sqlite
            .prepare(`
              DELETE FROM sessions
              WHERE expires_at <= ?
            `)
            .run(
              nowIso
            );


        return {
          expiredAttempts:
            expiredAttempts.changes,

          removedSessions:
            removedSessions.changes,
        };
      }
    );


  /**
   * BEGIN IMMEDIATE evita duas rotinas de
   * manutenção alterando simultaneamente os
   * mesmos registros.
   */
  const changes =
    execute.immediate();


  /**
   * PRAGMA optimize é a rotina recomendada do
   * próprio SQLite para manutenção leve das
   * estatísticas do query planner.
   *
   * Não executamos VACUUM automaticamente:
   *
   * - pode ser caro;
   * - exige espaço extra;
   * - bloqueia mais;
   * - não deve ocorrer durante tráfego normal.
   */
  sqlite.pragma(
    "optimize"
  );


  return {
    now:
      nowIso,

    apply:
      true,

    staleAttempts,

    expiredAttempts:
      changes
        .expiredAttempts,

    staleSessions,

    removedSessions:
      changes
        .removedSessions,

    optimizeExecuted:
      true,
  };
}