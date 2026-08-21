import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "../../components/login-form";

export const metadata: Metadata = {
  title: "Entrar ou Cadastrar",
  description:
    "Acesse sua conta ou crie uma nova para começar a estudar.",
};

/**
 * Fallback exibido enquanto o componente de login,
 * que utiliza useSearchParams(), é hidratado no cliente.
 */
function LoginLoading() {
  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="container">
          <span className="eyebrow eyebrow-light">
            <i /> Acesse sua conta
          </span>

          <h1>Carregando...</h1>

          <p>
            Aguarde enquanto preparamos sua área de acesso.
          </p>
        </div>
      </section>

      <section className="container login-container">
        <div className="login-card">
          <p
            style={{
              textAlign: "center",
              padding: "2rem",
            }}
          >
            Carregando formulário...
          </p>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  );
}