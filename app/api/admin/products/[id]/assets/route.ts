import type {
  NextRequest,
} from "next/server";

import {
  NextResponse,
} from "next/server";

import {
  eq,
} from "drizzle-orm";

import {
  getDb,
} from "../../../../../../db/index";

import {
  products,
} from "../../../../../../db/schema";

import {
  authorizeAdminRequest,
} from "../../../../../../lib/admin-auth";

import {
  AdminProductValidationError,
  validateAdminProductId,
} from "../../../../../../lib/admin-product-validation";

import {
  AdminProductStorageError,
  MAX_PDF_UPLOAD_BYTES,
  parseAdminAssetKind,
  removeManagedAssetReference,
  removeStoredAdminAsset,
  storeAdminProductAsset,
  type AdminAssetKind,
} from "../../../../../../lib/admin-product-storage";


type RouteContext = {
  params:
    Promise<{
      id:
        string;
    }>;
};


function storageErrorResponse(
  error:
    AdminProductStorageError
) {
  return NextResponse.json(
    {
      error:
        error.message,
    },
    {
      status:
        error.status,
    }
  );
}


function validationErrorResponse(
  error:
    AdminProductValidationError
) {
  return NextResponse.json(
    {
      error:
        error.message,

      field:
        error.field,
    },
    {
      status:
        400,
    }
  );
}


async function getProductId(
  context:
    RouteContext
): Promise<number> {
  const params =
    await context.params;


  return validateAdminProductId(
    params.id
  );
}


function requestBodyTooLarge(
  request:
    NextRequest
): boolean {
  const contentLength =
    request.headers.get(
      "content-length"
    );


  if (
    !contentLength
  ) {
    return false;
  }


  const size =
    Number(
      contentLength
    );


  if (
    !Number.isFinite(
      size
    )
  ) {
    return false;
  }


  /**
   * Margem adicional para os metadados do multipart.
   *
   * O limite específico da capa/PDF continua sendo
   * validado posteriormente pelo storage.
   *
   * Em produção o Nginx também receberá um
   * client_max_body_size apropriado.
   */
  return (
    size >
    MAX_PDF_UPLOAD_BYTES +
      1024 *
        1024
  );
}


/**
 * POST
 *
 * Envia ou substitui a capa/PDF de uma apostila.
 *
 * multipart/form-data:
 *
 *   kind = cover | pdf
 *   file = arquivo
 */
