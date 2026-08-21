import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "../../../../db/index";
import { protectedDownloads } from "../../../../db/schema";
import { getProtectedPdfByToken } from "../../../../lib/pdf-protection";
import { initDatabase } from "../../../../db/init";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await initDatabase();
    const db = getDb();

    const { token } = await params;

    // Validar token no banco
    const downloadRecord = await db
      .select()
      .from(protectedDownloads)
      .where(eq(protectedDownloads.downloadToken, token))
      .get();

    if (!downloadRecord) {
      return NextResponse.json(
        { error: "Link de download inválido." },
        { status: 404 }
      );
    }

    // Verificar se expirou
    if (new Date(downloadRecord.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: "Este link de download expirou. Solicite um novo." },
        { status: 410 }
      );
    }

    // Buscar arquivo PDF protegido
    const pdfFile = await getProtectedPdfByToken(token);

    if (!pdfFile) {
      return NextResponse.json(
        { error: "Arquivo não encontrado. Solicite um novo download." },
        { status: 404 }
      );
    }

    // Retornar PDF como download
    return new NextResponse(pdfFile.buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="apostila-facildigital.pdf"`,
        "Content-Length": String(pdfFile.buffer.length),
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Protected-By": "FacilDigital+",
      },
    });
  } catch (error) {
    console.error("Erro no download:", error);
    return NextResponse.json(
      { error: "Erro ao processar download." },
      { status: 500 }
    );
  }
}