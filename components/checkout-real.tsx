"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPrice } from "../lib/currency";
import { useShop } from "./shop-provider";
import { useAuth } from "./auth-provider";

export function CheckoutReal() {
  const { cart, add, remove } = useShop();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [method, setMethod] = useState("pix");
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const subtotal = cart.reduce((s, i) => s + i.price, 0);
  const discount = applied ? 10 : 0;
  const total = Math.max(0, subtotal - discount);

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!user) {
      router.push("/login?returnTo=/checkout");
      return;
    }

    if (cart.length === 0) {
      setError("Seu carrinho está vazio.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          items: cart.map((item) => ({ slug: item.slug, quantity: 1 })),
          paymentMethod: method,
          coupon: applied ? coupon : null,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Redirecionar para o Mercado Pago
        if (data.checkoutUrl.startsWith("http")) {
          window.location.href = data.checkoutUrl;
        } else {
          // Modo demo: simula sucesso
          router.push(data.checkoutUrl);
        }
      } else {
        setError(data.error || "Erro ao processar pagamento.");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function applyCoupon() {
    if (coupon.toUpperCase() === "APROVA10") {
      setApplied(true);
      setError("");
    } else {
      setApplied(false);
      setError("Cupom inválido. Tente APROVA10.");
    }
  }

  if (authLoading) {
    return (
      <main className="checkout-page">
        <div className="container" style={{ padding: "4rem 1rem", textAlign: "center" }}>
          <p>Carregando...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="checkout-page">
        <section className="checkout-auth-required">
          <div className="container">
            <span className="eyebrow"><i /> Checkout seguro</span>
            <h1>Faça login para finalizar sua compra.</h1>
            <p>Você precisa estar logado para prosseguir com o pagamento.</p>
            <Link href="/login?returnTo=/checkout" className="button button-primary">
              Fazer login ou cadastrar →
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (cart.length === 0) {
    return (
      <main className="checkout-page">
        <div className="checkout-empty-full">
          <span>▤</span>
          <h2>Seu carrinho está vazio.</h2>
          <Link href="/apostilas" className="button button-primary">
            Explorar apostilas →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="checkout-page">
      <div className="container checkout-heading">
        <span className="eyebrow"><i /> Ambiente seguro</span>
        <h1>Falta pouco para começar.</h1>
        <p>Pagamento processado pelo Mercado Pago com total segurança.</p>
      </div>

      <div className="container checkout-grid">
        <form className="checkout-form" onSubmit={handleCheckout}>
          {/* Dados do usuário */}
          <section>
            <header>
              <span>1</span>
              <div>
                <h2>Seus dados</h2>
                <p>Usados para liberar e proteger o material.</p>
              </div>
            </header>
            <div className="field-grid">
              <label>
                Nome completo
                <input value={user.name || ""} disabled />
              </label>
              <label>
                E-mail
                <input value={user.email} disabled />
              </label>
              <label>
                CPF
                <input
                  value={
                    user.cpf
                      ? user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
                      : "Não cadastrado"
                  }
                  disabled
                />
              </label>
            </div>
            {!user.cpf && (
              <div className="cpf-warning">
                ⚠ Cadastre seu CPF no perfil para receber os PDFs protegidos.{" "}
                <Link href="/minha-conta">Atualizar perfil →</Link>
              </div>
            )}
            <small className="privacy-note">
              ♢ O CPF será usado como senha do PDF e como marca d'água em todas as páginas.
            </small>
          </section>

          {/* Pagamento */}
          <section>
            <header>
              <span>2</span>
              <div>
                <h2>Pagamento</h2>
                <p>Escolha a melhor forma para você.</p>
              </div>
            </header>

            <div className="payment-tabs">
              {[
                ["pix", "PIX", "à vista"],
                ["card", "Cartão", "até 12x"],
                ["boleto", "Boleto", "à vista"],
              ].map((m) => (
                <button
                  type="button"
                  key={m[0]}
                  onClick={() => setMethod(m[0])}
                  className={method === m[0] ? "active" : ""}
                >
                  <b>{m[1]}</b>
                  <small>{m[2]}</small>
                </button>
              ))}
            </div>

            {method === "pix" && (
              <div className="payment-demo">
                <span>◇</span>
                <div>
                  <h3>PIX</h3>
                  <p>
                    Você será redirecionado ao Mercado Pago para concluir o pagamento com segurança.
                  </p>
                </div>
              </div>
            )}

            {method === "card" && (
              <div className="payment-demo">
                <span>💳</span>
                <div>
                  <h3>Cartão de crédito</h3>
                  <p>Você será redirecionado ao Mercado Pago para inserir os dados com segurança.</p>
                </div>
              </div>
            )}

            {method === "boleto" && (
              <div className="payment-demo">
                <span>▤</span>
                <div>
                  <h3>Boleto bancário</h3>
                  <p>O acesso será liberado após a compensação, normalmente em 1 dia útil.</p>
                </div>
              </div>
            )}

            {error && (
              <div className="checkout-error">
                <span>⚠</span> {error}
              </div>
            )}

            <button
              type="submit"
              className="button button-accent submit-order"
              disabled={loading || cart.length === 0}
            >
              {loading
                ? "Processando..."
                : cart.length
                ? "Finalizar compra →"
                : "Adicione um material primeiro"}
            </button>

            <small className="payment-security">
              🔒 Pagamento 100% seguro via Mercado Pago. Seus dados não são armazenados.
            </small>
          </section>
        </form>

        {/* Resumo do pedido */}
        <aside className="order-summary">
          <span>RESUMO DO PEDIDO</span>
          {cart.map((i) => (
            <article key={i.slug}>
              <div className={`tiny-cover ${i.coverClass}`} />
              <div>
                <strong>{i.title}</strong>
                <small>Digital • acesso imediato</small>
              </div>
              <b>{formatPrice(i.price)}</b>
            </article>
          ))}

          <div className="coupon">
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
              placeholder="Cupom: APROVA10"
              disabled={applied}
            />
            <button type="button" onClick={applyCoupon} disabled={applied}>
              {applied ? "✓" : "Aplicar"}
            </button>
          </div>

          {coupon && (
            <small className={applied ? "coupon-ok" : "coupon-hint"}>
              {applied
                ? "Cupom aplicado: R$ 10,00 de desconto"
                : "Use APROVA10 para desconto."}
            </small>
          )}

          <dl>
            <div>
              <dt>Subtotal</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            <div>
              <dt>Descontos</dt>
              <dd>- {formatPrice(discount)}</dd>
            </div>
            <div className="total-row">
              <dt>Total</dt>
              <dd>{formatPrice(total)}</dd>
            </div>
          </dl>

          <footer>
            <span>♢ Pagamento protegido</span>
            <span>7 Garantia de 7 dias</span>
          </footer>
        </aside>
      </div>
    </main>
  );
}