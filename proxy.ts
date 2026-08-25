import {
  NextResponse,
} from "next/server";

import type {
  NextRequest,
} from "next/server";

import {
  validateSession,
} from "./lib/auth";

import {
  initDatabase,
} from "./db/init";

import {
  validateSameOriginMutation,
} from "./lib/request-security";


const PROTECTED_ROUTES = [
  "/minha-conta",
  "/checkout",
  "/simulados",
  "/admin",
];


const ADMIN_ROUTES = [
  "/admin",
];


function routeMatches(
  pathname:
    string,
  route:
    string
) {
  return (
    pathname ===
      route ||
    pathname.startsWith(
      `${route}/`
    )
  );
}


function redirectToLogin(
  request:
    NextRequest,
  returnTo?:
    string
) {
  const loginUrl =
    new URL(
      "/login",
      request.url
    );


  if (
    returnTo
  ) {
    loginUrl
      .searchParams
      .set(
        "returnTo",
        returnTo
      );
  }


  return NextResponse.redirect(
    loginUrl
  );
}


function csrfDeniedResponse() {
  return NextResponse.json(
    {
      error:
        "Origem da requisição não permitida.",

      reason:
        "csrf_rejected",
    },
    {
      status:
        403,

      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",
      },
    }
  );
}


export async function proxy(
  request:
    NextRequest
) {
  const {
    pathname,
  } =
    request.nextUrl;


  /**
   * APIs passam pelo Proxy exclusivamente para
   * a barreira HTTP genérica de CSRF.
   *
   * Autenticação e autorização continuam sendo
   * verificadas independentemente pelas próprias
   * Route Handlers.
   */
  if (
    pathname.startsWith(
      "/api/"
    )
  ) {
    const csrf =
      validateSameOriginMutation(
        request
      );


    if (
      !csrf.allowed
    ) {
      return csrfDeniedResponse();
    }


    return NextResponse.next();
  }


  const isProtected =
    PROTECTED_ROUTES.some(
      (
        route
      ) =>
        routeMatches(
          pathname,
          route
        )
    );


  if (
    !isProtected
  ) {
    return NextResponse.next();
  }


  const sessionToken =
    request.cookies.get(
      "fd-session"
    )?.value;


  if (
    !sessionToken
  ) {
    return redirectToLogin(
      request,
      pathname
    );
  }


  const isAdminRoute =
    ADMIN_ROUTES.some(
      (
        route
      ) =>
        routeMatches(
          pathname,
          route
        )
    );


  /**
   * Para as demais páginas protegidas, mantemos
   * o comportamento histórico:
   *
   * a presença do cookie permite que a página
   * continue e as APIs internas fazem a validação
   * server-side definitiva.
   */
  if (
    !isAdminRoute
  ) {
    return NextResponse.next();
  }


  /**
   * ADMIN
   *
   * Não fazemos fetch() contra /api/auth/me.
   *
   * O Proxy do Next.js 16 executa em Node.js,
   * portanto podemos validar diretamente a sessão
   * armazenada no SQLite.
   *
   * Isso evita:
   *
   * browser HTTPS
   *      ↓
   * reverse proxy
   *      ↓
   * Next HTTP interno
   *      ↓
   * self-fetch HTTPS incorreto
   *
   * que anteriormente produzia
   * ERR_SSL_WRONG_VERSION_NUMBER em Codespaces.
   */
  try {
    await initDatabase();


    const user =
      await validateSession(
        sessionToken
      );


    if (
      !user
    ) {
      return redirectToLogin(
        request,
        pathname
      );
    }


    if (
      user.role !==
      "admin"
    ) {
      const homeUrl =
        new URL(
          "/",
          request.url
        );


      homeUrl
        .searchParams
        .set(
          "error",
          "forbidden"
        );


      return NextResponse.redirect(
        homeUrl
      );
    }
  } catch (
    error
  ) {
    /**
     * FAIL CLOSED
     *
     * Qualquer falha ao abrir o banco, validar a
     * sessão ou resolver o usuário bloqueia o
     * acesso administrativo.
     */
    console.error(
      "Falha na verificação administrativa:",
      error
    );


    return redirectToLogin(
      request,
      pathname
    );
  }


  return NextResponse.next();
}


export const config = {
  /**
   * APIs precisam passar pelo Proxy por causa
   * da proteção CSRF.
   *
   * Assets estáticos continuam excluídos.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2)$).*)",
  ],
};