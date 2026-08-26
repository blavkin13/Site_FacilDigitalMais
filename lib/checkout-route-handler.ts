import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getDb,
} from "../db/index";

import {
  initDatabase,
} from "../db/init";

import {
  validateSession,
} from "./auth";

import {
  attachPaymentPreference,
  CheckoutValidationError,
  createPendingCheckoutOrder,
} from "./checkout-order";

import {
  createPaymentPreference,
  MercadoPagoProviderError,
} from "./mercadopago";

import {
  getAppBaseUrl,
  getMercadoPagoAccessToken,
  PaymentConfigurationError,
} from "./payment-config";


interface CheckoutRouteDependencies {
  initializeDatabase:
    typeof initDatabase;

  getDatabase:
    typeof getDb;

  validateSessionToken:
    typeof validateSession;

  createPreference:
    typeof createPaymentPreference;

  getBaseUrl:
    typeof getAppBaseUrl;

  getAccessToken:
    typeof getMercadoPagoAccessToken;
}


const defaultDependencies:
  CheckoutRouteDependencies = {
    initializeDatabase:
      initDatabase,

    getDatabase:
      getDb,

    validateSessionToken:
      validateSession,

    createPreference:
      createPaymentPreference,

    getBaseUrl:
      getAppBaseUrl,

    getAccessToken:
      getMercadoPagoAccessToken,
  };


export function createCheckoutPostHandler(
  overrides:
    Partial<
      CheckoutRouteDependencies
    > = {}
) {
  const dependencies:
    CheckoutRouteDependencies = {
      ...defaultDependencies,
      ...overrides,
    };


  return async function checkoutPost(
    request:
      NextRequest
  ) {
    try {
      await dependencies
        .initializeDatabase();


      const db =
        dependencies
          .getDatabase();


      const token =
        request.cookies
          .get(
            "fd-session"
          )
          ?.value;


      if (!token) {
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
        await dependencies
          .validateSessionToken(
            token
          );


      if (!user) {
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


      const body =
        await request.json();


      const {
        items,
        paymentMethod,
        coupon,
      } = body;


      /**
       * A configuração financeira é validada antes
       * da criação do pedido.
       *
       * Erro local de configuração não deve criar
       * pedidos órfãos.
       */
      const baseUrl =
        dependencies
          .getBaseUrl();


      dependencies
        .getAccessToken();


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
       * Neste ponto o pedido pending e seus itens
       * já existem no banco.
       *
       * Se o provedor falhar, o pedido é preservado
       * para futura reconciliação.
       */
      const mpResult =
        await dependencies
          .createPreference(
            {
              items:
                mpItems,

              expectedTotal:
                total,

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


      attachPaymentPreference(
        db,
        order.id,
        mpResult.preference_id
      );


      const checkoutUrl =
        mpResult.init_point;


      const preferenceId =
        mpResult.preference_id;


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
      if (
        error instanceof
        PaymentConfigurationError
      ) {
        console.error(
          "Configuração de pagamento indisponível:",
          error.message
        );


        return NextResponse.json(
          {
            error:
              "Pagamento temporariamente indisponível.",
          },
          {
            status:
              503,
          }
        );
      }


      if (
        error instanceof
        MercadoPagoProviderError
      ) {
        console.error(
          "Falha do provedor de pagamento:",
          error.message
        );


        return NextResponse.json(
          {
            error:
              "Não foi possível iniciar o pagamento. Tente novamente.",
          },
          {
            status:
              502,
          }
        );
      }


      console.error(
        "Erro ao criar checkout:",
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
  };
}