import type {
  NextRequest,
} from "next/server";

import {
  NextResponse,
} from "next/server";

import {
  asc,
  desc,
  eq,
} from "drizzle-orm";

import {
  getDb,
} from "../../../../db/index";

import {
  products,
} from "../../../../db/schema";

import {
  authorizeAdminRequest,
} from "../../../../lib/admin-auth";

import {
  AdminProductValidationError,
  validateAdminProductCreate,
  validateAdminProductId,
  validateAdminProductPatch,
} from "../../../../lib/admin-product-validation";

import {
  getManagedProductAssetIntegrityIssues,
} from "../../../../lib/admin-product-storage-maintenance";

import {
  getProductPublicationIssues,
} from "../../../../lib/product-publication";


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


function isSlugConflict(
  error:
    unknown
): boolean {
  return (
    error instanceof
      Error &&
    (
      error.message.includes(
        "UNIQUE constraint failed: products.slug"
      ) ||
      error.message.includes(
        "products_slug_unique"
      )
    )
  );
}


async function readJsonBody(
  request:
    NextRequest
): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AdminProductValidationError(
      "Corpo JSON inválido."
    );
  }
}


/**
 * GET
 *
 * Lista todas as apostilas para o painel
 * administrativo.
 *
 * Produtos ativos e inativos são retornados,
 * pois o administrador precisa gerenciar tanto
 * publicações quanto rascunhos.
 */
