"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  formatPrice,
} from "../lib/currency";

import {
  AdminApostilas,
} from "./admin-apostilas";

import {
  AdminSimulados,
} from "./admin-simulados";

import {
  useAuth,
} from "./auth-provider";


interface Stats {
  summary: {
    totalUsers: number;
    totalOrders: number;
    totalRevenue: number;
    pendingOrders: number;
    refundedOrders: number;
    chargedBackOrders: number;
    totalProducts: number;
    averageTicket: number;
  };

  topProducts:
    Array<{
      title: string;
      slug: string;
      quantity: number;
      revenue: number;
    }>;

  salesByDay:
    Array<{
      date: string;
      count: number;
      revenue: number;
    }>;

  signupsByDay:
    Array<{
      date: string;
      count: number;
    }>;

  salesByMethod:
    Array<{
      method: string;
      count: number;
      revenue: number;
    }>;
}


type AdminTab =
  | "overview"
  | "orders"
  | "apostilas"
  | "simulados";


const CHART_COLORS = [
  "#0a2a52",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
];

const ORDER_STATUS_LABELS:
  Record<
    string,
    string
  > = {
    pending:
      "Pendente",

    approved:
      "Aprovado",

    rejected:
      "Rejeitado",

    refunded:
      "Reembolsado",

    charged_back:
      "Chargeback",
  };


