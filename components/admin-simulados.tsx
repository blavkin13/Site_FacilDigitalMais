"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AdminQuestionBank,
  type AdminQuestion,
} from "./admin-question-bank";
import {
  AdminSimulationEditor,
} from "./admin-simulation-editor";

type AdminSimulation = {
  id: number;
  title: string;
  bank: string;
  description: string | null;
  timeLimit: number;
  active: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  productIds: number[];
  questionIds: number[];
  productCount: number;
  questionCount: number;
};

type AdminProduct = {
  id: number;
  title: string;
  shortTitle?: string | null;
  organization?: string | null;
  active: boolean | null;
};

function normalized(
  value:
    string
) {
  return value
    .trim()
    .toLocaleLowerCase(
      "pt-BR"
    );
}

function formatDate(
  value:
    string | null
) {
  if (
    !value
  ) {
    return "—";
  }

  const date =
    new Date(
      value
    );

  return Number.isNaN(
    date.getTime()
  )
    ? "—"
    : date.toLocaleDateString(
        "pt-BR"
      );
}

async function readApiError(
  response:
    Response
) {
  try {
    const data =
      await response.json();

    return (
      data?.error ||
      "A operação não pôde ser concluída."
    );
  } catch {
    return "A operação não pôde ser concluída.";
  }
}

