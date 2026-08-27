import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  and,
  eq,
} from "drizzle-orm";

import {
  getDb,
} from "../../../../db/index";

import {
  initDatabase,
} from "../../../../db/init";

import {
  orderItems,
  orders,
  protectedDownloads,
} from "../../../../db/schema";

import {
  validateSession,
} from "../../../../lib/auth";

import {
  getProtectedPdfByToken,
  removeProtectedPdfByToken,
} from "../../../../lib/pdf-protection";


const DOWNLOAD_TOKEN_PATTERN =
  /^[a-f0-9]{64}$/;


/**
 * Converte Buffer Node.js para ArrayBuffer
 * compatível com Web Response.
 */
function bufferToArrayBuffer(
  buffer:
    Buffer
): ArrayBuffer {
  const bytes =
    new Uint8Array(
      buffer.byteLength
    );


  bytes.set(
    buffer
  );


  return bytes.buffer;
}


export async function GET(
  request:
    NextRequest,
  {
    params,
  }: {
    params:
      Promise<{
        token:
          string;
      }>;
  }
) {
  try {
    await initDatabase();


    const db =
      getDb();


    const {
      token: rawToken,
    } =
      await params;


    const token =
      rawToken
        .trim()
        .toLowerCase();


    /**
     * Tokens fora do formato esperado nem sequer
     * chegam à consulta de banco.
     */
    if (
      !DOWNLOAD_TOKEN_PATTERN.test(
        token
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Link de download inválido.",
        },
        {
          status:
            404,
        }
      );
    }


    /**
     * O token deixa de ser um bearer token utilizável
     * por qualquer pessoa que receba a URL.
     *
     * O comprador precisa estar autenticado.
     */
    const sessionToken =
      request.cookies.get(
        "fd-session"
      )?.value;


    if (
      !sessionToken
    ) {
      return NextResponse.json(
        {
          error:
            "Não autenticado.",
        },
        {
          status:
            401,
        }
      );
    }


    const user =
      await validateSession(
        sessionToken
      );


    if (
      !user
    ) {
      return NextResponse.json(
        {
          error:
            "Sessão inválida.",
        },
        {
          status:
            401,
        }
      );
    }


    const downloadRecord =
      await db
        .select()
        .from(
          protectedDownloads
        )
        .where(
          eq(
            protectedDownloads
              .downloadToken,
            token
          )
        )
        .get();


    /**
     * Não revelamos a existência de um token
     * pertencente a outro usuário.
     */
    if (
      !downloadRecord ||
      downloadRecord.userId !==
        user.id
    ) {
      return NextResponse.json(
        {
          error:
            "Link de download inválido.",
        },
        {
          status:
            404,
        }
      );
    }


    /**
     * Link expirado:
     *
     * - arquivo temporário removido;
     * - registro removido;
     * - HTTP 410.
     */
    const expirationMs =
      new Date(
        downloadRecord
          .expiresAt
      ).getTime();


    if (
      !Number.isFinite(
        expirationMs
      ) ||
      expirationMs <=
        Date.now()
    ) {
      try {
        await removeProtectedPdfByToken(
          token
        );
      } catch (
        cleanupError
      ) {
        console.error(
          `Falha ao remover PDF protegido expirado ${downloadRecord.id}:`,
          cleanupError
        );
      }


      await db
        .delete(
          protectedDownloads
        )
        .where(
          eq(
            protectedDownloads.id,
            downloadRecord.id
          )
        );


      return NextResponse.json(
        {
          error:
            "Este link de download expirou. Solicite um novo.",
        },
        {
          status:
            410,
        }
      );
    }


    /**
     * O comprador precisa continuar possuindo
     * um pedido aprovado contendo exatamente
     * o produto deste download.
     *
     * Se houver reembolso, rejeição ou chargeback
     * posterior, um link gerado anteriormente deixa
     * de funcionar.
     */
    const approvedPurchase =
      downloadRecord.orderId
        ? await db
            .select({
              orderItemId:
                orderItems.id,
            })
            .from(
              orders
            )
            .innerJoin(
              orderItems,
              eq(
                orderItems.orderId,
                orders.id
              )
            )
            .where(
              and(
                eq(
                  orders.id,
                  downloadRecord.orderId
                ),

                eq(
                  orders.userId,
                  user.id
                ),

                eq(
                  orders.status,
                  "approved"
                ),

                eq(
                  orderItems.productId,
                  downloadRecord.productId
                )
              )
            )
            .get()
        : null;


    if (
      !approvedPurchase
    ) {
      /**
       * Revoga também o material temporário.
       *
       * Se a compra voltar a ser aprovada futuramente,
       * o aluno deverá solicitar um novo link.
       */
      try {
        await removeProtectedPdfByToken(
          token
        );
      } catch (
        cleanupError
      ) {
        console.error(
          `Falha ao remover PDF protegido revogado ${downloadRecord.id}:`,
          cleanupError
        );
      }


      await db
        .delete(
          protectedDownloads
        )
        .where(
          eq(
            protectedDownloads.id,
            downloadRecord.id
          )
        );


      return NextResponse.json(
        {
          error:
            "Este download não está mais autorizado.",
        },
        {
          status:
            403,
        }
      );
    }


    const pdfFile =
      await getProtectedPdfByToken(
        token
      );


    if (
      !pdfFile
    ) {
      return NextResponse.json(
        {
          error:
            "Arquivo não encontrado. Solicite um novo download.",
        },
        {
          status:
            404,
        }
      );
    }


    const pdfBody =
      bufferToArrayBuffer(
        pdfFile.buffer
      );


    return new NextResponse(
      pdfBody,
      {
        status:
          200,

        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            'attachment; filename="apostila-facildigital.pdf"',

          "Content-Length":
            String(
              pdfFile.buffer
                .byteLength
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
  } catch (
    error
  ) {
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
        status:
          500,
      }
    );
  }
}