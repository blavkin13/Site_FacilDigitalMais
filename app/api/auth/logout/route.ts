import type {
  NextRequest,
} from "next/server";

import {
  logoutSession,
} from "../../../../lib/auth";

import {
  initDatabase,
} from "../../../../db/init";

import {
  clearSessionCookie,
  getSessionToken,
  privateNoStoreJson,
} from "../../../../lib/session-cookie";


export async function POST(
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
      token
    ) {
      await logoutSession(
        token
      );
    }


    const response =
      privateNoStoreJson({
        success:
          true,
      });


    /**
     * Logout permanece idempotente:
     * mesmo sem sessão válida o cookie local
     * será apagado.
     */
    clearSessionCookie(
      response
    );


    return response;
  } catch (
    error
  ) {
    console.error(
      "Erro no logout:",
      error
    );


    const response =
      privateNoStoreJson(
        {
          error:
            "Erro interno do servidor.",
        },
        {
          status:
            500,
        }
      );


    /**
     * Mesmo se a exclusão do servidor falhar,
     * não mantemos intencionalmente o cookie
     * de autenticação no navegador.
     */
    clearSessionCookie(
      response
    );


    return response;
  }
}