export function AdminDashboard() {
  const {
    user,
    logout,
  } =
    useAuth();


  const [
    stats,
    setStats,
  ] =
    useState<Stats | null>(
      null
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );


  const [
    activeTab,
    setActiveTab,
  ] =
    useState<AdminTab>(
      "overview"
    );


  const [
    dateRange,
    setDateRange,
  ] =
    useState({
      startDate:
        new Date(
          Date.now() -
            30 *
              24 *
              60 *
              60 *
              1000
        )
          .toISOString()
          .split(
            "T"
          )[0],

      endDate:
        new Date()
          .toISOString()
          .split(
            "T"
          )[0],
    });


  useEffect(
    () => {
      void fetchStats();
    },
    [
      dateRange,
    ]
  );


  async function fetchStats() {
    try {
      const params =
        new URLSearchParams({
          startDate:
            dateRange.startDate +
            "T00:00:00.000Z",

          endDate:
            dateRange.endDate +
            "T23:59:59.999Z",
        });


      const response =
        await fetch(
          `/api/admin/stats?${params}`,
          {
            credentials:
              "include",
          }
        );


      if (
        response.ok
      ) {
        const data =
          await response.json();


        setStats(
          data
        );
      }
    } catch (
      error
    ) {
      console.error(
        "Erro ao buscar stats:",
        error
      );
    } finally {
      setLoading(
        false
      );
    }
  }


  if (
    loading
  ) {
    return (
      <main className="admin-page">
        <div
          className="container"
          style={{
            padding:
              "4rem 1rem",

            textAlign:
              "center",
          }}
        >
          <p>
            Carregando painel administrativo...
          </p>
        </div>
      </main>
    );
  }


  if (
    !stats
  ) {
    return (
      <main className="admin-page">
        <div
          className="container"
          style={{
            padding:
              "4rem 1rem",

            textAlign:
              "center",
          }}
        >
          <h2>
            ❌ Erro ao carregar estatísticas
          </h2>
        </div>
      </main>
    );
  }


  return (
    <main className="admin-page">
      <section className="admin-header">
        <div className="container">
          <div className="admin-title">
            <span className="eyebrow eyebrow-light">
              <i /> Painel Administrativo
            </span>

            <h1>
              Facil Digital+ • Dashboard
            </h1>
          </div>

          <div className="admin-actions">
            <span className="admin-user">
              👤{" "}
              {user?.name ||
                user?.email}
            </span>

            <button
              type="button"
              onClick={
                logout
              }
              className="button button-ghost"
            >
              Sair
            </button>
          </div>
        </div>
      </section>


      <section className="container admin-layout">
        <aside className="admin-sidebar">
          <button
            type="button"
            className={
              activeTab ===
              "overview"
                ? "active"
                : ""
            }
            onClick={
              () =>
                setActiveTab(
                  "overview"
                )
            }
          >
            📊 Visão Geral
          </button>

          <button
            type="button"
            className={
              activeTab ===
              "orders"
                ? "active"
                : ""
            }
            onClick={
              () =>
                setActiveTab(
                  "orders"
                )
            }
          >
            🛒 Pedidos
          </button>

          <button
            type="button"
            className={
              activeTab ===
              "apostilas"
                ? "active"
                : ""
            }
            onClick={
              () =>
                setActiveTab(
                  "apostilas"
                )
            }
          >
            📚 Apostilas
          </button>

          <button
            type="button"
            className={
              activeTab ===
              "simulados"
                ? "active"
                : ""
            }
            onClick={
              () =>
                setActiveTab(
                  "simulados"
                )
            }
          >
            📝 Simulados
          </button>

          <hr />

          <Link
            href="/minha-conta"
            className="admin-link"
          >
            ← Voltar ao site
          </Link>
        </aside>


        <div className="admin-content">
          {activeTab ===
            "overview" && (
            <>
              <div className="stats-filter">
                <label>
                  De:

                  <input
                    type="date"
                    value={
                      dateRange.startDate
                    }
                    onChange={
                      (
                        event
                      ) =>
                        setDateRange({
                          ...dateRange,

                          startDate:
                            event.target.value,
                        })
                    }
                  />
                </label>

                <label>
                  Até:

                  <input
                    type="date"
                    value={
                      dateRange.endDate
                    }
                    onChange={
                      (
                        event
                      ) =>
                        setDateRange({
                          ...dateRange,

                          endDate:
                            event.target.value,
                        })
                    }
                  />
                </label>

                <button
                  type="button"
                  onClick={
                    () =>
                      void fetchStats()
                  }
                  className="button button-primary"
                >
                  Filtrar
                </button>
              </div>


              <div className="stats-grid">
                <div className="stat-card highlight">
                  <small>
                    FATURAMENTO
                  </small>

                  <strong>
                    {formatPrice(
                      stats.summary
                        .totalRevenue
                    )}
                  </strong>

                  <span>
                    {stats.summary
                      .totalOrders}{" "}
                    vendas
                  </span>
                </div>

                <div className="stat-card">
                  <small>
                    PEDIDOS
                  </small>

                  <strong>
                    {stats.summary
                      .totalOrders}
                  </strong>

                  <span>
                    {stats.summary
                      .pendingOrders}{" "}
                    pendentes
                  </span>
                </div>

                <div className="stat-card">
                  <small>
                    TICKET MÉDIO
                  </small>

                  <strong>
                    {formatPrice(
                      stats.summary
                        .averageTicket
                    )}
                  </strong>

                  <span>
                    por venda
                  </span>
                </div>

                <div className="stat-card">
                  <small>
                    USUÁRIOS
                  </small>

                  <strong>
                    {stats.summary
                      .totalUsers}
                  </strong>

                  <span>
                    cadastros
                  </span>
                </div>

                <div className="stat-card warning">
                  <small>
                    REEMBOLSOS
                  </small>

                  <strong>
                    {stats.summary
                      .refundedOrders}
                  </strong>

                  <span>
                    pedidos
                  </span>
                </div>

                <div className="stat-card warning">
                  <small>
                    CHARGEBACKS
                  </small>

                  <strong>
                    {stats.summary
                      .chargedBackOrders}
                  </strong>

                  <span>
                    pedidos contestados
                  </span>
                </div>

                <div className="stat-card">
                  <small>
                    APOSTILAS
                  </small>

                  <strong>
                    {stats.summary
                      .totalProducts}
                  </strong>

                  <span>
                    ativas
                  </span>
                </div>
              </div>


              <div className="chart-card">
                <h3>
                  📈 Vendas por dia
                </h3>

                <ResponsiveContainer
                  width="100%"
                  height={
                    300
                  }
                >
                  <LineChart
                    data={
                      stats.salesByDay
                    }
                  >
                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis
                      dataKey="date"
                      tick={{
                        fontSize:
                          11,
                      }}
                    />

                    <YAxis
                      yAxisId="left"
                      tick={{
                        fontSize:
                          11,
                      }}
                    />

                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{
                        fontSize:
                          11,
                      }}
                    />

                    <Tooltip />

                    <Legend />

                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="count"
                      stroke="#0a2a52"
                      strokeWidth={
                        2
                      }
                      name="Vendas"
                    />

                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="revenue"
                      stroke="#f59e0b"
                      strokeWidth={
                        2
                      }
                      name="Faturamento (R$)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>


              <div className="charts-row">
                <div className="chart-card">
                  <h3>
                    👥 Cadastros por dia
                  </h3>

                  <ResponsiveContainer
                    width="100%"
                    height={
                      250
                    }
                  >
                    <BarChart
                      data={
                        stats.signupsByDay
                      }
                    >
                      <CartesianGrid strokeDasharray="3 3" />

                      <XAxis
                        dataKey="date"
                        tick={{
                          fontSize:
                            10,
                        }}
                      />

                      <YAxis
                        tick={{
                          fontSize:
                            11,
                        }}
                      />

                      <Tooltip />

                      <Bar
                        dataKey="count"
                        fill="#10b981"
                        name="Cadastros"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-card">
                  <h3>
                    💳 Método de pagamento
                  </h3>

                  <ResponsiveContainer
                    width="100%"
                    height={
                      250
                    }
                  >
                    <PieChart>
                      <Pie
                        data={
                          stats.salesByMethod
                        }
                        cx="50%"
                        cy="50%"
                        labelLine={
                          false
                        }
                        label={
                          (
                            entry
                          ) =>
                            entry.method ||
                            "N/A"
                        }
                        outerRadius={
                          80
                        }
                        dataKey="count"
                      >
                        {stats.salesByMethod.map(
                          (
                            _,
                            index
                          ) => (
                            <Cell
                              key={
                                index
                              }
                              fill={
                                CHART_COLORS[
                                  index %
                                    CHART_COLORS.length
                                ]
                              }
                            />
                          )
                        )}
                      </Pie>

                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>


              <div className="table-card">
                <h3>
                  🏆 Top 10 Apostilas Mais Vendidas
                </h3>

                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>
                        #
                      </th>

                      <th>
                        Apostila
                      </th>

                      <th>
                        Unidades
                      </th>

                      <th>
                        Faturamento
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {stats.topProducts.map(
                      (
                        product,
                        index
                      ) => (
                        <tr
                          key={
                            product.slug
                          }
                        >
                          <td>
                            <strong>
                              {index + 1}º
                            </strong>
                          </td>

                          <td>
                            {product.title}
                          </td>

                          <td>
                            {Number(
                              product.quantity
                            )}
                          </td>

                          <td>
                            <strong>
                              {formatPrice(
                                Number(
                                  product.revenue
                                )
                              )}
                            </strong>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}


          {activeTab ===
            "orders" && (
            <AdminOrders />
          )}


          {activeTab ===
            "apostilas" && (
            <AdminApostilas />
          )}

          {activeTab ===
            "simulados" && (
            <AdminSimulados />
          )}
        </div>
      </section>
    </main>
  );
}


function AdminOrders() {
  const [
    orders,
    setOrders,
  ] =
    useState<any[]>(
      []
    );


  const [
    filter,
    setFilter,
  ] =
    useState(
      ""
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );


  useEffect(
    () => {
      void fetchOrders();
    },
    [
      filter,
    ]
  );


  async function fetchOrders() {
    setLoading(
      true
    );


    try {
      const params =
        new URLSearchParams();


      if (
        filter
      ) {
        params.set(
          "status",
          filter
        );
      }


      const response =
        await fetch(
          `/api/admin/orders?${params}`,
          {
            credentials:
              "include",
          }
        );


      if (
        response.ok
      ) {
        const data =
          await response.json();


        setOrders(
          data.orders ||
          []
        );
      }
    } catch (
      error
    ) {
      console.error(
        error
      );
    } finally {
      setLoading(
        false
      );
    }
  }


  if (
    loading
  ) {
    return (
      <p>
        Carregando pedidos...
      </p>
    );
  }


  return (
    <div>
      <div className="table-filter">
        <h3>
          🛒 Todos os Pedidos
        </h3>

        <select
          value={
            filter
          }
          onChange={
            (
              event
            ) =>
              setFilter(
                event.target.value
              )
          }
        >
          <option value="">
            Todos os status
          </option>

          <option value="pending">
            Pendente
          </option>

          <option value="approved">
            Aprovado
          </option>

          <option value="rejected">
            Rejeitado
          </option>

          <option value="refunded">
            Reembolsado
          </option>

          <option value="charged_back">
            Chargeback
          </option>
        </select>
      </div>


      <div className="table-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>
                ID
              </th>

              <th>
                Cliente
              </th>

              <th>
                Produtos
              </th>

              <th>
                Total
              </th>

              <th>
                Status
              </th>

              <th>
                Data
              </th>
            </tr>
          </thead>

          <tbody>
            {orders.map(
              (
                order
              ) => (
                <tr
                  key={
                    order.id
                  }
                >
                  <td>
                    <strong>
                      #{order.id}
                    </strong>
                  </td>

                  <td>
                    <div>
                      {order.userName ||
                        "—"}
                    </div>

                    <small>
                      {order.userEmail}
                    </small>
                  </td>

                  <td>
                    {order.items
                      .slice(
                        0,
                        2
                      )
                      .map(
                        (
                          item:
                            any
                        ) => (
                          <div
                            key={
                              item.id
                            }
                            style={{
                              fontSize:
                                "0.85em",
                            }}
                          >
                            {item.productTitle}{" "}
                            (×
                            {item.quantity})
                          </div>
                        )
                      )}

                    {order.items.length >
                      2 && (
                      <small>
                        +
                        {order.items.length -
                          2}{" "}
                        mais
                      </small>
                    )}
                  </td>

                  <td>
                    <strong>
                      {formatPrice(
                        order.total
                      )}
                    </strong>
                  </td>

                  <td>
                    <span
                      className={`status-badge status-${order.status}`}
                    >
                      {ORDER_STATUS_LABELS[
                        order.status
                      ] ??
                        order.status}
                    </span>
                  </td>

                  <td>
                    {new Date(
                      order.createdAt
                    ).toLocaleDateString(
                      "pt-BR"
                    )}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}