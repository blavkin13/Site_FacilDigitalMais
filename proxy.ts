import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rotas protegidas que exigem autenticação
const PROTECTED_ROUTES = [
  "/minha-conta",
  "/checkout",
  "/simulados",
  "/admin",
];

// Rotas que exigem role admin
const ADMIN_ROUTES = [
  "/admin",
];

export async function proxy(
  request: NextRequest
) {
  const { pathname } = request.nextUrl;

  const sessionToken = request.cookies.get(
    "fd-session"
  )?.value;

  // Verificar se a rota é protegida
  const isProtected =
    PROTECTED_ROUTES.some((route) =>
      pathname.startsWith(route)
    );

  // Se não é protegida, continua normalmente
  if (!isProtected) {
    return NextResponse.next();
  }

  // Se é protegida e não possui sessão,
  // redireciona para login.
  if (!sessionToken) {
    const loginUrl = new URL(
      "/login",
      request.url
    );

    loginUrl.searchParams.set(
      "returnTo",
      pathname
    );

    return NextResponse.redirect(loginUrl);
  }

  /**
   * Para rotas administrativas validamos também
   * a role do usuário.
   *
   * As APIs administrativas continuarão realizando
   * sua própria autorização independentemente deste
   * Proxy.
   */
  const isAdminRoute =
    ADMIN_ROUTES.some((route) =>
      pathname.startsWith(route)
    );

  if (isAdminRoute) {
    try {
      const meResponse = await fetch(
        `${request.nextUrl.origin}/api/auth/me`,
        {
          headers: {
            cookie:
              request.headers.get("cookie") ||
              "",
          },
        }
      );

      if (!meResponse.ok) {
        const loginUrl = new URL(
          "/login",
          request.url
        );

        return NextResponse.redirect(
          loginUrl
        );
      }

      const meData =
        await meResponse.json();

      if (
        !meData.authenticated ||
        meData.user?.role !== "admin"
      ) {
        const homeUrl = new URL(
          "/",
          request.url
        );

        homeUrl.searchParams.set(
          "error",
          "forbidden"
        );

        return NextResponse.redirect(
          homeUrl
        );
      }
    } catch {
      /**
       * Mantemos nesta fase o comportamento
       * existente para evitar alteração funcional.
       *
       * As APIs administrativas continuam sendo
       * a barreira definitiva de autorização.
       *
       * Na fase de administração criaremos um
       * guard server-side compartilhado e este
       * fluxo deixará de depender deste fetch.
       */
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};