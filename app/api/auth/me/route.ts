import { NextRequest, NextResponse } from "next/server";
import { validateSession } from "../../../../lib/auth.js";
import { initDatabase } from "../../../../db/init.js";

export async function GET(request: NextRequest) {
  try {
    await initDatabase();

    const token = request.cookies.get("fd-session")?.value;

    if (!token) {
      return NextResponse.json(
        { authenticated: false, user: null },
        { status: 200 }
      );
    }

    const user = await validateSession(token);

    if (!user) {
      // Limpar cookie expirado
      const response = NextResponse.json(
        { authenticated: false, user: null },
        { status: 200 }
      );
      response.cookies.set("fd-session", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      return response;
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        cpf: user.cpf,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Erro ao verificar sessão:", error);
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 200 }
    );
  }
}