export async function POST(
  request:
    NextRequest,
  context:
    RouteContext
) {
  let storedAsset:
    Awaited<
      ReturnType<
        typeof storeAdminProductAsset
      >
    > | null =
    null;


  try {
    const authorization =
      await authorizeAdminRequest(
        request
      );


    if (
      !authorization.ok
    ) {
      return authorization.response;
    }


    if (
      requestBodyTooLarge(
        request
      )
    ) {
      return NextResponse.json(
        {
          error:
            "O upload excede o limite máximo permitido.",
        },
        {
          status:
            413,
        }
      );
    }


    const productId =
      await getProductId(
        context
      );


    const db =
      getDb();


    const product =
      await db
        .select()
        .from(
          products
        )
        .where(
          eq(
            products.id,
            productId
          )
        )
        .get();


    if (
      !product
    ) {
      return NextResponse.json(
        {
          error:
            "Apostila não encontrada.",
        },
        {
          status:
            404,
        }
      );
    }


    let formData:
      FormData;


    try {
      formData =
        await request.formData();
    } catch {
      return NextResponse.json(
        {
          error:
            "Formulário de upload inválido.",
        },
        {
          status:
            400,
        }
      );
    }


    const kind =
      parseAdminAssetKind(
        formData.get(
          "kind"
        )
      );


    const fileValue =
      formData.get(
        "file"
      );


    if (
      !(
        fileValue instanceof
        File
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Nenhum arquivo válido foi enviado.",
        },
        {
          status:
            400,
        }
      );
    }


    storedAsset =
      await storeAdminProductAsset(
        productId,
        kind,
        fileValue
      );


    const previousReference =
      kind ===
      "cover"
        ? product.cover
        : product.pdfPath;


    let updatedProducts;


    try {
      updatedProducts =
        await db
          .update(
            products
          )
          .set({
            ...(kind ===
            "cover"
              ? {
                  cover:
                    storedAsset.reference,
                }
              : {
                  pdfPath:
                    storedAsset.reference,
                }),

            updatedAt:
              new Date()
                .toISOString(),
          })
          .where(
            eq(
              products.id,
              productId
            )
          )
          .returning();
    } catch (
      databaseError
    ) {
      await removeStoredAdminAsset(
        storedAsset
      );


      storedAsset =
        null;


      throw databaseError;
    }


    await removeManagedAssetReference(
      kind,
      previousReference
    );


    return NextResponse.json(
      {
        success:
          true,

        kind,

        product:
          updatedProducts[0],

        asset: {
          url:
            kind ===
            "cover"
              ? storedAsset.reference
              : null,

          mimeType:
            storedAsset.mimeType,

          size:
            storedAsset.size,
        },
      }
    );
  } catch (
    error
  ) {
    if (
      storedAsset
    ) {
      try {
        await removeStoredAdminAsset(
          storedAsset
        );
      } catch {
        /**
         * A falha principal é preservada.
         */
      }
    }


    if (
      error instanceof
      AdminProductStorageError
    ) {
      return storageErrorResponse(
        error
      );
    }


    if (
      error instanceof
      AdminProductValidationError
    ) {
      return validationErrorResponse(
        error
      );
    }


    console.error(
      "Erro ao enviar arquivo da apostila:",
      error
    );


    return NextResponse.json(
      {
        error:
          "Erro interno ao processar upload.",
      },
      {
        status:
          500,
      }
    );
  }
}


/**
 * DELETE
 *
 * Remove somente arquivos que pertencem ao armazenamento
 * gerenciado pela aplicação.
 *
 * Arquivos legados não são apagados fisicamente.
 *
 * Ao remover capa ou PDF a apostila também é
 * automaticamente despublicada.
 */
export async function DELETE(
  request:
    NextRequest,
  context:
    RouteContext
) {
  try {
    const authorization =
      await authorizeAdminRequest(
        request
      );


    if (
      !authorization.ok
    ) {
      return authorization.response;
    }


    const productId =
      await getProductId(
        context
      );


    const kind =
      parseAdminAssetKind(
        request.nextUrl
          .searchParams
          .get(
            "kind"
          )
      );


    const db =
      getDb();


    const product =
      await db
        .select()
        .from(
          products
        )
        .where(
          eq(
            products.id,
            productId
          )
        )
        .get();


    if (
      !product
    ) {
      return NextResponse.json(
        {
          error:
            "Apostila não encontrada.",
        },
        {
          status:
            404,
        }
      );
    }


    const previousReference =
      kind ===
      "cover"
        ? product.cover
        : product.pdfPath;


    const result =
      await db
        .update(
          products
        )
        .set({
          ...(kind ===
          "cover"
            ? {
                cover:
                  null,
              }
            : {
                pdfPath:
                  null,
              }),

          active:
            false,

          updatedAt:
            new Date()
              .toISOString(),
        })
        .where(
          eq(
            products.id,
            productId
          )
        )
        .returning();


    await removeManagedAssetReference(
      kind,
      previousReference
    );


    return NextResponse.json(
      {
        success:
          true,

        kind,

        product:
          result[0],
      }
    );
  } catch (
    error
  ) {
    if (
      error instanceof
      AdminProductStorageError
    ) {
      return storageErrorResponse(
        error
      );
    }


    if (
      error instanceof
      AdminProductValidationError
    ) {
      return validationErrorResponse(
        error
      );
    }


    console.error(
      "Erro ao remover arquivo da apostila:",
      error
    );


    return NextResponse.json(
      {
        error:
          "Erro interno ao remover arquivo.",
      },
      {
        status:
          500,
      }
    );
  }
}