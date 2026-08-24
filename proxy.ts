import {
  NextResponse,
} from "next/server";

import type {
  NextRequest,
} from "next/server";

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
   * APIs entram no Proxy apenas para a barreira
   * HTTP genérica.
   *
   * Autenticação e autorização continuam dentro
   * das próprias rotas.
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


  if (
    !isAdminRoute
  ) {
    return NextResponse.next();
  }


  /**
   * O painel administrativo recebe uma segunda
   * verificação da sessão e da role.
   *
   * As APIs administrativas continuam sendo a
   * barreira definitiva de autorização.
   */
  try {
    const meResponse =
      await fetch(
        `${request.nextUrl.origin}/api/auth/me`,
        {
          headers: {
            cookie:
              request.headers.get(
                "cookie"
              ) ||
              "",
          },

          cache:
            "no-store",
        }
      );


    if (
      !meResponse.ok
    ) {
      return redirectToLogin(
        request,
        pathname
      );
    }


    const meData =
      await meResponse.json();


    if (
      !meData.authenticated
    ) {
      return redirectToLogin(
        request,
        pathname
      );
    }


    if (
      meData.user?.role !==
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
     * FAIL CLOSED.
     *
     * Falha de rede, parsing ou verificação não
     * pode liberar silenciosamente o painel.
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
   * APIs agora passam pelo Proxy para validação
   * same-origin.
   *
   * Apenas assets estáticos são ignorados.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2)$).*)",
  ],
};