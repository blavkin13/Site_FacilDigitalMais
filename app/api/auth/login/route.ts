import type {
  NextRequest,
} from "next/server";

import {
  authenticateUser,
} from "../../../../lib/auth";

import {
  initDatabase,
} from "../../../../db/init";

import {
  privateNoStoreJson,
  setSessionCookie,
} from "../../../../lib/session-cookie";


function isPlainObject(
  value:
    unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      "object" &&
    value !==
      null &&
    !Array.isArray(
      value
    )
  );
}


export async function POST(
  request:
    NextRequest
) {
  try {
    await initDatabase();


    let body:
      unknown;


    try {
      body =
        await request.json();
    } catch {
      return privateNoStoreJson(
        {
          error:
            "Corpo JSON inválido.",
        },
        {
          status:
            400,
        }
      );
    }


    if (
      !isPlainObject(
        body
      )
    ) {
      return privateNoStoreJson(
        {
          error:
            "Dados inválidos.",
        },
        {
          status:
            400,
        }
      );
    }


    const {
      email,
      password,
    } =
      body;


    if (
      !email ||
      !password
    ) {
      return privateNoStoreJson(
        {
          error:
            "Email e senha são obrigatórios.",
        },
        {
          status:
            400,
        }
      );
    }


    if (
      typeof email !==
        "string" ||
      typeof password !==
        "string"
    ) {
      return privateNoStoreJson(
        {
          error:
            "Dados inválidos.",
        },
        {
          status:
            400,
        }
      );
    }


    /**
     * Evita entradas exageradamente grandes
     * chegando à função de derivação de senha.
     */
    if (
      email.length >
        254 ||
      password.length >
        256
    ) {
      return privateNoStoreJson(
        {
          error:
            "Dados inválidos.",
        },
        {
          status:
            400,
        }
      );
    }


    const normalizedEmail =
      email
        .toLowerCase()
        .trim();


    const result =
      await authenticateUser(
        normalizedEmail,
        password
      );


    /**
     * Mensagem propositalmente genérica:
     * não revelamos se o email existe.
     */
    if (
      !result
    ) {
      return privateNoStoreJson(
        {
          error:
            "Email ou senha incorretos.",
        },
        {
          status:
            401,
        }
      );
    }


    const {
      user,
      session,
    } =
      result;


    const response =
      privateNoStoreJson({
        success:
          true,

        user: {
          id:
            user.id,

          email:
            user.email,

          name:
            user.name,

          role:
            user.role,
        },
      });


    setSessionCookie(
      response,
      session.token
    );


    return response;
  } catch (
    error
  ) {
    console.error(
      "Erro no login:",
      error
    );


    return privateNoStoreJson(
      {
        error:
          "Erro interno do servidor.",
      },
      {
        status:
          500,
      }
    );
  }
}