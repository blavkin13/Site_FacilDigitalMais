import type {
  NextRequest,
} from "next/server";

import {
  NextResponse,
} from "next/server";

import {
  initDatabase,
} from "../db/init";

import type {
  User,
} from "../db/schema";

import {
  validateSession,
} from "./auth";


export const ADMIN_SESSION_COOKIE =
  "fd-session";


export type AdminSessionState =
  | {
      status: "authenticated";
      user: User;
    }
  | {
      status: "unauthenticated";
      user: null;
    }
  | {
      status: "forbidden";
      user: User;
    };


export type AdminRequestAuthorization =
  | {
      ok: true;
      user: User;
    }
  | {
      ok: false;
      response: NextResponse;
    };


/**
 * Resolve uma sessão administrativa.
 *
 * Esta é a regra central de autorização administrativa.
 *
 * Ela é utilizada independentemente por:
 *
 * - API Routes administrativas;
 * - páginas server-side administrativas.
 *
 * O proxy continua sendo uma barreira antecipada de UX,
 * mas nunca será considerado a única proteção.
 */
export async function resolveAdminSession(
  token: string | null | undefined
): Promise<AdminSessionState> {
  await initDatabase();


  if (
    !token
  ) {
    return {
      status:
        "unauthenticated",

      user:
        null,
    };
  }


  const user =
    await validateSession(
      token
    );


  if (
    !user
  ) {
    return {
      status:
        "unauthenticated",

      user:
        null,
    };
  }


  if (
    user.role !==
    "admin"
  ) {
    return {
      status:
        "forbidden",

      user,
    };
  }


  return {
    status:
      "authenticated",

    user,
  };
}


/**
 * Guard reutilizável para API Routes administrativas.
 *
 * Sem sessão / sessão inválida:
 *   401
 *
 * Usuário autenticado sem role admin:
 *   403
 *
 * Administrador:
 *   continua.
 */
export async function authorizeAdminRequest(
  request: NextRequest
): Promise<AdminRequestAuthorization> {
  const token =
    request.cookies.get(
      ADMIN_SESSION_COOKIE
    )?.value;


  const state =
    await resolveAdminSession(
      token
    );


  if (
    state.status ===
    "unauthenticated"
  ) {
    return {
      ok:
        false,

      response:
        NextResponse.json(
          {
            error:
              "Não autenticado.",
          },
          {
            status:
              401,
          }
        ),
    };
  }


  if (
    state.status ===
    "forbidden"
  ) {
    return {
      ok:
        false,

      response:
        NextResponse.json(
          {
            error:
              "Acesso negado.",
          },
          {
            status:
              403,
          }
        ),
    };
  }


  return {
    ok:
      true,

    user:
      state.user,
  };
}