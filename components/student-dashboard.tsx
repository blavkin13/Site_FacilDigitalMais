"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "./auth-provider";
import { formatPrice } from "../lib/products";

interface OrderItem {
  id: number;
  quantity: number;
  unitPrice: number;
  productSlug: string | null;
  productTitle: string;
  productShortTitle: string | null;
  productCover: string | null;
  productCoverClass: string | null;
}

interface UserOrder {
  id: number;
  status: string;
  paymentMethod: string | null;
  subtotal: number;
  discount: number;
  total: number;
  coupon: string | null;
  createdAt: string;
  items: OrderItem[];
}

export function StudentDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"biblioteca" | "pedidos" | "perfil">("biblioteca");

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    try {
      const res = await fetch("/api/orders", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error("Erro ao carregar pedidos:", error);
    } finally {
      setLoading(false);
    }
  }

  // Produtos únicos comprados (biblioteca)
  const purchasedProducts = orders.flatMap((order) =>
    order.items.map((item) => ({
      ...item,
      purchasedAt: order.createdAt,
      orderId: order.id,
    }))
  );

  // Estatísticas
  const totalSpent = orders.reduce((sum, o) => sum + o.total, 0);
  const totalProducts = purchasedProducts.length;
  const statusLabels: Record<string, string> = {
    approved: "Aprovado",
    pending: "Pendente",
    rejected: "Rejeitado",
    refunded: "Reembolsado",
  };
  const statusClasses: Record<string, string> = {
    approved: "status-approved",
    pending: "status-pending",
    rejected: "status-rejected",
    refunded: "status-refunded",
  };

  if (loading) {
    return (
      <main className="student-page">
        <div className="container" style={{ padding: "4rem 1rem", textAlign: "center" }}>
          <p>Carregando sua biblioteca...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="student-page">
      <section className="student-hero">
        <div className="container">
          <div>
            <span className="eyebrow eyebrow-light">
              <i /> Área do aluno
            </span>
            <h1>
              Olá, {user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "aluno"}.
            </h1>
            <p>Sua biblioteca digital está sempre disponível.</p>
          </div>
          <div className="weekly-ring">
            <strong>{totalProducts}</strong>
            <span>materiais</span>
          </div>
        </div>
      </section>

      <div className="container student-grid">
        <aside className="student-menu">
          <b>MINHA CONTA</b>
          <button
            className={activeTab === "biblioteca" ? "active" : ""}
            onClick={() => setActiveTab("biblioteca")}
          >
            ▤ Biblioteca
          </button>
          <button
            className={activeTab === "pedidos" ? "active" : ""}
            onClick={() => setActiveTab("pedidos")}
          >
            ⬡ Meus Pedidos
          </button>
          <Link href="/simulados">✓ Simulados</Link>
          <button
            className={activeTab === "perfil" ? "active" : ""}
            onClick={() => setActiveTab("perfil")}
          >
            ♙ Perfil e segurança
          </button>

          <div className="student-stats-mini">
            <small>TOTAL INVESTIDO</small>
            <strong>{formatPrice(totalSpent)}</strong>
            <small>{totalProducts} materiais comprados</small>
          </div>
        </aside>

        <div className="student-content">
          {/* ABA BIBLIOTECA */}
          {activeTab === "biblioteca" && (
            <section id="biblioteca">
              <header>
                <div>
                  <span>MINHA BIBLIOTECA</span>
                  <h2>Seus materiais adquiridos</h2>
                </div>
                <Link href="/apostilas">Explorar catálogo →</Link>
              </header>

              {purchasedProducts.length === 0 ? (
                <div className="library-empty">
                  <span>▤</span>
                  <h3>Sua biblioteca está vazia</h3>
                  <p>Adquira seu primeiro material para começar a estudar.</p>
                  <Link href="/apostilas" className="button button-primary">
                    Ver apostilas →
                  </Link>
                </div>
              ) : (
                <div className="library-grid">
                  {purchasedProducts.map((item, idx) => (
                    <article key={`${item.orderId}-${item.productSlug}-${idx}`} className="library-item">
                      <div
                        className={`library-cover ${item.productCoverClass || ""}`}
                        style={{
                          backgroundImage: `linear-gradient(180deg,transparent,rgba(4,20,40,.92)),url(${item.productCover || ""})`,
                        }}
                      >
                        <strong>{item.productShortTitle || item.productTitle}</strong>
                      </div>
                      <div>
                        <span className="status-open">COMPRADO</span>
                        <h3>{item.productTitle}</h3>
                        <p>
                          Adquirido em{" "}
                          {new Date(item.purchasedAt).toLocaleDateString("pt-BR")}
                        </p>
                        <footer>
                          <button className="button button-primary" disabled>
                            Baixar PDF protegido
                          </button>
                          <button className="button button-ghost" disabled>
                            Detalhes
                          </button>
                        </footer>
                        <small>
                          ♢ PDF protegido por senha (CPF) com marca d'água.
                        </small>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ABA PEDIDOS */}
          {activeTab === "pedidos" && (
            <section id="pedidos">
              <header>
                <div>
                  <span>HISTÓRICO</span>
                  <h2>Meus pedidos</h2>
                </div>
              </header>

              {orders.length === 0 ? (
                <div className="library-empty">
                  <span>⬡</span>
                  <h3>Nenhum pedido ainda</h3>
                  <p>Seus pedidos aparecerão aqui após a primeira compra.</p>
                </div>
              ) : (
                <div className="orders-list">
                  {orders.map((order) => (
                    <article key={order.id} className="order-card">
                      <header>
                        <div>
                          <small>Pedido #{String(order.id).padStart(4, "0")}</small>
                          <span>
                            {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        <span className={`status-badge ${statusClasses[order.status]}`}>
                          {statusLabels[order.status] || order.status}
                        </span>
                      </header>
                      <div className="order-items">
                        {order.items.map((item) => (
                          <div key={item.id} className="order-item-row">
                            <div className={`tiny-cover ${item.productCoverClass || ""}`} />
                            <div>
                              <strong>{item.productTitle}</strong>
                              <small>Qtd: {item.quantity}</small>
                            </div>
                            <b>{formatPrice(item.unitPrice * item.quantity)}</b>
                          </div>
                        ))}
                      </div>
                      <footer>
                        <div>
                          {order.discount > 0 && (
                            <span>Desconto: -{formatPrice(order.discount)}</span>
                          )}
                          <span>
                            Pagamento: {order.paymentMethod?.toUpperCase() || "—"}
                          </span>
                        </div>
                        <strong className="order-total">{formatPrice(order.total)}</strong>
                      </footer>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ABA PERFIL */}
          {activeTab === "perfil" && (
            <section id="perfil">
              <header>
                <div>
                  <span>PERFIL</span>
                  <h2>Seus dados</h2>
                </div>
              </header>
              <div className="profile-card">
                <div className="profile-field">
                  <small>Nome</small>
                  <strong>{user?.name || "—"}</strong>
                </div>
                <div className="profile-field">
                  <small>E-mail</small>
                  <strong>{user?.email}</strong>
                </div>
                <div className="profile-field">
                  <small>CPF</small>
                  <strong>
                    {user?.cpf
                      ? user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
                      : "—"}
                  </strong>
                </div>
                <div className="profile-field">
                  <small>Telefone</small>
                  <strong>{user?.phone || "—"}</strong>
                </div>
                <div className="profile-field">
                  <small>Tipo de conta</small>
                  <strong>
                    {user?.role === "admin" ? "Administrador" : "Aluno"}
                  </strong>
                </div>
              </div>
              <p className="profile-note">
                ♢ Em breve você poderá editar seus dados aqui.
              </p>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}