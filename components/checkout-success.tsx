"use client";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";

import {
  useSearchParams,
} from "next/navigation";


type CheckoutUiState =
  | "loading"
  | "pending"
  | "approved"
  | "rejected"
  | "refunded"
  | "charged_back"
  | "missing_reference"
  | "not_found"
  | "unauthenticated"
  | "error";


interface CheckoutStatusPayload {
  order?: {
    id?:
      number;

    status?:
      string;

    entitlementActive?:
      boolean;

    updatedAt?:
      string;
  };

  error?:
    string;
}


interface CheckoutView {
  icon:
    string;

  label:
    string;

  title:
    string;

  description:
    string;
}


const STORED_REFERENCE_KEY =
  "fd-checkout-order-reference";


const MAX_STATUS_ATTEMPTS =
  8;


const STATUS_POLL_INTERVAL_MS =
  1500;


function readStoredReference():
  string {
  try {
    return (
      window.sessionStorage.getItem(
        STORED_REFERENCE_KEY
      ) ??
      ""
    ).trim();
  } catch {
    return "";
  }
}


function clearStoredReference(
  reference:
    string
) {
  try {
    const stored =
      window.sessionStorage.getItem(
        STORED_REFERENCE_KEY
      );


    if (
      stored?.trim() ===
      reference
    ) {
      window.sessionStorage.removeItem(
        STORED_REFERENCE_KEY
      );
    }
  } catch {
    /**
     * sessionStorage é apenas um mecanismo
     * auxiliar de localização.
     *
     * Ele nunca possui autoridade financeira.
     */
  }
}


function getCheckoutView(
  state:
    CheckoutUiState
): CheckoutView {
  switch (
    state
  ) {
    case "approved":
      return {
        icon:
          "✓",

        label:
          "PAGAMENTO CONFIRMADO",

        title:
          "Sua compra foi confirmada!",

        description:
          "Seu pagamento foi confirmado pelo servidor e seus materiais estão disponíveis na sua biblioteca.",
      };


    case "pending":
      return {
        icon:
          "…",

        label:
          "CONFIRMAÇÃO EM ANDAMENTO",

        title:
          "Estamos confirmando seu pagamento.",

        description:
          "O retorno do pagamento foi recebido, mas o servidor ainda aguarda a confirmação financeira definitiva.",
      };


    case "rejected":
      return {
        icon:
          "!",

        label:
          "PAGAMENTO NÃO APROVADO",

        title:
          "O pagamento não foi aprovado.",

        description:
          "Nenhum material foi liberado. Você pode consultar seu pedido ou realizar uma nova tentativa.",
      };


    case "refunded":
      return {
        icon:
          "↩",

        label:
          "PAGAMENTO REEMBOLSADO",

        title:
          "Este pagamento foi reembolsado.",

        description:
          "O acesso relacionado a este pedido não está ativo.",
      };


    case "charged_back":
      return {
        icon:
          "!",

        label:
          "PAGAMENTO CONTESTADO",

        title:
          "Este pagamento está contestado.",

        description:
          "O acesso relacionado a este pedido está suspenso enquanto o estado financeiro permanecer contestado.",
      };


    case "missing_reference":
      return {
        icon:
          "?",

        label:
          "CONFIRMAÇÃO INDISPONÍVEL",

        title:
          "Não foi possível identificar o pedido.",

        description:
          "A URL de retorno não contém uma referência utilizável. Consulte seus pedidos para verificar o estado da compra.",
      };


    case "not_found":
      return {
        icon:
          "?",

        label:
          "PEDIDO NÃO LOCALIZADO",

        title:
          "Não foi possível localizar este pedido.",

        description:
          "A referência recebida não corresponde a um pedido pertencente à sua conta.",
      };


    case "unauthenticated":
      return {
        icon:
          "!",

        label:
          "SESSÃO NECESSÁRIA",

        title:
          "Entre novamente na sua conta.",

        description:
          "Por segurança, o estado financeiro do pedido só pode ser consultado pelo usuário autenticado.",
      };


    case "error":
      return {
        icon:
          "!",

        label:
          "CONFIRMAÇÃO INDISPONÍVEL",

        title:
          "Não foi possível confirmar o pagamento agora.",

        description:
          "Não consideramos a compra aprovada sem confirmação do servidor. Consulte seus pedidos e tente novamente em instantes.",
      };


    case "loading":
    default:
      return {
        icon:
          "…",

        label:
          "VERIFICANDO PAGAMENTO",

        title:
          "Confirmando sua compra...",

        description:
          "Aguarde enquanto consultamos o estado financeiro registrado no servidor.",
      };
  }
}


