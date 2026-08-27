import type {
  Metadata,
} from "next";

import Link from "next/link";


export const metadata:
  Metadata = {
    title:
      "Pagamento não concluído",

    description:
      "O pagamento não foi concluído.",
  };


export default function CheckoutFailurePage() {
  return (
    <main className="checkout-success-page">
      <div className="success-container">
        <span
          className="success-icon"
          aria-hidden="true"
        >
          !
        </span>

        <small>
          PAGAMENTO NÃO CONCLUÍDO
        </small>

        <h1>
          Não foi possível concluir o pagamento.
        </h1>

        <p>
          Nenhum acesso é liberado por esta página. Consulte seus pedidos para verificar o estado financeiro registrado ou tente realizar o pagamento novamente.
        </p>

        <div className="success-actions">
          <Link
            href="/checkout"
            className="button button-primary"
          >
            Tentar novamente →
          </Link>

          <Link
            href="/minha-conta"
            className="button button-ghost"
          >
            Ver meus pedidos
          </Link>
        </div>
      </div>
    </main>
  );
}