export function AdminSimulados() {
  const [
    activeSection,
    setActiveSection,
  ] =
    useState<
      | "simulations"
      | "questions"
    >(
      "simulations"
    );

  const [
    simulations,
    setSimulations,
  ] =
    useState<
      AdminSimulation[]
    >(
      []
    );

  const [
    products,
    setProducts,
  ] =
    useState<
      AdminProduct[]
    >(
      []
    );

  const [
    questions,
    setQuestions,
  ] =
    useState<
      AdminQuestion[]
    >(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    error,
    setError,
  ] =
    useState(
      ""
    );

  const [
    success,
    setSuccess,
  ] =
    useState(
      ""
    );

  const [
    search,
    setSearch,
  ] =
    useState(
      ""
    );

  const [
    bank,
    setBank,
  ] =
    useState(
      ""
    );

  const [
    status,
    setStatus,
  ] =
    useState(
      ""
    );

  const [
    editorOpen,
    setEditorOpen,
  ] =
    useState(
      false
    );

  const [
    editorSimulation,
    setEditorSimulation,
  ] =
    useState<
      AdminSimulation | null
    >(
      null
    );

  useEffect(
    () => {
      void loadAll();
    },
    []
  );

  async function loadAll() {
    setLoading(
      true
    );

    setError(
      ""
    );

    try {
      const [
        simulationsResponse,
        productsResponse,
        questionsResponse,
      ] =
        await Promise.all([
          fetch(
            "/api/admin/simulations",
            {
              credentials:
                "include",
            }
          ),

          fetch(
            "/api/admin/products",
            {
              credentials:
                "include",
            }
          ),

          fetch(
            "/api/admin/questions",
            {
              credentials:
                "include",
            }
          ),
        ]);

      for (
        const response of
        [
          simulationsResponse,
          productsResponse,
          questionsResponse,
        ]
      ) {
        if (
          !response.ok
        ) {
          throw new Error(
            await readApiError(
              response
            )
          );
        }
      }

      const simulationsData =
        await simulationsResponse.json();

      const productsData =
        await productsResponse.json();

      const questionsData =
        await questionsResponse.json();

      setSimulations(
        simulationsData.simulations ||
          []
      );

      setProducts(
        productsData.products ||
          []
      );

      setQuestions(
        questionsData.questions ||
          []
      );
    } catch (
      loadError
    ) {
      setError(
        loadError instanceof
        Error
          ? loadError.message
          : "Erro ao carregar a administração de simulados."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  async function refreshQuestions() {
    const response =
      await fetch(
        "/api/admin/questions",
        {
          credentials:
            "include",
        }
      );

    if (
      !response.ok
    ) {
      throw new Error(
        await readApiError(
          response
        )
      );
    }

    const data =
      await response.json();

    setQuestions(
      data.questions ||
        []
    );
  }

  function openNewSimulation() {
    setError(
      ""
    );

    setSuccess(
      ""
    );

    setEditorSimulation(
      null
    );

    setEditorOpen(
      true
    );
  }


  function openSimulation(
    simulation:
      AdminSimulation
  ) {
    setError(
      ""
    );

    setSuccess(
      ""
    );

    setEditorSimulation(
      simulation
    );

    setEditorOpen(
      true
    );
  }


  async function handleSimulationSaved(
    message:
      string
  ) {
    setEditorOpen(
      false
    );

    setEditorSimulation(
      null
    );

    setError(
      ""
    );

    setSuccess(
      message
    );

    await loadAll();
  }


  function openQuestionBankFromEditor() {
    setEditorOpen(
      false
    );

    setEditorSimulation(
      null
    );

    setActiveSection(
      "questions"
    );

    setError(
      ""
    );

    setSuccess(
      "Banco de Questões aberto. Após cadastrar a questão, volte ao simulado para adicioná-la."
    );
  }

  const banks =
    useMemo(
      () =>
        Array.from(
          new Set(
            simulations.map(
              (
                item
              ) =>
                item.bank
            )
          )
        ).sort(
          (
            a,
            b
          ) =>
            a.localeCompare(
              b,
              "pt-BR"
            )
        ),
      [
        simulations,
      ]
    );

  const filteredSimulations =
    useMemo(
      () => {
        const term =
          normalized(
            search
          );

        return simulations.filter(
          (
            simulation
          ) => {
            if (
              term &&
              !normalized(
                `${simulation.title} ${simulation.bank} ${simulation.description || ""}`
              ).includes(
                term
              )
            ) {
              return false;
            }

            if (
              bank &&
              simulation.bank !==
                bank
            ) {
              return false;
            }

            if (
              status ===
                "published" &&
              !simulation.active
            ) {
              return false;
            }

            if (
              status ===
                "draft" &&
              simulation.active
            ) {
              return false;
            }

            return true;
          }
        );
      },
      [
        bank,
        search,
        simulations,
        status,
      ]
    );

  const publishedCount =
    simulations.filter(
      (
        item
      ) =>
        item.active
    ).length;

  const activeQuestionsCount =
    questions.filter(
      (
        item
      ) =>
        item.active
    ).length;

  function productNames(
    simulation:
      AdminSimulation
  ) {
    const selected =
      products.filter(
        (
          product
        ) =>
          simulation.productIds.includes(
            product.id
          )
      );

    if (
      selected.length ===
      0
    ) {
      return "Nenhuma apostila relacionada";
    }

    return (
      selected
        .slice(
          0,
          2
        )
        .map(
          (
            product
          ) =>
            product.shortTitle ||
            product.title
        )
        .join(
          " • "
        ) +
      (
        selected.length >
        2
          ? ` +${selected.length - 2}`
          : ""
      )
    );
  }

  if (
    loading
  ) {
    return (
      <div className="admin-sim-loading">
        Carregando administração de simulados...
      </div>
    );
  }

  return (
    <div className="admin-sim-root">
      <header className="admin-sim-toolbar">
        <div>
          <span className="admin-section-kicker">
            Conteúdo avaliativo
          </span>

          <h2>
            Simulados e banco de questões
          </h2>

          <p>
            Gerencie as provas, as questões e os vínculos comerciais com as apostilas.
          </p>
        </div>

        {activeSection ===
          "simulations" && (
          <button
            type="button"
            className="button button-primary"
            onClick={
              openNewSimulation
            }
          >
            + Novo simulado
          </button>
        )}
      </header>

      {error && (
        <div className="admin-sim-alert admin-sim-alert-error">
          <strong>
            Não foi possível concluir a operação.
          </strong>

          <span>
            {error}
          </span>
        </div>
      )}

      {success && (
        <div className="admin-sim-alert admin-sim-alert-success">
          <strong>
            Operação concluída.
          </strong>

          <span>
            {success}
          </span>
        </div>
      )}

      <div className="admin-sim-summary">
        <article>
          <small>
            SIMULADOS
          </small>

          <strong>
            {simulations.length}
          </strong>

          <span>
            total cadastrado
          </span>
        </article>

        <article>
          <small>
            PUBLICADOS
          </small>

          <strong>
            {publishedCount}
          </strong>

          <span>
            disponíveis aos elegíveis
          </span>
        </article>

        <article>
          <small>
            RASCUNHOS
          </small>

          <strong>
            {simulations.length -
              publishedCount}
          </strong>

          <span>
            ainda não publicados
          </span>
        </article>

        <article>
          <small>
            QUESTÕES ATIVAS
          </small>

          <strong>
            {activeQuestionsCount}
          </strong>

          <span>
            no banco de questões
          </span>
        </article>
      </div>

      <nav
        className="admin-sim-tabs"
        aria-label="Áreas de simulados"
      >
        <button
          type="button"
          className={
            activeSection ===
            "simulations"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveSection(
              "simulations"
            )
          }
        >
          📝 Simulados

          <span>
            {simulations.length}
          </span>
        </button>

        <button
          type="button"
          className={
            activeSection ===
            "questions"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveSection(
              "questions"
            )
          }
        >
          🧠 Banco de Questões

          <span>
            {questions.length}
          </span>
        </button>
      </nav>

      {activeSection ===
      "questions" ? (
        <AdminQuestionBank
          questions={
            questions
          }
          busy={
            loading
          }
          onRefresh={
            refreshQuestions
          }
          onError={
            setError
          }
          onSuccess={
            (
              message
            ) => {
              setError(
                ""
              );

              setSuccess(
                message
              );
            }
          }
        />
      ) : (
        <section className="admin-sim-panel">
          <div className="admin-sim-filters">
            <label className="admin-sim-search">
              <span>
                Buscar
              </span>

              <input
                type="search"
                value={
                  search
                }
                onChange={
                  (
                    event
                  ) =>
                    setSearch(
                      event
                        .target
                        .value
                    )
                }
                placeholder="Título, banca ou descrição"
              />
            </label>

            <label>
              <span>
                Banca
              </span>

              <select
                value={
                  bank
                }
                onChange={
                  (
                    event
                  ) =>
                    setBank(
                      event
                        .target
                        .value
                    )
                }
              >
                <option value="">
                  Todas
                </option>

                {banks.map(
                  (
                    item
                  ) => (
                    <option
                      key={
                        item
                      }
                      value={
                        item
                      }
                    >
                      {item}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              <span>
                Status
              </span>

              <select
                value={
                  status
                }
                onChange={
                  (
                    event
                  ) =>
                    setStatus(
                      event
                        .target
                        .value
                    )
                }
              >
                <option value="">
                  Todos
                </option>

                <option value="published">
                  Publicados
                </option>

                <option value="draft">
                  Rascunhos
                </option>
              </select>
            </label>
          </div>

          {filteredSimulations.length ===
          0 ? (
            <div className="admin-sim-empty">
              <span>
                📝
              </span>

              <h3>
                Nenhum simulado encontrado
              </h3>

              <p>
                Ajuste os filtros ou crie um novo simulado.
              </p>

              <button
                type="button"
                className="button button-primary"
                onClick={
                  openNewSimulation
                }
              >
                + Novo simulado
              </button>
            </div>
          ) : (
            <div className="admin-sim-list">
              {filteredSimulations.map(
                (
                  simulation
                ) => (
                  <article
                    key={
                      simulation.id
                    }
                    className="admin-sim-card"
                  >
                    <header>
                      <div>
                        <span className="admin-sim-bank">
                          {simulation.bank}
                        </span>

                        <span
                          className={`admin-sim-status ${
                            simulation.active
                              ? "published"
                              : "draft"
                          }`}
                        >
                          {simulation.active
                            ? "Publicado"
                            : "Rascunho"}
                        </span>
                      </div>

                      <small>
                        #{simulation.id}
                      </small>
                    </header>

                    <h3>
                      {simulation.title}
                    </h3>

                    <p>
                      {simulation.description ||
                        "Sem descrição cadastrada."}
                    </p>

                    <div className="admin-sim-card-metrics">
                      <span>
                        ⏱️{" "}
                        <b>
                          {simulation.timeLimit}
                        </b>{" "}
                        min
                      </span>

                      <span>
                        🧠{" "}
                        <b>
                          {simulation.questionCount}
                        </b>{" "}
                        questões
                      </span>

                      <span>
                        📚{" "}
                        <b>
                          {simulation.productCount}
                        </b>{" "}
                        apostilas
                      </span>
                    </div>

                    <div className="admin-sim-products-line">
                      {productNames(
                        simulation
                      )}
                    </div>

                    <footer>
                      <div>
                        <small>
                          Primeira publicação:{" "}
                          {formatDate(
                            simulation.publishedAt
                          )}
                        </small>

                        <small>
                          Atualização:{" "}
                          {formatDate(
                            simulation.updatedAt ||
                              simulation.createdAt
                          )}
                        </small>
                      </div>

                      <button
                        type="button"
                        className="button button-primary"
                        onClick={() =>
                          openSimulation(
                            simulation
                          )
                        }
                      >
                        Editar
                      </button>
                    </footer>
                  </article>
                )
              )}
            </div>
          )}
        </section>
      )}

      {editorOpen && (
        <AdminSimulationEditor
          key={
            editorSimulation
              ? `simulation-${editorSimulation.id}`
              : "new-simulation"
          }
          simulation={
            editorSimulation
          }
          products={
            products
          }
          questions={
            questions
          }
          onClose={() => {
            setEditorOpen(
              false
            );

            setEditorSimulation(
              null
            );
          }}
          onSaved={
            handleSimulationSaved
          }
          onOpenQuestionBank={
            openQuestionBankFromEditor
          }
          onError={
            setError
          }
        />
      )}
    </div>
  );
}