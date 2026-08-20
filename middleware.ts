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
const ADMIN_ROUTES = ["/admin"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get("fd-session")?.value;

  // Verificar se a rota é protegida
  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  // Se não é protegida, continua normalmente
  if (!isProtected) {
    return NextResponse.next();
  }

  // Se é protegida e não tem sessão, redireciona para login
  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Para rotas admin, precisamos validar a sessão via API
  // (middleware não tem acesso direto ao DB, então validamos via fetch)
  if (ADMIN_ROUTES.some((route) => pathname.startsWith(route))) {
    try {
      const meRes = await fetch(`${request.nextUrl.origin}/api/auth/me`, {
        headers: { cookie: request.headers.get("cookie") || "" },
      });

      if (!meRes.ok) {
        const loginUrl = new URL("/login", request.url);
        return NextResponse.redirect(loginUrl);
      }

      const meData = await meRes.json();

      if (!meData.authenticated || meData.user?.role !== "admin") {
        // Não é admin - redireciona para página inicial com erro
        const homeUrl = new URL("/", request.url);
        homeUrl.searchParams.set("error", "forbidden");
        return NextResponse.redirect(homeUrl);
      }
    } catch {
      // Em caso de erro, deixa passar (API vai validar de novo)
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};