import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  SESSION_TTL_SECONDS,
} from "./auth";


export const SESSION_COOKIE_NAME =
  "fd-session";


function sessionCookieBaseOptions() {
  return {
    httpOnly:
      true,

    /**
     * Em desenvolvimento usamos HTTP no
     * Codespaces/localhost.
     *
     * Em produção o cookie só pode trafegar
     * através de HTTPS.
     */
    secure:
      process.env.NODE_ENV ===
      "production",

    /**
     * Lax é adequado ao fluxo atual porque:
     *
     * - reduz bastante exposição CSRF;
     * - preserva navegações top-level;
     * - não quebra retornos externos comuns.
     *
     * A proteção CSRF das mutações será
     * auditada separadamente na 4.4B.2.
     */
    sameSite:
      "lax" as const,

    path:
      "/",

    priority:
      "high" as const,
  };
}


export function getSessionToken(
  request:
    NextRequest
): string | null {
  const token =
    request.cookies.get(
      SESSION_COOKIE_NAME
    )?.value;


  if (
    typeof token !==
      "string" ||
    token.length ===
      0
  ) {
    return null;
  }


  return token;
}


export function setSessionCookie(
  response:
    NextResponse,
  token:
    string
) {
  response.cookies.set(
    SESSION_COOKIE_NAME,
    token,
    {
      ...sessionCookieBaseOptions(),

      /**
       * Mantido exatamente sincronizado com
       * SESSION_TTL_SECONDS de lib/auth.ts.
       */
      maxAge:
        SESSION_TTL_SECONDS,
    }
  );
}


export function clearSessionCookie(
  response:
    NextResponse
) {
  response.cookies.set(
    SESSION_COOKIE_NAME,
    "",
    {
      ...sessionCookieBaseOptions(),

      maxAge:
        0,

      expires:
        new Date(
          0
        ),
    }
  );
}


/**
 * Nenhuma resposta envolvendo autenticação ou
 * sessão deve ser reutilizada por caches.
 */
export function applyPrivateNoStore(
  response:
    NextResponse
) {
  response.headers.set(
    "Cache-Control",
    "private, no-store, max-age=0"
  );

  response.headers.set(
    "Pragma",
    "no-cache"
  );


  return response;
}


export function privateNoStoreJson(
  body:
    unknown,
  init?:
    ResponseInit
) {
  const response =
    NextResponse.json(
      body,
      init
    );


  return applyPrivateNoStore(
    response
  );
}