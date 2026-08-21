import type { Metadata } from "next";
import { Suspense } from "react";

import { CheckoutSuccess } from "../../../components/checkout-success";

export const metadata: Metadata = {
  title: "Compra confirmada",
  description: "Sua compra foi realizada com sucesso.",
};

/**
 * Estado exibido enquanto o Client Component que utiliza
 * useSearchParams() é hidratado.
 *
 * O Suspense é necessário porque useSearchParams() depende
 * da URL do navegador e não pode ser resolvido durante a
 * pré-renderização estática da página.
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

        <small>PROCESSANDO</small>

        <h1>
          Confirmando sua compra...
        </h1>

        <p>
          Aguarde enquanto carregamos os dados da confirmação.
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