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
} from "../../../../../../lib/admin-product-storage";


type RouteContext = {
  params:
    Promise<{
      id:
        string;
    }>;
};


/**
 * Converte erros conhecidos da camada de storage
 * em respostas HTTP controladas.
 */
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


/**
 * Converte erros conhecidos de validação
 * em resposta 400.
 */
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


/**
 * Extrai e valida o ID da apostila
 * recebido na rota dinâmica.
 */
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


/**
 * Proteção preliminar baseada em Content-Length.
 *
 * A validação definitiva do tamanho do arquivo
 * continua sendo executada pela camada de storage.
 *
 * Em produção, o Nginx também deverá impor
 * client_max_body_size.
 */
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
    ) ||
    size <
      0
  ) {
    return false;
  }


  /**
   * O maior arquivo permitido atualmente é o PDF.
   *
   * Reservamos 1 MB adicional para boundary e
   * metadados multipart.
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
 *
 * Estratégia de consistência:
 *
 * 1. arquivo novo é validado e salvo;
 * 2. banco passa a apontar para o arquivo novo;
 * 3. somente depois o arquivo anterior é removido;
 * 4. falha na limpeza antiga NÃO remove o arquivo
 *    já referenciado pelo banco.
 */
export async function POST(
  request:
    NextRequest,
  context:
    RouteContext
) {
  /**
   * Enquanto esta variável possuir um asset,
   * significa que ele ainda não foi assumido
   * definitivamente pelo banco.
   *
   * O catch externo poderá removê-lo.
   *
   * Depois do commit lógico:
   *
   * storedAsset = null
   *
   * e o catch não poderá apagar o arquivo novo.
   */
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


    /**
     * A camada de storage executa:
     *
     * - extensão permitida;
     * - MIME permitido;
     * - magic bytes;
     * - limite de tamanho;
     * - nome aleatório;
     * - proteção contra traversal;
     * - gravação fora de public/.
     */
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
      /**
       * O banco passa a apontar para o novo arquivo
       * antes de tentarmos apagar o anterior.
       */
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
      /**
       * O banco NÃO assumiu a referência.
       *
       * Nesse caso o arquivo recém-gravado deve ser
       * removido para não virar órfão.
       *
       * Primeiro retiramos a responsabilidade do
       * catch externo para não existir tentativa
       * duplicada de remoção.
       */
      const uncommittedAsset =
        storedAsset;


      storedAsset =
        null;


      try {
        await removeStoredAdminAsset(
          uncommittedAsset
        );
      } catch (
        cleanupError
      ) {
        /**
         * A falha original continua sendo a falha
         * do banco.
         *
         * Uma eventual falha de limpeza não deve
         * mascarar databaseError.
         */
        console.error(
          `Falha ao remover novo ${
            kind ===
            "cover"
              ? "arquivo de capa"
              : "PDF"
          } após erro de banco da apostila ${productId}:`,
          cleanupError
        );
      }


      throw databaseError;
    }


    /**
     * COMMIT LÓGICO.
     *
     * Neste ponto o banco já aponta para
     * storedAsset.reference.
     *
     * Portanto o arquivo novo NÃO pode mais
     * ser apagado pelo catch externo.
     */
    const committedAsset =
      storedAsset;


    storedAsset =
      null;


    /**
     * Limpeza best-effort do arquivo anterior.
     *
     * Se unlink() falhar:
     *
     * - banco continua íntegro;
     * - novo arquivo continua disponível;
     * - arquivo antigo pode ficar órfão;
     * - o erro é registrado;
     * - a API continua retornando sucesso.
     *
     * Um órfão é preferível a deixar o banco
     * apontando para um arquivo inexistente.
     */
    try {
      await removeManagedAssetReference(
        kind,
        previousReference
      );
    } catch (
      cleanupError
    ) {
      console.error(
        `Falha ao limpar ${
          kind ===
          "cover"
            ? "capa"
            : "PDF"
        } anterior da apostila ${productId}:`,
        cleanupError
      );
    }


    return NextResponse.json(
      {
        success:
          true,

        kind,

        product:
          updatedProducts[0],

        asset: {
          /**
           * Somente capas possuem URL pública.
           *
           * PDFs originais permanecem privados.
           */
          url:
            kind ===
            "cover"
              ? committedAsset.reference
              : null,

          mimeType:
            committedAsset.mimeType,

          size:
            committedAsset.size,
        },
      }
    );
  } catch (
    error
  ) {
    /**
     * Se storedAsset ainda estiver preenchido,
     * significa que o banco nunca assumiu
     * definitivamente aquela referência.
     */
    if (
      storedAsset
    ) {
      try {
        await removeStoredAdminAsset(
          storedAsset
        );
      } catch (
        cleanupError
      ) {
        /**
         * A falha principal da requisição é
         * preservada.
         *
         * O erro de limpeza fica registrado para
         * futura manutenção.
         */
        console.error(
          "Falha ao limpar arquivo não confirmado após erro de upload:",
          cleanupError
        );
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
 * Remove somente arquivos pertencentes ao
 * armazenamento gerenciado pela aplicação.
 *
 * Arquivos legados não são apagados fisicamente
 * por esta operação.
 *
 * A remoção de capa ou PDF também despublica
 * automaticamente a apostila.
 *
 * Estratégia:
 *
 * 1. retirar referência do banco;
 * 2. despublicar;
 * 3. tentar apagar o arquivo físico;
 * 4. falha de unlink vira log, não rollback lógico.
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


    /**
     * Banco primeiro.
     *
     * Se esta operação falhar, o arquivo permanece
     * intacto e ainda referenciado.
     */
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

          /**
           * Uma apostila sem capa ou sem PDF
           * nunca permanece publicada.
           */
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


    /**
     * O banco já deixou de referenciar o arquivo.
     *
     * Uma falha física de unlink não deve fazer
     * uma operação administrativa concluída
     * responder HTTP 500.
     *
     * O eventual órfão poderá ser removido pela
     * manutenção de armazenamento da 3E-B.
     */
    try {
      await removeManagedAssetReference(
        kind,
        previousReference
      );
    } catch (
      cleanupError
    ) {
      console.error(
        `Falha ao limpar ${
          kind ===
          "cover"
            ? "capa"
            : "PDF"
        } removido da apostila ${productId}:`,
        cleanupError
      );
    }


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