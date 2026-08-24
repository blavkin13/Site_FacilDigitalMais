"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  getSimulationPublicationIssues,
} from "../lib/simulation-publication";

import type {
  AdminQuestion,
  Difficulty,
} from "./admin-question-bank";


type AdminSimulation = {
  id:
    number;

  title:
    string;

  bank:
    string;

  description:
    string | null;

  timeLimit:
    number;

  active:
    boolean;

  publishedAt:
    string | null;

  createdAt:
    string;

  updatedAt:
    string | null;

  productIds:
    number[];

  questionIds:
    number[];

  productCount:
    number;

  questionCount:
    number;
};


type AdminProduct = {
  id:
    number;

  title:
    string;

  shortTitle?:
    string | null;

  organization?:
    string | null;

  active:
    boolean | null;
};


type Props = {
  simulation:
    AdminSimulation | null;

  products:
    AdminProduct[];

  questions:
    AdminQuestion[];

  onClose:
    () => void;

  onSaved:
    (
      message:
        string
    ) =>
      Promise<void> |
      void;

  onOpenQuestionBank:
    () => void;

  onError:
    (
      message:
        string
    ) => void;
};


type EditorSection =
  | "details"
  | "products"
  | "questions"
  | "preview"
  | "publication";


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


function difficultyLabel(
  value:
    Difficulty | null
) {
  if (
    value ===
    "easy"
  ) {
    return "Fácil";
  }

  if (
    value ===
    "hard"
  ) {
    return "Difícil";
  }

  return "Média";
}


async function readApiError(
  response:
    Response
) {
  try {
    const data =
      await response.json();

    const issues =
      Array.isArray(
        data?.issues
      )
        ? data.issues
            .map(
              (
                issue:
                  unknown
              ) => {
                if (
                  typeof issue ===
                    "object" &&
                  issue !==
                    null &&
                  "message" in
                    issue &&
                  typeof (
                    issue as {
                      message?:
                        unknown;
                    }
                  ).message ===
                    "string"
                ) {
                  return (
                    issue as {
                      message:
                        string;
                    }
                  ).message;
                }

                return null;
              }
            )
            .filter(
              Boolean
            )
            .join(
              " "
            )
        : "";

    return [
      data?.error ||
        "A operação não pôde ser concluída.",

      issues,
    ]
      .filter(
        Boolean
      )
      .join(
        " "
      );
  } catch {
    return "A operação não pôde ser concluída.";
  }
}


