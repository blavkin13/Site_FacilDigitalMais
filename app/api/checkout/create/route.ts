import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../db/index";
import { validateSession } from "../../../../lib/auth";
import { createPaymentPreference } from "../../../../lib/mercadopago";
import {
  attachPaymentPreference,
  CheckoutValidationError,
  createPendingCheckoutOrder,
} from "../../../../lib/checkout-order";
import { initDatabase } from "../../../../db/init";

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

    const body = await request.json();

    const {
      items,
      paymentMethod,
      coupon,
    } = body;

    /**
     * Cria pedido + itens atomicamente.
     *
     * A external_reference é gerada no servidor e
     * persistida antes de qualquer contato com o
     * Mercado Pago.
     *
     * Preço, quantidade, produto ativo e cupom são
     * validados pela camada de domínio.
     */
    let pendingOrder;

    try {
      pendingOrder =
        createPendingCheckoutOrder(
          db,
          {
            userId:
              user.id,

            items,

            paymentMethod,

            coupon,
          }
        );
    } catch (error) {
      if (
        error instanceof
        CheckoutValidationError
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

      throw error;
    }

    const {
      order,
      externalReference:
        orderReference,
      mpItems,
      total,
    } = pendingOrder;

    /**
     * A origem ainda será endurecida para
     * APP_BASE_URL na etapa específica de
     * configuração de produção.
     */
    const baseUrl =
      request.nextUrl.origin;

    let checkoutUrl =
      "";

    let preferenceId =
      "";

    let realPreferenceId:
      string | null =
      null;

    try {
      const mpResult =
        await createPaymentPreference(
          {
            items:
              mpItems,

            userEmail:
              user.email,

            userName:
              user.name ||
              user.email,

            orderReference,

            backUrl:
              baseUrl,
          }
        );

      checkoutUrl =
        mpResult.init_point;

      preferenceId =
        mpResult.preference_id;

      realPreferenceId =
        mpResult.preference_id;
    } catch (mpError) {
      /**
       * Comportamento legado temporariamente
       * preservado nesta subfase.
       *
       * O fallback demo será removido quando
       * tornarmos Mercado Pago fail-closed.
       */
      console.error(
        "Erro Mercado Pago (usando modo demo):",
        mpError
      );

      checkoutUrl =
        `${baseUrl}/checkout/success?demo=true&order=${order.id}`;

      preferenceId =
        `DEMO-${order.id}`;
    }

    /**
     * Somente preference_id realmente retornado pelo
     * Mercado Pago é persistido.
     *
     * Identificadores DEMO não entram na coluna
     * preference_id.
     */
    if (
      realPreferenceId !==
      null
    ) {
      attachPaymentPreference(
        db,
        order.id,
        realPreferenceId
      );
    }

    return NextResponse.json(
      {
        success:
          true,

        orderId:
          order.id,

        orderReference,

        checkoutUrl,

        preferenceId,

        total,
      }
    );
  } catch (error) {
    console.error("Erro ao criar checkout:", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}