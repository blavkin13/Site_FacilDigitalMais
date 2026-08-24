import {
  eq,
} from "drizzle-orm";

import {
  getDb,
} from "./index";

import {
  initDatabase,
} from "./init";

import {
  users,
} from "./schema";

import {
  registerUser,
} from "../lib/auth";


const DEFAULT_ADMIN_EMAIL =
  "digicopiamix@facildigitalmais.com";

const DEFAULT_ADMIN_NAME =
  "Administrador Sistema";

/**
 * Senha utilizada exclusivamente em bancos
 * temporários de testes automatizados.
 *
 * Nunca utilizada em development ou production.
 */
const TEST_ONLY_ADMIN_PASSWORD =
  "TestOnly_Admin_2026!";


function resolveAdminEmail() {
  return (
    process.env
      .ADMIN_SEED_EMAIL
      ?.trim()
      .toLowerCase() ||
    DEFAULT_ADMIN_EMAIL
  );
}


function resolveAdminName() {
  return (
    process.env
      .ADMIN_SEED_NAME
      ?.trim() ||
    DEFAULT_ADMIN_NAME
  );
}


function resolveNewAdminPassword() {
  const configured =
    process.env
      .ADMIN_SEED_PASSWORD;


  if (
    configured
  ) {
    return configured;
  }


  if (
    process.env
      .NODE_ENV ===
    "test"
  ) {
    return TEST_ONLY_ADMIN_PASSWORD;
  }


  return null;
}


export async function seedAdmin() {
  console.log(
    "🌱 Iniciando seed do administrador..."
  );


  await initDatabase();


  const db =
    getDb();


  const adminEmail =
    resolveAdminEmail();


  const existing =
    await db
      .select()
      .from(
        users
      )
      .where(
        eq(
          users.email,
          adminEmail
        )
      )
      .get();


  if (
    existing
  ) {
    console.log(
      "ℹ️  Administrador já existe no banco de dados."
    );

    console.log(
      `   Email: ${existing.email}`
    );

    console.log(
      `   ID: ${existing.id}`
    );

    console.log(
      `   Role: ${existing.role}`
    );


    return existing;
  }


  const adminPassword =
    resolveNewAdminPassword();


  if (
    !adminPassword
  ) {
    throw new Error(
      [
        "ADMIN_SEED_PASSWORD não configurada.",
        "",
        "Para criar o administrador inicial, defina",
        "ADMIN_SEED_PASSWORD no ambiente antes de",
        "executar npm run db:seed.",
        "",
        "Nunca grave a senha administrativa no Git.",
      ].join(
        "\n"
      )
    );
  }


  if (
    adminPassword.length <
    12
  ) {
    throw new Error(
      "ADMIN_SEED_PASSWORD deve possuir pelo menos 12 caracteres."
    );
  }


  const admin =
    await registerUser(
      adminEmail,
      adminPassword,
      resolveAdminName(),
      undefined,
      undefined,
      "admin"
    );


  if (
    !admin
  ) {
    throw new Error(
      "Não foi possível criar o administrador."
    );
  }


  console.log(
    "✅ Administrador criado com sucesso!"
  );

  console.log(
    `   Email: ${admin.email}`
  );

  console.log(
    `   ID: ${admin.id}`
  );

  console.log(
    `   Role: ${admin.role}`
  );


  return admin;
}


if (
  import.meta.url ===
  `file://${process.argv[1]}`
) {
  seedAdmin()
    .then(
      () => {
        console.log(
          "✅ Seed concluído!"
        );

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
          "❌ Falha no seed:",
          error
        );

        process.exit(
          1
        );
      }
    );
}