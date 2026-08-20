import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { join } from "path";
import { getDb } from "../../../../db/index.js";
import { orders, orderItems, products, protectedDownloads, users } from "../../../../db/schema.js";
import { validateSession } from "../../../../lib/auth.js";
import { generateProtectedPdf, validateCpf } from "../../../../lib/pdf-protection.js";
import { initDatabase } from "../../../../db/init.js";

export async function POST(request: NextRequest) {
  try {
    await initDatabase();
    const db = getDb();

    // Autenticação
    const token = request.cookies.get("fd-session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const user = await validateSession(token);
    if (!user) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    // Validar CPF do usuário
    if (!user.cpf || !validateCpf(user.cpf)) {
      return NextResponse.json(
        { error: "Seu CPF não está cadastrado ou é inválido. Atualize seu perfil para baixar a apostila." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { productSlug } = body;

    if (!productSlug) {
      return NextResponse.json({ error: "Produto não informado." }, { status: 400 });
    }

    // Verificar se o usuário comprou este produto
    const purchase = await db
      .select({
        orderId: orders.id,
        productId: products.id,
        pdfPath: products.pdfPath,
        productTitle: products.title,
      })
      .from(orders)
      .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(
        and(
          eq(orders.userId, user.id),
          eq(products.slug, productSlug)
        )
      )
      .get();

    if (!purchase) {
      return NextResponse.json(
        { error: "Você não possui este produto." },
        { status: 403 }
      );
    }

    // Gerar PDF protegido
    const pdfPath = purchase.pdfPath || join(process.cwd(), "data", "sample.pdf");

    let protectedResult;
    try {
      protectedResult = await generateProtectedPdf(
        pdfPath,
        user.cpf,
        user.id
      );
    } catch (error) {
      console.error("Erro ao gerar PDF protegido:", error);
      return NextResponse.json(
        { error: "Erro ao gerar o arquivo. Tente novamente." },
        { status: 500 }
      );
    }

    // Salvar registro no banco
    await db.insert(protectedDownloads).values({
      userId: user.id,
      productId: purchase.productId,
      orderId: purchase.orderId,
      downloadToken: protectedResult.downloadToken,
      expiresAt: protectedResult.expiresAt.toISOString(),
    });

    return NextResponse.json({
      success: true,
      downloadUrl: `/api/download/${protectedResult.downloadToken}`,
      expiresInHours: 12,
      protectedWith: {
        watermark: formatCpfDisplay(user.cpf),
        password: "Seu CPF",
      },
    });
  } catch (error) {
    console.error("Erro ao gerar download:", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

// Helper para exibir CPF formatado sem expor totalmente
function formatCpfDisplay(cpf: string): string {
  const clean = cpf.replace(/\D/g, "");
  return `***.${clean.slice(3, 6)}.***-**`;
}

// Import necessário para o join do path
