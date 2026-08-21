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


function validationErrorResponse(
  error: AdminProductValidationError
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
  error: unknown
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
  request: NextRequest
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
 * Lista apostilas para o painel administrativo.
 *
 * Produtos ativos e inativos são retornados porque
 * administradores precisam gerenciar ambos.
 */
export async function GET(
  request: NextRequest
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
 * Cria nova apostila.
 *
 * Toda apostila criada por esta API nasce inativa.
 *
 * cover e pdfPath não podem ser definidos pelo JSON.
 * Esses campos serão controlados pelos endpoints seguros
 * de upload da Fase 3C.
 */
export async function POST(
  request: NextRequest
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
 * Atualiza somente campos explicitamente permitidos
 * pelo validator.
 *
 * Não existe mais:
 *
 *   const { id, ...updates } = body
 *
 * portanto propriedades arbitrárias nunca alcançam o ORM.
 */
export async function PATCH(
  request: NextRequest
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


    const result =
      await db
        .update(
          products
        )
        .set({
          ...updates,

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
 * Nenhum registro comercial é removido fisicamente.
 * A apostila apenas deixa de ser publicada.
 */
export async function DELETE(
  request: NextRequest
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