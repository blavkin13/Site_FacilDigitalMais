import type {
  NextRequest,
} from "next/server";

import {
  NextResponse,
} from "next/server";

import {
  access,
} from "node:fs/promises";

import {
  constants as fsConstants,
} from "node:fs";

import {
  join,
} from "node:path";

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
  products,
  protectedDownloads,
} from "../../../../db/schema";

import {
  validateSession,
} from "../../../../lib/auth";

import {
  resolveManagedPdfPath,
} from "../../../../lib/admin-product-storage";

import {
  generateProtectedPdf,
  validateCpf,
} from "../../../../lib/pdf-protection";


function resolveLegacyPdfPath(
  reference: string
): string | null {
  /**
   * Compatibilidade temporária com os produtos
   * anteriores à Fase 3C.
   *
   * Somente referências estritamente no formato
   *
   *   /pdfs/arquivo.pdf
   *
   * são aceitas.
   *
   * Caminhos arbitrários nunca são usados.
   */
  const match =
    reference.match(
      /^\/pdfs\/([a-zA-Z0-9][a-zA-Z0-9._-]*\.pdf)$/
    );


  if (
    !match
  ) {
    return null;
  }


  return join(
    process.cwd(),
    "public",
    "pdfs",
    match[1]
  );
}


function resolveProductPdfPath(
  reference:
    string | null
): string | null {
  if (
    !reference
  ) {
    return null;
  }


  if (
    reference.startsWith(
      "managed-pdf:"
    )
  ) {
    return resolveManagedPdfPath(
      reference
    );
  }


  return resolveLegacyPdfPath(
    reference
  );
}


async function fileIsReadable(
  path: string
): Promise<boolean> {
  try {
    await access(
      path,
      fsConstants.R_OK
    );


    return true;
  } catch {
    return false;
  }
}


function formatCpfDisplay(
  cpf: string
): string {
  const clean =
    cpf.replace(
      /\D/g,
      ""
    );


  return `***.${clean.slice(
    3,
    6
  )}.***-**`;
}


export async function POST(
  request: NextRequest
) {
  try {
    await initDatabase();


    const db =
      getDb();


    const token =
      request.cookies.get(
        "fd-session"
      )?.value;


    if (
      !token
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
        token
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


    if (
      !user.cpf ||
      !validateCpf(
        user.cpf
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Seu CPF não está cadastrado ou é inválido. Atualize seu perfil para baixar a apostila.",
        },
        {
          status:
            400,
        }
      );
    }


    let body:
      unknown;


    try {
      body =
        await request.json();
    } catch {
      return NextResponse.json(
        {
          error:
            "Corpo JSON inválido.",
        },
        {
          status:
            400,
        }
      );
    }


    if (
      typeof body !==
        "object" ||
      body ===
        null ||
      Array.isArray(
        body
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Requisição inválida.",
        },
        {
          status:
            400,
        }
      );
    }


    const productSlug =
      (
        body as
          Record<
            string,
            unknown
          >
      ).productSlug;


    if (
      typeof productSlug !==
        "string" ||
      !productSlug.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "Produto não informado.",
        },
        {
          status:
            400,
        }
      );
    }


    /**
     * O download exige especificamente um pedido
     * APROVADO contendo a apostila solicitada.
     *
     * Um pedido pending/rejected/refunded não libera
     * material.
     */
    const purchase =
      await db
        .select({
          orderId:
            orders.id,

          productId:
            products.id,

          pdfPath:
            products.pdfPath,

          productTitle:
            products.title,
        })
        .from(
          orders
        )
        .innerJoin(
          orderItems,
          eq(
            orders.id,
            orderItems.orderId
          )
        )
        .innerJoin(
          products,
          eq(
            orderItems.productId,
            products.id
          )
        )
        .where(
          and(
            eq(
              orders.userId,
              user.id
            ),

            eq(
              orders.status,
              "approved"
            ),

            eq(
              products.slug,
              productSlug.trim()
            )
          )
        )
        .get();


    if (
      !purchase
    ) {
      return NextResponse.json(
        {
          error:
            "Você não possui uma compra aprovada desta apostila.",
        },
        {
          status:
            403,
        }
      );
    }


    const sourcePdfPath =
      resolveProductPdfPath(
        purchase.pdfPath
      );


    if (
      !sourcePdfPath
    ) {
      return NextResponse.json(
        {
          error:
            "O PDF desta apostila ainda não está disponível.",
        },
        {
          status:
            409,
        }
      );
    }


    if (
      !await fileIsReadable(
        sourcePdfPath
      )
    ) {
      console.error(
        `PDF original indisponível para produto ${purchase.productId}.`
      );


      return NextResponse.json(
        {
          error:
            "O arquivo desta apostila está temporariamente indisponível.",
        },
        {
          status:
            409,
        }
      );
    }


    let protectedResult;


    try {
      protectedResult =
        await generateProtectedPdf(
          sourcePdfPath,
          user.cpf,
          user.id
        );
    } catch (
      error
    ) {
      console.error(
        "Erro ao gerar PDF protegido:",
        error
      );


      return NextResponse.json(
        {
          error:
            "Erro ao gerar o arquivo. Tente novamente.",
        },
        {
          status:
            500,
        }
      );
    }


    await db
      .insert(
        protectedDownloads
      )
      .values({
        userId:
          user.id,

        productId:
          purchase.productId,

        orderId:
          purchase.orderId,

        downloadToken:
          protectedResult
            .downloadToken,

        expiresAt:
          protectedResult
            .expiresAt
            .toISOString(),
      });


    return NextResponse.json({
      success:
        true,

      downloadUrl:
        `/api/download/${protectedResult.downloadToken}`,

      expiresInHours:
        12,

      protectedWith: {
        watermark:
          formatCpfDisplay(
            user.cpf
          ),

        /**
         * O fluxo legado ainda informa CPF como senha,
         * embora pdf-lib atualmente aplique apenas
         * watermark. A criptografia real será tratada
         * no hardening final.
         */
        password:
          "Seu CPF",
      },
    });
  } catch (
    error
  ) {
    console.error(
      "Erro ao gerar download:",
      error
    );


    return NextResponse.json(
      {
        error:
          "Erro interno.",
      },
      {
        status:
          500,
      }
    );
  }
}