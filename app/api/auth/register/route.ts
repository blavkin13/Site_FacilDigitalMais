import { NextRequest, NextResponse } from "next/server";
import { registerUser, authenticateUser } from "../../../../lib/auth";
import { initDatabase } from "../../../../db/init";

export async function POST(request: NextRequest) {
  try {
    await initDatabase();

    const body = await request.json();
    const { email, password, name, cpf, phone } = body;

    // Validações
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Nome, email e senha são obrigatórios." },
        { status: 400 }
      );
    }

    if (typeof email !== "string" || typeof password !== "string" || typeof name !== "string") {
      return NextResponse.json(
        { error: "Dados inválidos." },
        { status: 400 }
      );
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Formato de email inválido." },
        { status: 400 }
      );
    }

    // Validar senha (mínimo 6 caracteres)
    if (password.length < 6) {
      return NextResponse.json(
        { error: "A senha deve ter pelo menos 6 caracteres." },
        { status: 400 }
      );
    }

    // Validar CPF (formato básico, 11 dígitos)
    if (cpf) {
      const cleanCpf = cpf.replace(/\D/g, "");
      if (cleanCpf.length !== 11) {
        return NextResponse.json(
          { error: "CPF deve conter 11 dígitos." },
          { status: 400 }
        );
      }
    }

    // Registrar usuário
    const user = await registerUser(
      email.toLowerCase().trim(),
      password,
      name.trim(),
      cpf ? cpf.replace(/\D/g, "") : undefined,
      phone ? phone.trim() : undefined,
      "user"
    );

    if (!user) {
      return NextResponse.json(
        { error: "Este email já está cadastrado." },
        { status: 409 }
      );
    }

    // Autenticar automaticamente após o registro
    const authResult = await authenticateUser(email.toLowerCase().trim(), password);

    if (!authResult) {
      return NextResponse.json(
        { error: "Usuário criado, mas falha ao autenticar. Faça login manualmente." },
        { status: 201 }
      );
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: authResult.user.id,
        email: authResult.user.email,
        name: authResult.user.name,
        role: authResult.user.role,
      },
    }, { status: 201 });

    // Definir cookie HTTPOnly
    response.cookies.set("fd-session", authResult.session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("Erro no registro:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}