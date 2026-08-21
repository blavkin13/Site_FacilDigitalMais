import { NextRequest, NextResponse } from "next/server";
import { logoutSession } from "../../../../lib/auth";
import { initDatabase } from "../../../../db/init";

export async function POST(request: NextRequest) {
  try {
    await initDatabase();

    const token = request.cookies.get("fd-session")?.value;

    if (token) {
      await logoutSession(token);
    }

    const response = NextResponse.json({ success: true });

    // Limpar cookie
    response.cookies.set("fd-session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("Erro no logout:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}