export function CheckoutSuccess() {
  const searchParams =
    useSearchParams();


  /**
   * Da URL utilizamos SOMENTE external_reference
   * como localizador do pedido.
   *
   * Não utilizamos como autoridade:
   *
   * - status;
   * - collection_status;
   * - payment_id;
   * - collection_id;
   * - demo.
   *
   * A confirmação financeira é obtida através do
   * endpoint autenticado /api/checkout/status.
   */
  const externalReference =
    (
      searchParams.get(
        "external_reference"
      ) ??
      ""
    ).trim();


  const [
    state,
    setState,
  ] =
    useState<CheckoutUiState>(
      "loading"
    );


  useEffect(
    () => {
      let cancelled =
        false;

      let timeoutId:
        ReturnType<
          typeof setTimeout
        > | null =
        null;


      /**
       * A referência retornada pelo provedor é
       * preferida.
       *
       * sessionStorage existe apenas como fallback
       * caso o navegador volte sem external_reference.
       *
       * Nenhuma das duas fontes possui autoridade
       * para determinar status financeiro.
       */
      const reference =
        externalReference ||
        readStoredReference();


      if (
        !reference
      ) {
        setState(
          "missing_reference"
        );


        return () => {
          cancelled =
            true;
        };
      }


      let attempt =
        0;


      async function checkStatus() {
        try {
          const query =
            new URLSearchParams({
              external_reference:
                reference,
            });


          const response =
            await fetch(
              `/api/checkout/status?${query.toString()}`,
              {
                method:
                  "GET",

                credentials:
                  "include",

                cache:
                  "no-store",
              }
            );


          if (
            cancelled
          ) {
            return;
          }


          if (
            response.status ===
            401
          ) {
            setState(
              "unauthenticated"
            );

            return;
          }


          if (
            response.status ===
            404
          ) {
            setState(
              "not_found"
            );

            return;
          }


          if (
            !response.ok
          ) {
            setState(
              "error"
            );

            return;
          }


          const payload =
            (
              await response.json()
            ) as
              CheckoutStatusPayload;


          if (
            cancelled
          ) {
            return;
          }


          const status =
            payload.order
              ?.status;


          /**
           * Único caminho visual para
           * "PAGAMENTO CONFIRMADO".
           *
           * O backend autenticado precisa retornar:
           *
           * status === approved
           *
           * E:
           *
           * entitlementActive === true
           *
           * Query string, redirect e sessionStorage
           * jamais satisfazem esta condição.
           */
          if (
            status ===
            "approved"
          ) {
            if (
              payload.order
                ?.entitlementActive !==
              true
            ) {
              setState(
                "error"
              );

              return;
            }


            clearStoredReference(
              reference
            );


            setState(
              "approved"
            );

            return;
          }


          if (
            status ===
              "rejected" ||
            status ===
              "refunded" ||
            status ===
              "charged_back"
          ) {
            clearStoredReference(
              reference
            );


            setState(
              status
            );

            return;
          }


          if (
            status ===
            "pending"
          ) {
            setState(
              "pending"
            );


            attempt +=
              1;


            /**
             * O redirect pode chegar alguns
             * instantes antes do webhook.
             *
             * Fazemos apenas polling read-only
             * durante uma janela curta.
             */
            if (
              attempt <
              MAX_STATUS_ATTEMPTS
            ) {
              timeoutId =
                setTimeout(
                  () => {
                    void checkStatus();
                  },
                  STATUS_POLL_INTERVAL_MS
                );
            }


            return;
          }


          /**
           * Estado desconhecido:
           *
           * fail closed.
           */
          setState(
            "error"
          );
        } catch {
          if (
            !cancelled
          ) {
            setState(
              "error"
            );
          }
        }
      }


      void checkStatus();


      return () => {
        cancelled =
          true;


        if (
          timeoutId
        ) {
          clearTimeout(
            timeoutId
          );
        }
      };
    },
    [
      externalReference,
    ]
  );


  const view =
    getCheckoutView(
      state
    );


  const loading =
    state ===
    "loading";


  const approved =
    state ===
    "approved";


  return (
    <main className="checkout-success-page">
      <div className="success-container">
        <span
          className="success-icon"
          aria-hidden="true"
        >
          {view.icon}
        </span>

        <small>
          {view.label}
        </small>

        <h1>
          {view.title}
        </h1>

        <p>
          {view.description}
        </p>


        {!loading && (
          <div className="success-actions">
            {approved ? (
              <>
                <Link
                  href="/minha-conta"
                  className="button button-primary"
                >
                  Acessar minha biblioteca →
                </Link>

                <Link
                  href="/simulados"
                  className="button button-ghost"
                >
                  Fazer simulados
                </Link>
              </>
            ) : state ===
              "unauthenticated" ? (
              <>
                <Link
                  href="/login?returnTo=/minha-conta"
                  className="button button-primary"
                >
                  Entrar novamente →
                </Link>

                <Link
                  href="/"
                  className="button button-ghost"
                >
                  Ir para o início
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/minha-conta"
                  className="button button-primary"
                >
                  Ver meus pedidos →
                </Link>

                <Link
                  href="/apostilas"
                  className="button button-ghost"
                >
                  Ver catálogo
                </Link>
              </>
            )}
          </div>
        )}


        {approved && (
          <div className="success-info">
            <small>
              ♢ Seus PDFs estão protegidos com seu CPF como senha e marca d&apos;água.
            </small>
          </div>
        )}
      </div>
    </main>
  );
}