export async function GET(
  request:
    NextRequest
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


    const db =
      getDb();


    const allProducts =
      await db
        .select()
        .from(
          products
        )
        .orderBy(
          desc(
            products.updatedAt
          ),

          asc(
            products.title
          )
        )
        .all();


    return NextResponse.json(
      {
        products:
          allProducts,
      }
    );
  } catch (
    error
  ) {
    console.error(
      "Erro ao listar apostilas:",
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


/**
 * POST
 *
 * Cria uma nova apostila.
 *
 * Regras:
 *
 * - somente administrador;
 * - body passa pela whitelist do validator;
 * - mass assignment não é permitido;
 * - capa não pode ser definida diretamente;
 * - pdfPath não pode ser definido diretamente;
 * - nova apostila sempre nasce como rascunho.
 *
 * Capa e PDF são adicionados posteriormente
 * através do endpoint seguro de assets.
 */
export async function POST(
  request:
    NextRequest
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


    const body =
      await readJsonBody(
        request
      );


    const productData =
      validateAdminProductCreate(
        body
      );


    const db =
      getDb();


    const result =
      await db
        .insert(
          products
        )
        .values(
          productData
        )
        .returning();


    return NextResponse.json(
      {
        success:
          true,

        product:
          result[0],
      },
      {
        status:
          201,
      }
    );
  } catch (
    error
  ) {
    if (
      error instanceof
        AdminProductValidationError
    ) {
      return validationErrorResponse(
        error
      );
    }


    if (
      isSlugConflict(
        error
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Já existe uma apostila com este slug.",
        },
        {
          status:
            409,
        }
      );
    }


    console.error(
      "Erro ao criar apostila:",
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


/**
 * PATCH
 *
 * Atualiza somente campos explicitamente
 * autorizados pelo validator.
 *
 * Segurança:
 *
 * Não existe:
 *
 *   const { id, ...updates } = body
 *
 * Portanto propriedades arbitrárias enviadas
 * pelo cliente nunca chegam diretamente ao ORM.
 *
 *
 * FASE 3D
 * --------
 *
 * Uma apostila publicada precisa satisfazer todos
 * os requisitos editoriais.
 *
 *
 * FASE 3E
 * --------
 *
 * Uma referência de storage não é suficiente.
 *
 * Quando capa ou PDF utilizarem referências
 * gerenciadas, o arquivo físico correspondente
 * também precisa:
 *
 * - existir;
 * - ser um arquivo regular;
 * - estar acessível para leitura.
 *
 * Isso impede que o banco publique:
 *
 * managed-pdf:arquivo.pdf
 *
 * quando arquivo.pdf não existe mais no disco.
 */
export async function PATCH(
  request:
    NextRequest
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


    const body =
      await readJsonBody(
        request
      );


    const {
      id,
      updates,
    } =
      validateAdminProductPatch(
        body
      );


    const db =
      getDb();


    const existingProduct =
      await db
        .select()
        .from(
          products
        )
        .where(
          eq(
            products.id,
            id
          )
        )
        .get();


    if (
      !existingProduct
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


    /**
     * Estado final que a apostila terá
     * caso este PATCH seja efetivado.
     *
     * É importante validar nextProduct em vez
     * de apenas existingProduct ou updates.
     *
     * Dessa forma é possível, por exemplo,
     * preencher o último campo obrigatório e
     * publicar na mesma requisição.
     */
    const nextProduct = {
      ...existingProduct,
      ...updates,
    };


    /**
     * Determina se o produto ficará publicado
     * após esta atualização.
     *
     * Caso "active" não esteja no PATCH:
     *
     * - produto já ativo continuará ativo;
     * - produto inativo continuará inativo.
     *
     * Isso também impede que uma apostila já
     * publicada seja tornada inválida através
     * de uma edição posterior.
     */
    const willRemainPublished =
      updates.active ===
      undefined
        ? existingProduct.active ===
          true
        : updates.active ===
          true;


    if (
      willRemainPublished
    ) {
      /**
       * PRIMEIRA CAMADA
       *
       * Validação editorial.
       *
       * Não envolve filesystem e é barata.
       */
      const editorialIssues =
        getProductPublicationIssues(
          nextProduct
        );


      /**
       * SEGUNDA CAMADA
       *
       * Validação física do armazenamento.
       *
       * Só executamos I/O quando a validação
       * editorial já estiver totalmente válida.
       *
       * Isso evita tocar no filesystem para um
       * produto que claramente já possui campos
       * editoriais pendentes.
       */
      const storageIssues =
        editorialIssues.length ===
        0
          ? await getManagedProductAssetIntegrityIssues(
              nextProduct
            )
          : [];


      const issues = [
        ...editorialIssues,
        ...storageIssues,
      ];


      if (
        issues.length >
        0
      ) {
        return NextResponse.json(
          {
            error:
              "A apostila ainda não está pronta para publicação.",

            issues,
          },
          {
            status:
              409,
          }
        );
      }
    }


    const now =
      new Date()
        .toISOString();


    /**
     * Registra somente a PRIMEIRA publicação.
     *
     * Exemplo:
     *
     * rascunho
     *    ↓
     * publicado
     *    ↓
     * publishedAt = agora
     *
     *
     * publicado
     *    ↓
     * rascunho
     *    ↓
     * publicado novamente
     *
     * publishedAt permanece com a data original.
     */
    const shouldRegisterFirstPublication =
      updates.active ===
        true &&
      !existingProduct
        .publishedAt;


    const result =
      await db
        .update(
          products
        )
        .set({
          ...updates,

          ...(
            shouldRegisterFirstPublication
              ? {
                  publishedAt:
                    now,
                }
              : {}
          ),

          updatedAt:
            now,
        })
        .where(
          eq(
            products.id,
            id
          )
        )
        .returning();


    return NextResponse.json(
      {
        success:
          true,

        product:
          result[0],
      }
    );
  } catch (
    error
  ) {
    if (
      error instanceof
        AdminProductValidationError
    ) {
      return validationErrorResponse(
        error
      );
    }


    if (
      isSlugConflict(
        error
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Já existe uma apostila com este slug.",
        },
        {
          status:
            409,
        }
      );
    }


    console.error(
      "Erro ao atualizar apostila:",
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


/**
 * DELETE
 *
 * Soft delete.
 *
 * Nenhum registro comercial é removido
 * fisicamente.
 *
 * A apostila apenas deixa de ser publicada.
 *
 * Isso preserva:
 *
 * - pedidos anteriores;
 * - order_items;
 * - downloads;
 * - histórico;
 * - relacionamentos de banco.
 *
 * A remoção física de capa/PDF é uma operação
 * separada no endpoint administrativo de assets.
 */
export async function DELETE(
  request:
    NextRequest
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


    const id =
      validateAdminProductId(
        request.nextUrl
          .searchParams
          .get(
            "id"
          )
      );


    const db =
      getDb();


    const result =
      await db
        .update(
          products
        )
        .set({
          active:
            false,

          updatedAt:
            new Date()
              .toISOString(),
        })
        .where(
          eq(
            products.id,
            id
          )
        )
        .returning();


    if (
      !result[0]
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


    return NextResponse.json(
      {
        success:
          true,

        product:
          result[0],
      }
    );
  } catch (
    error
  ) {
    if (
      error instanceof
        AdminProductValidationError
    ) {
      return validationErrorResponse(
        error
      );
    }


    console.error(
      "Erro ao desativar apostila:",
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