import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getDb,
} from "../../../../db/index";

import {
  initDatabase,
} from "../../../../db/init";

import {
  validateSession,
} from "../../../../lib/auth";

import {
  CheckoutReturnReferenceError,
  findCheckoutReturnOrderStatus,
  normalizeCheckoutReturnReference,
} from "../../../../lib/checkout-return-status";


export const dynamic =
  "force-dynamic";


const NO_STORE_HEADERS = {
  "Cache-Control":
    "private, no-store, no-cache, max-age=0, must-revalidate",

  Pragma:
    "no-cache",
};


function noStoreJson(
  body:
    unknown,

  status =
    200
) {
  return NextResponse.json(
    body,
    {
      status,

      headers:
        NO_STORE_HEADERS,
    }
  );
}


/**
 * GET /api/checkout/status
 *
 * Consulta read-only do estado financeiro do pedido
 * pertencente ao usuário autenticado.
 *
 * IMPORTANTE:
 *
 * Este endpoint:
 *
 * - NÃO consulta status da query string;
 * - NÃO aceita payment_id como autoridade;
 * - NÃO altera orders.status;
 * - NÃO confirma pagamento;
 * - NÃO concede entitlement;
 * - NÃO consulta diretamente o Mercado Pago.
 *
 * A única autoridade financeira é o estado já
 * persistido em orders pelo fluxo de webhook.
 */
export async function GET(
  request:
    NextRequest
) {
  try {
    await initDatabase();


    const token =
      request.cookies.get(
        "fd-session"
      )?.value;


    if (!token) {
      return noStoreJson(
        {
          error:
            "Não autenticado.",
        },
        401
      );
    }


    const user =
      await validateSession(
        token
      );


    if (!user) {
      return noStoreJson(
        {
          error:
            "Sessão inválida.",
        },
        401
      );
    }


    let externalReference:
      string;


    try {
      externalReference =
        normalizeCheckoutReturnReference(
          request.nextUrl
            .searchParams
            .get(
              "external_reference"
            )
        );
    } catch (
      error
    ) {
      if (
        error instanceof
        CheckoutReturnReferenceError
      ) {
        return noStoreJson(
          {
            error:
              error.message,
          },
          400
        );
      }


      throw error;
    }


    const db =
      getDb();


    const order =
      findCheckoutReturnOrderStatus(
        db,
        user.id,
        externalReference
      );


    if (!order) {
      /**
       * Não informamos se a referência existe
       * para outro usuário.
       */
      return noStoreJson(
        {
          error:
            "Pedido não encontrado.",
        },
        404
      );
    }


    return noStoreJson(
      {
        order: {
          id:
            order.orderId,

          status:
            order.status,

          entitlementActive:
            order.entitlementActive,

          updatedAt:
            order.updatedAt,
        },
      }
    );
  } catch (
    error
  ) {
    console.error(
      "Erro ao consultar status do checkout:",
      error
    );


    return noStoreJson(
      {
        error:
          "Erro interno.",
      },
      500
    );
  }
}