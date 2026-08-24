import {
  eq,
} from "drizzle-orm";

import {
  pathToFileURL,
} from "node:url";

import {
  getDb,
  getSqliteConnection,
} from "../db/index";

import {
  initDatabase,
} from "../db/init";

import {
  users,
} from "../db/schema";

import {
  hashPassword,
} from "../lib/auth";


const DEFAULT_ADMIN_EMAIL =
  "digicopiamix@facildigitalmais.com";


function readHiddenInput(
  prompt:
    string
): Promise<string> {
  if (
    !process.stdin.isTTY ||
    !process.stdout.isTTY
  ) {
    return Promise.reject(
      new Error(
        "Entrada interativa indisponível. Configure ADMIN_SEED_PASSWORD no ambiente."
      )
    );
  }


  return new Promise(
    (
      resolve,
      reject
    ) => {
      const input =
        process.stdin;

      const output =
        process.stdout;


      const previousRawMode =
        input.isRaw ??
        false;


      let value =
        "";

      let finished =
        false;


      function cleanup() {
        input.off(
          "data",
          handleData
        );


        if (
          input.isTTY
        ) {
          input.setRawMode(
            previousRawMode
          );
        }


        input.pause();
      }


      function finish() {
        if (
          finished
        ) {
          return;
        }


        finished =
          true;

        cleanup();

        output.write(
          "\n"
        );

        resolve(
          value
        );
      }


      function cancel() {
        if (
          finished
        ) {
          return;
        }


        finished =
          true;

        cleanup();

        output.write(
          "\n"
        );

        reject(
          new Error(
            "Operação cancelada."
          )
        );
      }


      function handleData(
        chunk:
          Buffer |
          string
      ) {
        const text =
          chunk.toString();


        for (
          const character of
            text
        ) {
          /**
           * Ctrl+C
           */
          if (
            character ===
            "\u0003"
          ) {
            cancel();

            return;
          }


          /**
           * Enter
           */
          if (
            character ===
              "\r" ||
            character ===
              "\n"
          ) {
            finish();

            return;
          }


          /**
           * Backspace / Delete
           */
          if (
            character ===
              "\u007f" ||
            character ===
              "\b"
          ) {
            value =
              value.slice(
                0,
                -1
              );

            continue;
          }


          /**
           * Aceitamos caracteres imprimíveis.
           * Nada é ecoado no terminal.
           */
          if (
            character >=
            " "
          ) {
            value +=
              character;
          }
        }
      }


      output.write(
        prompt
      );


      input.resume();

      input.setRawMode(
        true
      );

      input.on(
        "data",
        handleData
      );
    }
  );
}


async function resolvePassword() {
  /**
   * Automação/CI ainda pode fornecer a senha
   * exclusivamente por variável de ambiente.
   */
  const configured =
    process.env
      .ADMIN_SEED_PASSWORD;


  if (
    configured
  ) {
    return configured;
  }


  const first =
    await readHiddenInput(
      "Nova senha administrativa: "
    );


  const second =
    await readHiddenInput(
      "Confirme a nova senha: "
    );


  if (
    first !==
    second
  ) {
    throw new Error(
      "As senhas informadas não coincidem."
    );
  }


  return first;
}


export async function rotateAdminPassword({
  email,
  password,
}: {
  email:
    string;

  password:
    string;
}) {
  const normalizedEmail =
    email
      .trim()
      .toLowerCase();


  if (
    normalizedEmail.length ===
    0
  ) {
    throw new Error(
      "Email administrativo inválido."
    );
  }


  if (
    typeof password !==
      "string" ||
    password.length <
      12
  ) {
    throw new Error(
      "A nova senha administrativa deve possuir pelo menos 12 caracteres."
    );
  }


  if (
    password.length >
    256
  ) {
    throw new Error(
      "A nova senha administrativa é excessivamente longa."
    );
  }


  await initDatabase();


  const db =
    getDb();


  const admin =
    await db
      .select({
        id:
          users.id,

        email:
          users.email,

        role:
          users.role,
      })
      .from(
        users
      )
      .where(
        eq(
          users.email,
          normalizedEmail
        )
      )
      .get();


  if (
    !admin ||
    admin.role !==
      "admin"
  ) {
    throw new Error(
      "Administrador não encontrado."
    );
  }


  /**
   * Scrypt acontece antes do BEGIN IMMEDIATE.
   *
   * Não mantemos um lock de escrita durante
   * uma operação deliberadamente custosa.
   */
  const passwordHash =
    await hashPassword(
      password
    );


  const now =
    new Date()
      .toISOString();


  const sqlite =
    getSqliteConnection();


  const transaction =
    sqlite.transaction(
      () => {
        const passwordUpdate =
          sqlite
            .prepare(`
              UPDATE users
              SET
                password_hash = ?,
                updated_at = ?
              WHERE
                id = ?
                AND role = 'admin'
            `)
            .run(
              passwordHash,
              now,
              admin.id
            );


        if (
          passwordUpdate.changes !==
          1
        ) {
          throw new Error(
            "Não foi possível atualizar a senha administrativa."
          );
        }


        /**
         * Mudança de credencial administrativa
         * revoga TODAS as sessões atuais.
         */
        const revoked =
          sqlite
            .prepare(`
              DELETE FROM sessions
              WHERE user_id = ?
            `)
            .run(
              admin.id
            );


        return {
          revokedSessions:
            revoked.changes,
        };
      }
    );


  const result =
    transaction.immediate();


  return {
    userId:
      admin.id,

    email:
      admin.email,

    revokedSessions:
      result
        .revokedSessions,
  };
}


async function main() {
  const password =
    await resolvePassword();


  const email =
    process.env
      .ADMIN_SEED_EMAIL ||
    DEFAULT_ADMIN_EMAIL;


  const result =
    await rotateAdminPassword({
      email,
      password,
    });


  console.log(
    "✅ Senha administrativa atualizada."
  );

  console.log(
    `   Email: ${result.email}`
  );

  console.log(
    `   Sessões revogadas: ${result.revokedSessions}`
  );
}


const executedDirectly =
  Boolean(
    process.argv[1]
  ) &&
  import.meta.url ===
    pathToFileURL(
      process.argv[1]
    ).href;


if (
  executedDirectly
) {
  main()
    .then(
      () => {
        process.exit(
          0
        );
      }
    )
    .catch(
      (
        error
      ) => {
        console.error(
          "❌ Falha ao atualizar senha administrativa:",
          error instanceof
            Error
            ? error.message
            : error
        );

        process.exit(
          1
        );
      }
    );
}