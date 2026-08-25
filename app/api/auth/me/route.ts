import type {
  NextRequest,
} from "next/server";

import {
  validateSession,
} from "@/lib/auth";

import {
  initDatabase,
} from "@/db/init";

import {
  clearSessionCookie,
  getSessionToken,
  privateNoStoreJson,
} from "@/lib/session-cookie";


export async function GET(
  request:
    NextRequest
) {
  try {
    await initDatabase();


    const token =
      getSessionToken(
        request
      );


    if (
      !token
    ) {
      return privateNoStoreJson({
        authenticated:
          false,

        user:
          null,
      });
    }


    const user =
      await validateSession(
        token
      );


    if (
      !user
    ) {
      const response =
        privateNoStoreJson({
          authenticated:
            false,

          user:
            null,
        });


      /**
       * Token inexistente, expirado ou inválido
       * também é removido do navegador.
       */
      clearSessionCookie(
        response
      );


      return response;
    }


    return privateNoStoreJson({
      authenticated:
        true,

      user: {
        id:
          user.id,

        email:
          user.email,

        name:
          user.name,

        cpf:
          user.cpf,

        phone:
          user.phone,

        role:
          user.role,
      },
    });
  } catch (
    error
  ) {
    console.error(
      "Erro ao verificar sessão:",
      error
    );


    /**
     * Mantemos a semântica histórica desta rota:
     * problemas na consulta de sessão não geram
     * 500 para o AuthProvider.
     */
    return privateNoStoreJson({
      authenticated:
        false,

      user:
        null,
    });
  }
}