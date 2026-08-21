import {
  NextRequest,
  NextResponse,
} from "next/server";

import { eq } from "drizzle-orm";

import {
  getDb,
} from "../../../../db/index";

import {
  protectedDownloads,
} from "../../../../db/schema";

import {
  getProtectedPdfByToken,
} from "../../../../lib/pdf-protection";

import {
  initDatabase,
} from "../../../../db/init";

/**
 * Converte um Buffer do Node.js em um ArrayBuffer
 * pertencente à Web API.
 *
 * Não usamos diretamente:
 *
 *   buffer.buffer
 *
 * porque o tipo interno do Buffer pode ser
 * ArrayBufferLike / SharedArrayBuffer.
 *
 * Ao criar uma nova Uint8Array com tamanho próprio,
 * garantimos que o backing buffer seja um ArrayBuffer
 * compatível com BodyInit / Response.
 */
function bufferToArrayBuffer(
  buffer: Buffer
): ArrayBuffer {
  const bytes = new Uint8Array(
    buffer.byteLength
  );

  bytes.set(buffer);

  return bytes.buffer;
}

export async function GET(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      token: string;
    }>;
  }
) {
  try {
    await initDatabase();

    const db = getDb();

    const {
      token,
    } = await params;

    // ========================================================
    // VALIDAR TOKEN
    // ========================================================

    const downloadRecord = await db
      .select()
      .from(protectedDownloads)
      .where(
        eq(
          protectedDownloads.downloadToken,
          token
        )
      )
      .get();

    if (!downloadRecord) {
      return NextResponse.json(
        {
          error:
            "Link de download inválido.",
        },
        {
          status: 404,
        }
      );
    }

    // ========================================================
    // VALIDAR EXPIRAÇÃO
    // ========================================================

    if (
      new Date(
        downloadRecord.expiresAt
      ) < new Date()
    ) {
      return NextResponse.json(
        {
          error:
            "Este link de download expirou. Solicite um novo.",
        },
        {
          status: 410,
        }
      );
    }

    // ========================================================
    // LOCALIZAR PDF PROTEGIDO
    // ========================================================

    const pdfFile =
      await getProtectedPdfByToken(
        token
      );

    if (!pdfFile) {
      return NextResponse.json(
        {
          error:
            "Arquivo não encontrado. Solicite um novo download.",
        },
        {
          status: 404,
        }
      );
    }

    // ========================================================
    // PREPARAR BODY COMPATÍVEL COM WEB RESPONSE
    // ========================================================

    const pdfBody =
      bufferToArrayBuffer(
        pdfFile.buffer
      );

    // ========================================================
    // ENTREGAR PDF
    // ========================================================

    return new NextResponse(
      pdfBody,
      {
        status: 200,
        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            'attachment; filename="apostila-facildigital.pdf"',

          "Content-Length":
            String(
              pdfFile.buffer.byteLength
            ),

          "Cache-Control":
            "private, no-store, no-cache, must-revalidate",

          Pragma:
            "no-cache",

          Expires:
            "0",

          "X-Content-Type-Options":
            "nosniff",

          "X-Protected-By":
            "FacilDigital+",
        },
      }
    );
  } catch (error) {
    console.error(
      "Erro no download:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Erro ao processar download.",
      },
      {
        status: 500,
      }
    );
  }
}