export function AdminSimulationEditor({
  simulation,
  products,
  questions,
  onClose,
  onSaved,
  onOpenQuestionBank,
  onError,
}: Props) {
  const [
    section,
    setSection,
  ] =
    useState<EditorSection>(
      "details"
    );

  const [
    workingId,
    setWorkingId,
  ] =
    useState<
      number | null
    >(
      simulation?.id ??
        null
    );

  const [
    isPublished,
    setIsPublished,
  ] =
    useState(
      simulation?.active ===
      true
    );

  const [
    title,
    setTitle,
  ] =
    useState(
      simulation?.title ??
        ""
    );

  const [
    bank,
    setBank,
  ] =
    useState(
      simulation?.bank ??
        "Cesgranrio"
    );

  const [
    description,
    setDescription,
  ] =
    useState(
      simulation?.description ??
        ""
    );

  const [
    timeLimit,
    setTimeLimit,
  ] =
    useState(
      simulation?.timeLimit ??
        60
    );

  const [
    selectedProductIds,
    setSelectedProductIds,
  ] =
    useState<number[]>(
      simulation
        ? [
            ...simulation.productIds,
          ]
        : []
    );

  const [
    selectedQuestionIds,
    setSelectedQuestionIds,
  ] =
    useState<number[]>(
      simulation
        ? [
            ...simulation.questionIds,
          ]
        : []
    );

  const [
    saving,
    setSaving,
  ] =
    useState(
      false
    );

  const [
    questionSearch,
    setQuestionSearch,
  ] =
    useState(
      ""
    );

  const [
    questionBank,
    setQuestionBank,
  ] =
    useState(
      ""
    );

  const [
    questionSubject,
    setQuestionSubject,
  ] =
    useState(
      ""
    );

  const [
    questionDifficulty,
    setQuestionDifficulty,
  ] =
    useState(
      ""
    );

  const [
    productSearch,
    setProductSearch,
  ] =
    useState(
      ""
    );


  const questionsById =
    useMemo(
      () =>
        new Map(
          questions.map(
            (
              question
            ) => [
              question.id,
              question,
            ]
          )
        ),
      [
        questions,
      ]
    );


  const selectedQuestions =
    useMemo(
      () =>
        selectedQuestionIds
          .map(
            (
              id
            ) =>
              questionsById.get(
                id
              )
          )
          .filter(
            (
              question
            ):
              question is
              AdminQuestion =>
                Boolean(
                  question
                )
          ),
      [
        questionsById,
        selectedQuestionIds,
      ]
    );


  const questionBanks =
    useMemo(
      () =>
        Array.from(
          new Set(
            questions.map(
              (
                question
              ) =>
                question.bank
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
        questions,
      ]
    );


  const questionSubjects =
    useMemo(
      () =>
        Array.from(
          new Set(
            questions.map(
              (
                question
              ) =>
                question.subject
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
        questions,
      ]
    );


  const availableQuestions =
    useMemo(
      () => {
        const search =
          normalized(
            questionSearch
          );

        return questions.filter(
          (
            question
          ) => {
            if (
              !question.active
            ) {
              return false;
            }

            if (
              selectedQuestionIds.includes(
                question.id
              )
            ) {
              return false;
            }

            if (
              search &&
              !normalized(
                `${question.questionText} ${question.subject} ${question.bank}`
              ).includes(
                search
              )
            ) {
              return false;
            }

            if (
              questionBank &&
              question.bank !==
                questionBank
            ) {
              return false;
            }

            if (
              questionSubject &&
              question.subject !==
                questionSubject
            ) {
              return false;
            }

            if (
              questionDifficulty &&
              question.difficulty !==
                questionDifficulty
            ) {
              return false;
            }

            return true;
          }
        );
      },
      [
        questionBank,
        questionDifficulty,
        questionSearch,
        questionSubject,
        questions,
        selectedQuestionIds,
      ]
    );


  const filteredProducts =
    useMemo(
      () => {
        const search =
          normalized(
            productSearch
          );

        if (
          !search
        ) {
          return products;
        }

        return products.filter(
          (
            product
          ) =>
            normalized(
              [
                product.title,
                product.shortTitle ||
                  "",
                product.organization ||
                  "",
              ].join(
                " "
              )
            ).includes(
              search
            )
        );
      },
      [
        productSearch,
        products,
      ]
    );


  const publicationIssues =
    useMemo(
      () => {
        const existingQuestions =
          selectedQuestionIds
            .map(
              (
                id
              ) =>
                questionsById.get(
                  id
                )
            )
            .filter(
              (
                question
              ):
                question is
                AdminQuestion =>
                  Boolean(
                    question
                  )
            )
            .map(
              (
                question
              ) => ({
                id:
                  question.id,

                active:
                  question.active,
              })
            );

        return getSimulationPublicationIssues({
          simulation: {
            title,
            bank,
            timeLimit,
          },

          productIds:
            selectedProductIds,

          questionIds:
            selectedQuestionIds,

          questions:
            existingQuestions,
        });
      },
      [
        bank,
        questionsById,
        selectedProductIds,
        selectedQuestionIds,
        timeLimit,
        title,
      ]
    );


  const publicationIssueFields =
    useMemo(
      () =>
        new Set(
          publicationIssues.map(
            (
              issue
            ) =>
              issue.field
          )
        ),
      [
        publicationIssues,
      ]
    );


  const readyForPublication =
    publicationIssues.length ===
    0;


  const basicFieldsValid =
    Boolean(
      title.trim() &&
      bank.trim() &&
      Number.isInteger(
        timeLimit
      ) &&
      timeLimit >
        0 &&
      timeLimit <=
        1440
    );


  function toggleProduct(
    productId:
      number
  ) {
    setSelectedProductIds(
      (
        current
      ) =>
        current.includes(
          productId
        )
          ? current.filter(
              (
                id
              ) =>
                id !==
                productId
            )
          : [
              ...current,
              productId,
            ]
    );
  }


  function addQuestion(
    questionId:
      number
  ) {
    setSelectedQuestionIds(
      (
        current
      ) =>
        current.includes(
          questionId
        )
          ? current
          : [
              ...current,
              questionId,
            ]
    );
  }


  function removeQuestion(
    questionId:
      number
  ) {
    setSelectedQuestionIds(
      (
        current
      ) =>
        current.filter(
          (
            id
          ) =>
            id !==
            questionId
        )
    );
  }


  function moveQuestion(
    index:
      number,
    direction:
      -1 | 1
  ) {
    setSelectedQuestionIds(
      (
        current
      ) => {
        const targetIndex =
          index +
          direction;

        if (
          targetIndex <
            0 ||
          targetIndex >=
            current.length
        ) {
          return current;
        }

        const next = [
          ...current,
        ];

        const temporary =
          next[
            index
          ];

        next[
          index
        ] =
          next[
            targetIndex
          ];

        next[
          targetIndex
        ] =
          temporary;

        return next;
      }
    );
  }


  async function persistBaseSimulation() {
    const payload = {
      title:
        title.trim(),

      bank:
        bank.trim(),

      description:
        description.trim(),

      timeLimit,
    };


    if (
      workingId ===
      null
    ) {
      const response =
        await fetch(
          "/api/admin/simulations",
          {
            method:
              "POST",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                payload
              ),
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

      const createdId =
        Number(
          data
            ?.simulation
            ?.id
        );


      if (
        !Number.isInteger(
          createdId
        ) ||
        createdId <=
          0
      ) {
        throw new Error(
          "O servidor não retornou o ID do novo simulado."
        );
      }


      setWorkingId(
        createdId
      );

      return createdId;
    }


    const response =
      await fetch(
        "/api/admin/simulations",
        {
          method:
            "PATCH",

          credentials:
            "include",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              id:
                workingId,

              ...payload,
            }),
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


    return workingId;
  }


  async function persistRelations(
    simulationId:
      number
  ) {
    const productResponse =
      await fetch(
        `/api/admin/simulations/${simulationId}/products`,
        {
          method:
            "PUT",

          credentials:
            "include",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              productIds:
                selectedProductIds,
            }),
        }
      );


    if (
      !productResponse.ok
    ) {
      throw new Error(
        await readApiError(
          productResponse
        )
      );
    }


    const questionResponse =
      await fetch(
        `/api/admin/simulations/${simulationId}/questions`,
        {
          method:
            "PUT",

          credentials:
            "include",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              questionIds:
                selectedQuestionIds,
            }),
        }
      );


    if (
      !questionResponse.ok
    ) {
      throw new Error(
        await readApiError(
          questionResponse
        )
      );
    }
  }


  async function persistEditorState() {
    const simulationId =
      await persistBaseSimulation();

    await persistRelations(
      simulationId
    );

    return simulationId;
  }


  async function saveDraftOrChanges() {
    if (
      !basicFieldsValid
    ) {
      onError(
        "Preencha título, banca e um tempo válido antes de salvar."
      );

      setSection(
        "details"
      );

      return;
    }


    onError(
      ""
    );

    setSaving(
      true
    );


    try {
      await persistEditorState();

      await onSaved(
        isPublished
          ? "Alterações do simulado publicadas com sucesso."
          : "Rascunho do simulado salvo com sucesso."
      );
    } catch (
      error
    ) {
      onError(
        error instanceof
        Error
          ? error.message
          : "Erro ao salvar simulado."
      );
    } finally {
      setSaving(
        false
      );
    }
  }


  async function publishSimulation() {
    if (
      !readyForPublication
    ) {
      onError(
        "Resolva as pendências do checklist antes de publicar."
      );

      setSection(
        "publication"
      );

      return;
    }


    onError(
      ""
    );

    setSaving(
      true
    );


    try {
      const simulationId =
        await persistEditorState();


      const response =
        await fetch(
          "/api/admin/simulations",
          {
            method:
              "PATCH",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                id:
                  simulationId,

                active:
                  true,
              }),
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


      setIsPublished(
        true
      );


      await onSaved(
        "Simulado publicado com sucesso."
      );
    } catch (
      error
    ) {
      onError(
        error instanceof
        Error
          ? error.message
          : "Erro ao publicar simulado."
      );
    } finally {
      setSaving(
        false
      );
    }
  }


  async function unpublishSimulation() {
    if (
      workingId ===
      null
    ) {
      return;
    }


    if (
      !window.confirm(
        "Despublicar este simulado? Alunos deixarão de iniciar novas tentativas."
      )
    ) {
      return;
    }


    onError(
      ""
    );

    setSaving(
      true
    );


    try {
      const response =
        await fetch(
          "/api/admin/simulations",
          {
            method:
              "PATCH",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                id:
                  workingId,

                active:
                  false,
              }),
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


      setIsPublished(
        false
      );


      await onSaved(
        "Simulado despublicado e mantido como rascunho."
      );
    } catch (
      error
    ) {
      onError(
        error instanceof
        Error
          ? error.message
          : "Erro ao despublicar simulado."
      );
    } finally {
      setSaving(
        false
      );
    }
  }


  return (
    <div
      className="admin-sim-modal-backdrop"
      role="presentation"
      onMouseDown={
        (
          event
        ) => {
          if (
            event.target ===
              event.currentTarget &&
            !saving
          ) {
            onClose();
          }
        }
      }
    >
      <section
        className="admin-sim-modal admin-simulation-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-simulation-editor-title"
      >
        <header className="admin-sim-modal-header admin-simulation-editor-header">
          <div>
            <span className="admin-section-kicker">
              {workingId ===
              null
                ? "Novo simulado"
                : `Simulado #${workingId}`}
            </span>

            <h2 id="admin-simulation-editor-title">
              {workingId ===
              null
                ? "Criar simulado"
                : "Editar simulado"}
            </h2>

            <div className="admin-simulation-editor-statusline">
              <span
                className={`admin-sim-status ${
                  isPublished
                    ? "published"
                    : "draft"
                }`}
              >
                {isPublished
                  ? "Publicado"
                  : "Rascunho"}
              </span>

              <span>
                {selectedQuestionIds.length} questão(ões)
              </span>

              <span>
                {selectedProductIds.length} apostila(s)
              </span>
            </div>
          </div>

          <button
            type="button"
            className="admin-sim-close"
            onClick={
              onClose
            }
            disabled={
              saving
            }
            aria-label="Fechar editor"
          >
            ×
          </button>
        </header>


        <nav className="admin-simulation-editor-nav">
          <button
            type="button"
            className={
              section ===
              "details"
                ? "active"
                : ""
            }
            onClick={() =>
              setSection(
                "details"
              )
            }
          >
            1. Identificação
          </button>

          <button
            type="button"
            className={
              section ===
              "products"
                ? "active"
                : ""
            }
            onClick={() =>
              setSection(
                "products"
              )
            }
          >
            2. Apostilas
          </button>

          <button
            type="button"
            className={
              section ===
              "questions"
                ? "active"
                : ""
            }
            onClick={() =>
              setSection(
                "questions"
              )
            }
          >
            3. Montador
          </button>

          <button
            type="button"
            className={
              section ===
              "preview"
                ? "active"
                : ""
            }
            onClick={() =>
              setSection(
                "preview"
              )
            }
          >
            4. Prévia
          </button>

          <button
            type="button"
            className={
              section ===
              "publication"
                ? "active"
                : ""
            }
            onClick={() =>
              setSection(
                "publication"
              )
            }
          >
            5. Publicação

            {publicationIssues.length >
            0 && (
              <span>
                {
                  publicationIssues.length
                }
              </span>
            )}
          </button>
        </nav>


        <div className="admin-sim-modal-body admin-simulation-editor-body">
          {section ===
            "details" && (
            <section className="admin-simulation-editor-section">
              <header>
                <span>
                  01
                </span>

                <div>
                  <h3>
                    Identificação do simulado
                  </h3>

                  <p>
                    Configure os dados exibidos ao aluno antes do início da prova.
                  </p>
                </div>
              </header>

              <div className="admin-sim-form-grid">
                <label className="span-2">
                  <span>
                    Título
                  </span>

                  <input
                    type="text"
                    value={
                      title
                    }
                    onChange={
                      (
                        event
                      ) =>
                        setTitle(
                          event
                            .target
                            .value
                        )
                    }
                    maxLength={
                      200
                    }
                    required
                    placeholder="Ex.: Transpetro — Simulado 01"
                  />
                </label>

                <label>
                  <span>
                    Banca
                  </span>

                  <input
                    type="text"
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
                    maxLength={
                      120
                    }
                    required
                    placeholder="Cesgranrio"
                  />
                </label>

                <label>
                  <span>
                    Tempo de prova
                  </span>

                  <div className="admin-simulation-time-field">
                    <input
                      type="number"
                      min={
                        1
                      }
                      max={
                        1440
                      }
                      step={
                        1
                      }
                      value={
                        timeLimit
                      }
                      onChange={
                        (
                          event
                        ) =>
                          setTimeLimit(
                            Number(
                              event
                                .target
                                .value
                            )
                          )
                      }
                    />

                    <span>
                      minutos
                    </span>
                  </div>
                </label>

                <label className="span-2">
                  <span>
                    Descrição
                  </span>

                  <textarea
                    value={
                      description
                    }
                    onChange={
                      (
                        event
                      ) =>
                        setDescription(
                          event
                            .target
                            .value
                        )
                    }
                    rows={
                      6
                    }
                    maxLength={
                      5000
                    }
                    placeholder="Explique o objetivo e o conteúdo do simulado."
                  />
                </label>
              </div>

              <div className="admin-simulation-section-tip">
                <strong>
                  Dica
                </strong>

                <span>
                  Novos simulados são criados sempre como rascunho. A publicação só ocorre depois que apostilas e questões válidas forem vinculadas.
                </span>
              </div>
            </section>
          )}


          {section ===
            "products" && (
            <section className="admin-simulation-editor-section">
              <header>
                <span>
                  02
                </span>

                <div>
                  <h3>
                    Apostilas que liberam este simulado
                  </h3>

                  <p>
                    O aluno precisa possuir uma compra aprovada de pelo menos uma das apostilas selecionadas.
                  </p>
                </div>
              </header>

              <label className="admin-simulation-product-search">
                <span>
                  Buscar apostila
                </span>

                <input
                  type="search"
                  value={
                    productSearch
                  }
                  onChange={
                    (
                      event
                    ) =>
                      setProductSearch(
                        event
                          .target
                          .value
                      )
                  }
                  placeholder="Título, cargo ou órgão"
                />
              </label>

              <div className="admin-simulation-product-summary">
                <strong>
                  {
                    selectedProductIds.length
                  }
                </strong>

                <span>
                  apostila(s) selecionada(s)
                </span>
              </div>

              {filteredProducts.length ===
              0 ? (
                <div className="admin-sim-empty">
                  <span>
                    📚
                  </span>

                  <h3>
                    Nenhuma apostila encontrada
                  </h3>
                </div>
              ) : (
                <div className="admin-simulation-product-list">
                  {filteredProducts.map(
                    (
                      product
                    ) => {
                      const checked =
                        selectedProductIds.includes(
                          product.id
                        );

                      return (
                        <label
                          key={
                            product.id
                          }
                          className={`admin-simulation-product-option ${
                            checked
                              ? "selected"
                              : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={
                              checked
                            }
                            onChange={() =>
                              toggleProduct(
                                product.id
                              )
                            }
                          />

                          <span className="admin-simulation-product-check">
                            {checked
                              ? "✓"
                              : ""}
                          </span>

                          <span className="admin-simulation-product-copy">
                            <strong>
                              {product.shortTitle ||
                                product.title}
                            </strong>

                            <span>
                              {product.organization ||
                                "Sem órgão informado"}
                            </span>
                          </span>

                          <span
                            className={`admin-sim-status ${
                              product.active
                                ? "published"
                                : "draft"
                            }`}
                          >
                            {product.active
                              ? "Ativa"
                              : "Inativa"}
                          </span>
                        </label>
                      );
                    }
                  )}
                </div>
              )}
            </section>
          )}


          {section ===
            "questions" && (
            <section className="admin-simulation-editor-section admin-simulation-builder-section">
              <header>
                <span>
                  03
                </span>

                <div>
                  <h3>
                    Montador de questões
                  </h3>

                  <p>
                    A ordem abaixo será a ordem oficial apresentada ao aluno.
                  </p>
                </div>
              </header>

              <div className="admin-simulation-builder">
                <div className="admin-simulation-selected-questions">
                  <header>
                    <div>
                      <strong>
                        Questões selecionadas
                      </strong>

                      <span>
                        {
                          selectedQuestionIds.length
                        }{" "}
                        questão(ões)
                      </span>
                    </div>
                  </header>

                  {selectedQuestionIds.length ===
                  0 ? (
                    <div className="admin-simulation-builder-empty">
                      <span>
                        🧩
                      </span>

                      <strong>
                        Simulado vazio
                      </strong>

                      <p>
                        Adicione questões usando o banco ao lado.
                      </p>
                    </div>
                  ) : (
                    <div className="admin-simulation-selected-list">
                      {selectedQuestionIds.map(
                        (
                          questionId,
                          index
                        ) => {
                          const question =
                            questionsById.get(
                              questionId
                            );

                          if (
                            !question
                          ) {
                            return (
                              <article
                                key={
                                  questionId
                                }
                                className="admin-simulation-selected-question missing"
                              >
                                <div className="admin-simulation-question-position">
                                  {
                                    index +
                                    1
                                  }
                                </div>

                                <div>
                                  <strong>
                                    Questão #{questionId} não encontrada
                                  </strong>

                                  <span>
                                    Remova esta referência antes de publicar.
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    removeQuestion(
                                      questionId
                                    )
                                  }
                                >
                                  Remover
                                </button>
                              </article>
                            );
                          }

                          return (
                            <article
                              key={
                                question.id
                              }
                              className={`admin-simulation-selected-question ${
                                question.active
                                  ? ""
                                  : "inactive"
                              }`}
                            >
                              <div className="admin-simulation-question-position">
                                {
                                  index +
                                  1
                                }
                              </div>

                              <div className="admin-simulation-selected-question-copy">
                                <div>
                                  <span>
                                    #{question.id}
                                  </span>

                                  <span>
                                    {question.subject}
                                  </span>

                                  <span>
                                    {question.bank}
                                  </span>

                                  {!question.active && (
                                    <span className="danger">
                                      Arquivada
                                    </span>
                                  )}
                                </div>

                                <strong>
                                  {question.questionText}
                                </strong>
                              </div>

                              <div className="admin-simulation-question-actions">
                                <button
                                  type="button"
                                  onClick={() =>
                                    moveQuestion(
                                      index,
                                      -1
                                    )
                                  }
                                  disabled={
                                    index ===
                                    0
                                  }
                                  aria-label="Mover questão para cima"
                                >
                                  ↑
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    moveQuestion(
                                      index,
                                      1
                                    )
                                  }
                                  disabled={
                                    index ===
                                    selectedQuestionIds.length -
                                      1
                                  }
                                  aria-label="Mover questão para baixo"
                                >
                                  ↓
                                </button>

                                <button
                                  type="button"
                                  className="remove"
                                  onClick={() =>
                                    removeQuestion(
                                      question.id
                                    )
                                  }
                                >
                                  Remover
                                </button>
                              </div>
                            </article>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>


                <aside className="admin-simulation-question-bank">
                  <header>
                    <div>
                      <strong>
                        Banco de questões
                      </strong>

                      <span>
                        {
                          availableQuestions.length
                        }{" "}
                        disponível(is)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={
                        onOpenQuestionBank
                      }
                    >
                      + Criar questão
                    </button>
                  </header>

                  <div className="admin-simulation-question-filters">
                    <input
                      type="search"
                      value={
                        questionSearch
                      }
                      onChange={
                        (
                          event
                        ) =>
                          setQuestionSearch(
                            event
                              .target
                              .value
                          )
                      }
                      placeholder="Pesquisar questão..."
                    />

                    <select
                      value={
                        questionBank
                      }
                      onChange={
                        (
                          event
                        ) =>
                          setQuestionBank(
                            event
                              .target
                              .value
                          )
                      }
                    >
                      <option value="">
                        Todas as bancas
                      </option>

                      {questionBanks.map(
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

                    <select
                      value={
                        questionSubject
                      }
                      onChange={
                        (
                          event
                        ) =>
                          setQuestionSubject(
                            event
                              .target
                              .value
                          )
                      }
                    >
                      <option value="">
                        Todas as matérias
                      </option>

                      {questionSubjects.map(
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

                    <select
                      value={
                        questionDifficulty
                      }
                      onChange={
                        (
                          event
                        ) =>
                          setQuestionDifficulty(
                            event
                              .target
                              .value
                          )
                      }
                    >
                      <option value="">
                        Todas as dificuldades
                      </option>

                      <option value="easy">
                        Fácil
                      </option>

                      <option value="medium">
                        Média
                      </option>

                      <option value="hard">
                        Difícil
                      </option>
                    </select>
                  </div>

                  <div className="admin-simulation-question-bank-list">
                    {availableQuestions.length ===
                    0 ? (
                      <div className="admin-simulation-builder-empty compact">
                        <strong>
                          Nenhuma questão disponível
                        </strong>

                        <p>
                          Todas podem estar selecionadas ou os filtros estão restringindo a busca.
                        </p>
                      </div>
                    ) : (
                      availableQuestions.map(
                        (
                          question
                        ) => (
                          <article
                            key={
                              question.id
                            }
                            className="admin-simulation-bank-question"
                          >
                            <div>
                              <span>
                                #{question.id}
                              </span>

                              <span>
                                {question.subject}
                              </span>

                              <span
                                className={`difficulty-${question.difficulty || "medium"}`}
                              >
                                {difficultyLabel(
                                  question.difficulty
                                )}
                              </span>
                            </div>

                            <strong>
                              {question.questionText}
                            </strong>

                            <button
                              type="button"
                              onClick={() =>
                                addQuestion(
                                  question.id
                                )
                              }
                            >
                              + Adicionar
                            </button>
                          </article>
                        )
                      )
                    )}
                  </div>
                </aside>
              </div>
            </section>
          )}


          {section ===
            "preview" && (
            <section className="admin-simulation-editor-section">
              <header>
                <span>
                  04
                </span>

                <div>
                  <h3>
                    Prévia administrativa
                  </h3>

                  <p>
                    Confira a prova antes de publicar. Esta prévia é exclusiva do administrador.
                  </p>
                </div>
              </header>

              <div className="admin-simulation-preview-header">
                <span>
                  {bank ||
                    "Banca não informada"}
                </span>

                <h3>
                  {title ||
                    "Título do simulado"}
                </h3>

                <p>
                  {description ||
                    "Sem descrição cadastrada."}
                </p>

                <div>
                  <span>
                    ⏱️ {timeLimit || 0} min
                  </span>

                  <span>
                    🧠 {selectedQuestionIds.length} questões
                  </span>

                  <span>
                    📚 {selectedProductIds.length} apostilas
                  </span>
                </div>
              </div>

              {selectedQuestions.length ===
              0 ? (
                <div className="admin-sim-empty">
                  <span>
                    👁️
                  </span>

                  <h3>
                    Nenhuma questão para visualizar
                  </h3>
                </div>
              ) : (
                <div className="admin-simulation-preview-list">
                  {selectedQuestions.map(
                    (
                      question,
                      index
                    ) => (
                      <article
                        key={
                          question.id
                        }
                      >
                        <header>
                          <span>
                            Questão{" "}
                            {
                              index +
                              1
                            }
                          </span>

                          <span>
                            {question.subject}
                          </span>

                          <span>
                            {difficultyLabel(
                              question.difficulty
                            )}
                          </span>
                        </header>

                        <h4>
                          {question.questionText}
                        </h4>

                        <ol>
                          {question.options.map(
                            (
                              option,
                              optionIndex
                            ) => (
                              <li
                                key={
                                  optionIndex
                                }
                                className={
                                  optionIndex ===
                                  question.correctAnswer
                                    ? "correct"
                                    : ""
                                }
                              >
                                <span>
                                  {String.fromCharCode(
                                    65 +
                                      optionIndex
                                  )}
                                </span>

                                <strong>
                                  {option}
                                </strong>

                                {optionIndex ===
                                  question.correctAnswer && (
                                  <small>
                                    Gabarito
                                  </small>
                                )}
                              </li>
                            )
                          )}
                        </ol>

                        {question.explanation && (
                          <div className="admin-simulation-preview-explanation">
                            <strong>
                              Comentário
                            </strong>

                            <p>
                              {question.explanation}
                            </p>
                          </div>
                        )}
                      </article>
                    )
                  )}
                </div>
              )}
            </section>
          )}


          {section ===
            "publication" && (
            <section className="admin-simulation-editor-section">
              <header>
                <span>
                  05
                </span>

                <div>
                  <h3>
                    Checklist de publicação
                  </h3>

                  <p>
                    O backend repetirá todas as validações antes de efetivar a publicação.
                  </p>
                </div>
              </header>

              <div className="admin-simulation-publication-grid">
                {[
                  {
                    field:
                      "title",

                    title:
                      "Título",

                    description:
                      "Título preenchido e válido.",
                  },

                  {
                    field:
                      "bank",

                    title:
                      "Banca",

                    description:
                      "Banca organizadora informada.",
                  },

                  {
                    field:
                      "timeLimit",

                    title:
                      "Tempo de prova",

                    description:
                      "Duração inteira maior que zero.",
                  },

                  {
                    field:
                      "products",

                    title:
                      "Apostila relacionada",

                    description:
                      "Pelo menos uma apostila libera este simulado.",
                  },

                  {
                    field:
                      "questions",

                    title:
                      "Questões",

                    description:
                      "A prova possui questões existentes e ativas.",
                  },
                ].map(
                  (
                    item
                  ) => {
                    const invalid =
                      publicationIssueFields.has(
                        item.field as
                          | "title"
                          | "bank"
                          | "timeLimit"
                          | "products"
                          | "questions"
                      );

                    return (
                      <article
                        key={
                          item.field
                        }
                        className={
                          invalid
                            ? "pending"
                            : "ready"
                        }
                      >
                        <span>
                          {invalid
                            ? "○"
                            : "✓"}
                        </span>

                        <div>
                          <strong>
                            {item.title}
                          </strong>

                          <p>
                            {item.description}
                          </p>
                        </div>
                      </article>
                    );
                  }
                )}
              </div>

              {publicationIssues.length >
              0 ? (
                <div className="admin-simulation-publication-issues">
                  <strong>
                    {publicationIssues.length} pendência(s)
                  </strong>

                  {publicationIssues.map(
                    (
                      issue,
                      index
                    ) => (
                      <p
                        key={`${issue.field}-${index}`}
                      >
                        {issue.message}
                      </p>
                    )
                  )}
                </div>
              ) : (
                <div className="admin-simulation-publication-ready">
                  <span>
                    ✓
                  </span>

                  <div>
                    <strong>
                      Pronto para publicar
                    </strong>

                    <p>
                      O simulado atende aos requisitos editoriais atuais.
                    </p>
                  </div>
                </div>
              )}

              <div className="admin-simulation-entitlement-note">
                <strong>
                  Regra comercial
                </strong>

                <p>
                  Publicar o simulado não o torna público para qualquer usuário. O acesso continua condicionado a login e pedido aprovado de uma das apostilas relacionadas.
                </p>
              </div>
            </section>
          )}
        </div>


        <footer className="admin-sim-modal-footer admin-simulation-editor-footer">
          <div>
            {isPublished &&
              workingId !==
                null && (
              <button
                type="button"
                className="button button-danger-outline"
                onClick={() =>
                  void unpublishSimulation()
                }
                disabled={
                  saving
                }
              >
                Despublicar
              </button>
            )}
          </div>

          <div>
            <button
              type="button"
              className="button button-ghost"
              onClick={
                onClose
              }
              disabled={
                saving
              }
            >
              Cancelar
            </button>

            <button
              type="button"
              className="button button-secondary"
              onClick={() =>
                void saveDraftOrChanges()
              }
              disabled={
                saving ||
                !basicFieldsValid
              }
            >
              {saving
                ? "Salvando..."
                : isPublished
                  ? "Salvar alterações"
                  : "Salvar rascunho"}
            </button>

            {!isPublished && (
              <button
                type="button"
                className="button button-primary"
                onClick={() =>
                  void publishSimulation()
                }
                disabled={
                  saving ||
                  !readyForPublication
                }
              >
                {saving
                  ? "Publicando..."
                  : "Publicar simulado"}
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}