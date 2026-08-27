import type {
  Metadata,
} from "next";

import {
  Suspense,
} from "react";

import {
  CheckoutSuccess,
} from "../../../components/checkout-success";


export const metadata:
  Metadata = {
    title:
      "Status da compra",

    description:
      "Consulte o estado da sua compra com segurança.",
  };


/**
 * Nenhuma confirmação financeira é apresentada
 * durante a hidratação.
 *
 * O estado approved somente poderá aparecer depois
 * da consulta autenticada ao servidor.
 */
function CheckoutSuccessLoading() {
  return (
    <main className="checkout-success-page">
      <div className="success-container">
        <span
          className="success-icon"
          aria-hidden="true"
        >
          …
        </span>

        <small>
          VERIFICANDO PAGAMENTO
        </small>

        <h1>
          Confirmando sua compra...
        </h1>

        <p>
          Aguarde enquanto consultamos o estado financeiro registrado no servidor.
        </p>
      </div>
    </main>
  );
}


export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <CheckoutSuccessLoading />
      }
    >
      <CheckoutSuccess />
    </Suspense>
  );
}