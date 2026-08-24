import type {
  NextRequest,
} from "next/server";

import {
  authenticateUser,
  registerUser,
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
      name,
      cpf,
      phone,
    } =
      body;


    if (
      !email ||
      !password ||
      !name
    ) {
      return privateNoStoreJson(
        {
          error:
            "Nome, email e senha são obrigatórios.",
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
        "string" ||
      typeof name !==
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


    if (
      cpf !==
        undefined &&
      cpf !==
        null &&
      typeof cpf !==
        "string"
    ) {
      return privateNoStoreJson(
        {
          error:
            "CPF inválido.",
        },
        {
          status:
            400,
        }
      );
    }


    if (
      phone !==
        undefined &&
      phone !==
        null &&
      typeof phone !==
        "string"
    ) {
      return privateNoStoreJson(
        {
          error:
            "Telefone inválido.",
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


    const normalizedName =
      name.trim();


    if (
      normalizedEmail.length ===
        0 ||
      normalizedEmail.length >
        254 ||
      normalizedName.length ===
        0 ||
      normalizedName.length >
        120 ||
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


    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


    if (
      !emailRegex.test(
        normalizedEmail
      )
    ) {
      return privateNoStoreJson(
        {
          error:
            "Formato de email inválido.",
        },
        {
          status:
            400,
        }
      );
    }


    if (
      password.length <
      6
    ) {
      return privateNoStoreJson(
        {
          error:
            "A senha deve ter pelo menos 6 caracteres.",
        },
        {
          status:
            400,
        }
      );
    }


    let cleanCpf:
      string | undefined;


    if (
      typeof cpf ===
        "string" &&
      cpf.length >
        0
    ) {
      cleanCpf =
        cpf.replace(
          /\D/g,
          ""
        );


      if (
        cleanCpf.length !==
        11
      ) {
        return privateNoStoreJson(
          {
            error:
              "CPF deve conter 11 dígitos.",
          },
          {
            status:
              400,
          }
        );
      }
    }


    const cleanPhone =
      typeof phone ===
        "string"
        ? phone.trim()
        : undefined;


    if (
      cleanPhone &&
      cleanPhone.length >
        30
    ) {
      return privateNoStoreJson(
        {
          error:
            "Telefone inválido.",
        },
        {
          status:
            400,
        }
      );
    }


    const user =
      await registerUser(
        normalizedEmail,
        password,
        normalizedName,
        cleanCpf,
        cleanPhone ||
          undefined,
        "user"
      );


    if (
      !user
    ) {
      return privateNoStoreJson(
        {
          error:
            "Este email já está cadastrado.",
        },
        {
          status:
            409,
        }
      );
    }


    /**
     * Mantemos o comportamento atual:
     * cadastro bem-sucedido já inicia sessão.
     */
    const authResult =
      await authenticateUser(
        normalizedEmail,
        password
      );


    if (
      !authResult
    ) {
      return privateNoStoreJson(
        {
          error:
            "Usuário criado, mas falha ao autenticar. Faça login manualmente.",
        },
        {
          status:
            201,
        }
      );
    }


    const response =
      privateNoStoreJson(
        {
          success:
            true,

          user: {
            id:
              authResult
                .user
                .id,

            email:
              authResult
                .user
                .email,

            name:
              authResult
                .user
                .name,

            role:
              authResult
                .user
                .role,
          },
        },
        {
          status:
            201,
        }
      );


    setSessionCookie(
      response,
      authResult
        .session
        .token
    );


    return response;
  } catch (
    error
  ) {
    console.error(
      "Erro no registro:",
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