import type {
  Metadata,
} from "next";

import Link from "next/link";


export const metadata:
  Metadata = {
    title:
      "Pagamento em processamento",

    description:
      "Acompanhe a confirmação do seu pagamento.",
  };


export default function CheckoutPendingPage() {
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
          PAGAMENTO EM PROCESSAMENTO
        </small>

        <h1>
          Seu pagamento ainda não foi confirmado.
        </h1>

        <p>
          Algumas formas de pagamento podem levar mais tempo para serem confirmadas. O acesso será liberado somente depois que o servidor registrar a aprovação financeira.
        </p>

        <div className="success-actions">
          <Link
            href="/minha-conta"
            className="button button-primary"
          >
            Acompanhar meus pedidos →
          </Link>

          <Link
            href="/apostilas"
            className="button button-ghost"
          >
            Voltar ao catálogo
          </Link>
        </div>
      </div>
    </main>
  );
}