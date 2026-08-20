"use client";
import { useEffect, useState } from "react";
import { useAuth } from "./auth-provider";
import { formatPrice } from "../lib/products";
import Link from "next/link";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Stats {
  summary: {
    totalUsers: number;
    totalOrders: number;
    totalRevenue: number;
    pendingOrders: number;
    refundedOrders: number;
    totalProducts: number;
    averageTicket: number;
  };
  topProducts: Array<{
    title: string;
    slug: string;
    quantity: number;
    revenue: number;
  }>;
  salesByDay: Array<{ date: string; count: number; revenue: number }>;
  signupsByDay: Array<{ date: string; count: number }>;
  salesByMethod: Array<{ method: string; count: number; revenue: number }>;
}

export function AdminDashboard() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "orders" | "products">("overview");
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    fetchStats();
  }, [dateRange]);

  async function fetchStats() {
    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate + "T00:00:00.000Z",
        endDate: dateRange.endDate + "T23:59:59.999Z",
      });
      const res = await fetch(`/api/admin/stats?${params}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Erro ao buscar stats:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="admin-page">
        <div className="container" style={{ padding: "4rem 1rem", textAlign: "center" }}>
          <p>Carregando painel administrativo...</p>
        </div>
      </main>
    );
  }

  if (!stats) {
    return (
      <main className="admin-page">
        <div className="container" style={{ padding: "4rem 1rem", textAlign: "center" }}>
          <h2>❌ Erro ao carregar estatísticas</h2>
        </div>
      </main>
    );
  }

  const COLORS = ["#0a2a52", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

  return (
    <main className="admin-page">
      <section className="admin-header">
        <div className="container">
          <div className="admin-title">
            <span className="eyebrow eyebrow-light"><i /> Painel Administrativo</span>
            <h1>Facil Digital+ • Dashboard</h1>
          </div>
          <div className="admin-actions">
            <span className="admin-user">
              👤 {user?.name || user?.email}
            </span>
            <button onClick={logout} className="button button-ghost">
              Sair
            </button>
          </div>
        </div>
      </section>

      <section className="container admin-layout">
        {/* Sidebar */}
        <aside className="admin-sidebar">
          <button
            className={activeTab === "overview" ? "active" : ""}
            onClick={() => setActiveTab("overview")}
          >
            📊 Visão Geral
          </button>
          <button
            className={activeTab === "orders" ? "active" : ""}
            onClick={() => setActiveTab("orders")}
          >
            🛒 Pedidos
          </button>
          <button
            className={activeTab === "products" ? "active" : ""}
            onClick={() => setActiveTab("products")}
          >
            📚 Produtos
          </button>
          <hr />
          <Link href="/minha-conta" className="admin-link">
            ← Voltar ao site
          </Link>
        </aside>

        {/* Conteúdo */}
        <div className="admin-content">
          {activeTab === "overview" && (
            <>
              {/* Filtro de data */}
              <div className="stats-filter">
                <label>
                  De:
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) =>
                      setDateRange({ ...dateRange, startDate: e.target.value })
                    }
                  />
                </label>
                <label>
                  Até:
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) =>
                      setDateRange({ ...dateRange, endDate: e.target.value })
                    }
                  />
                </label>
                <button onClick={fetchStats} className="button button-primary">
                  Filtrar
                </button>
              </div>

              {/* Cards de resumo */}
              <div className="stats-grid">
                <div className="stat-card highlight">
                  <small>FATURAMENTO</small>
                  <strong>{formatPrice(stats.summary.totalRevenue)}</strong>
                  <span>{stats.summary.totalOrders} vendas</span>
                </div>
                <div className="stat-card">
                  <small>PEDIDOS</small>
                  <strong>{stats.summary.totalOrders}</strong>
                  <span>{stats.summary.pendingOrders} pendentes</span>
                </div>
                <div className="stat-card">
                  <small>TICKET MÉDIO</small>
                  <strong>{formatPrice(stats.summary.averageTicket)}</strong>
                  <span>por venda</span>
                </div>
                <div className="stat-card">
                  <small>USUÁRIOS</small>
                  <strong>{stats.summary.totalUsers}</strong>
                  <span>cadastros</span>
                </div>
                <div className="stat-card warning">
                  <small>REEMBOLSOS</small>
                  <strong>{stats.summary.refundedOrders}</strong>
                  <span>pedidos</span>
                </div>
                <div className="stat-card">
                  <small>PRODUTOS</small>
                  <strong>{stats.summary.totalProducts}</strong>
                  <span>ativos</span>
                </div>
              </div>

              {/* Gráfico de vendas */}
              <div className="chart-card">
                <h3>📈 Vendas por dia</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={stats.salesByDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="count"
                      stroke="#0a2a52"
                      strokeWidth={2}
                      name="Vendas"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="revenue"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      name="Faturamento (R$)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Gráficos lado a lado */}
              <div className="charts-row">
                <div className="chart-card">
                  <h3>👥 Cadastros por dia</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={stats.signupsByDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#10b981" name="Cadastros" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-card">
                  <h3>💳 Método de pagamento</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={stats.salesByMethod}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => entry.method || "N/A"}
                        outerRadius={80}
                        dataKey="count"
                      >
                        {stats.salesByMethod.map((_, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top produtos */}
              <div className="table-card">
                <h3>🏆 Top 10 Produtos Mais Vendidos</h3>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Produto</th>
                      <th>Unidades</th>
                      <th>Faturamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topProducts.map((p, idx) => (
                      <tr key={p.slug}>
                        <td><strong>{idx + 1}º</strong></td>
                        <td>{p.title}</td>
                        <td>{Number(p.quantity)}</td>
                        <td><strong>{formatPrice(Number(p.revenue))}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeTab === "orders" && <AdminOrders />}
          {activeTab === "products" && <AdminProducts />}
        </div>
      </section>
    </main>
  );
}

// Componente de Pedidos (inline para simplificar)
function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  async function fetchOrders() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set("status", filter);
      const res = await fetch(`/api/admin/orders?${params}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(orderId: number, newStatus: string) {
    if (!confirm(`Atualizar pedido #${orderId} para ${newStatus}?`)) return;
    try {
      await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderId, status: newStatus }),
      });
      fetchOrders();
    } catch (error) {
      alert("Erro ao atualizar");
    }
  }

  if (loading) return <p>Carregando pedidos...</p>;

  return (
    <div>
      <div className="table-filter">
        <h3>🛒 Todos os Pedidos</h3>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="pending">Pendente</option>
          <option value="approved">Aprovado</option>
          <option value="rejected">Rejeitado</option>
          <option value="refunded">Reembolsado</option>
        </select>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Cliente</th>
            <th>Produtos</th>
            <th>Total</th>
            <th>Status</th>
            <th>Data</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td><strong>#{order.id}</strong></td>
              <td>
                <div>{order.userName || "—"}</div>
                <small>{order.userEmail}</small>
              </td>
              <td>
                {order.items.slice(0, 2).map((i: any) => (
                  <div key={i.id} style={{ fontSize: "0.85em" }}>
                    {i.productTitle} (×{i.quantity})
                  </div>
                ))}
                {order.items.length > 2 && <small>+{order.items.length - 2} mais</small>}
              </td>
              <td><strong>{formatPrice(order.total)}</strong></td>
              <td>
                <span className={`status-badge status-${order.status}`}>
                  {order.status}
                </span>
              </td>
              <td>{new Date(order.createdAt).toLocaleDateString("pt-BR")}</td>
              <td>
                <select
                  onChange={(e) => updateStatus(order.id, e.target.value)}
                  defaultValue=""
                  style={{ fontSize: "0.8em", padding: "0.3rem" }}
                >
                  <option value="">Alterar...</option>
                  <option value="approved">Aprovar</option>
                  <option value="rejected">Rejeitar</option>
                  <option value="refunded">Reembolsar</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Componente de Produtos (inline)
function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/products", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleProduct(product: any) {
    try {
      await fetch("/api/admin/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: product.id, active: !product.active }),
      });
      fetchProducts();
    } catch (error) {
      alert("Erro");
    }
  }

  if (loading) return <p>Carregando produtos...</p>;

  return (
    <div>
      <h3>📚 Produtos Cadastrados ({products.length})</h3>
      <table className="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Título</th>
            <th>Slug</th>
            <th>Categoria</th>
            <th>Preço</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.title}</td>
              <td><code>{p.slug}</code></td>
              <td>{p.category || "—"}</td>
              <td>{formatPrice(p.price)}</td>
              <td>
                <span className={`status-badge ${p.active ? "status-approved" : "status-rejected"}`}>
                  {p.active ? "Ativo" : "Inativo"}
                </span>
              </td>
              <td>
                <button
                  onClick={() => toggleProduct(p)}
                  className="button button-ghost"
                  style={{ padding: "0.3rem 0.6rem", fontSize: "0.8em" }}
                >
                  {p.active ? "Desativar" : "Ativar"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}