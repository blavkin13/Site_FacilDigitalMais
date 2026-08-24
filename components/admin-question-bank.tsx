"use client";

import { useMemo, useState, type FormEvent } from "react";

export type Difficulty = "easy" | "medium" | "hard";

export type AdminQuestion = {
  id: number;
  bank: string;
  subject: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  explanation: string | null;
  difficulty: Difficulty | null;
  active: boolean;
  createdAt: string;
  updatedAt: string | null;
};

type Props = {
  questions: AdminQuestion[];
  busy: boolean;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
};

type QuestionForm = {
  id: number | null;
  bank: string;
  subject: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: Difficulty;
  active: boolean;
};

const EMPTY_FORM: QuestionForm = {
  id: null,
  bank: "Cesgranrio",
  subject: "",
  questionText: "",
  options: ["", "", "", ""],
  correctAnswer: 0,
  explanation: "",
  difficulty: "medium",
  active: true,
};

async function readApiError(response: Response) {
  try {
    const data = await response.json();

    const ids = Array.isArray(data?.simulationIds)
      ? ` Simulado(s): ${data.simulationIds.join(", ")}.`
      : "";

    return `${
      data?.error ||
      "A operação não pôde ser concluída."
    }${ids}`;
  } catch {
    return "A operação não pôde ser concluída.";
  }
}

function difficultyLabel(
  value: Difficulty | null
) {
  if (value === "easy") {
    return "Fácil";
  }

  if (value === "hard") {
    return "Difícil";
  }

  return "Média";
}

function normalized(
  value: string
) {
  return value
    .trim()
    .toLocaleLowerCase(
      "pt-BR"
    );
}

export function AdminQuestionBank({
  questions,
  busy,
  onRefresh,
  onError,
  onSuccess,
}: Props) {
  const [
    search,
    setSearch,
  ] = useState("");

  const [
    bank,
    setBank,
  ] = useState("");

  const [
    subject,
    setSubject,
  ] = useState("");

  const [
    difficulty,
    setDifficulty,
  ] = useState("");

  const [
    status,
    setStatus,
  ] = useState(
    "active"
  );

  const [
    modalOpen,
    setModalOpen,
  ] = useState(
    false
  );

  const [
    saving,
    setSaving,
  ] = useState(
    false
  );

  const [
    form,
    setForm,
  ] =
    useState<QuestionForm>(
      EMPTY_FORM
    );

  const banks =
    useMemo(
      () =>
        Array.from(
          new Set(
            questions.map(
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
        questions,
      ]
    );

  const subjects =
    useMemo(
      () =>
        Array.from(
          new Set(
            questions.map(
              (
                item
              ) =>
                item.subject
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

  const filtered =
    useMemo(
      () => {
        const term =
          normalized(
            search
          );

        return questions.filter(
          (
            question
          ) => {
            if (
              term &&
              !normalized(
                `${question.questionText} ${question.subject} ${question.bank}`
              ).includes(
                term
              )
            ) {
              return false;
            }

            if (
              bank &&
              question.bank !==
                bank
            ) {
              return false;
            }

            if (
              subject &&
              question.subject !==
                subject
            ) {
              return false;
            }

            if (
              difficulty &&
              question.difficulty !==
                difficulty
            ) {
              return false;
            }

            if (
              status ===
                "active" &&
              !question.active
            ) {
              return false;
            }

            if (
              status ===
                "archived" &&
              question.active
            ) {
              return false;
            }

            return true;
          }
        );
      },
      [
        bank,
        difficulty,
        questions,
        search,
        status,
        subject,
      ]
    );

  function openNew() {
    setForm({
      ...EMPTY_FORM,

      options: [
        ...EMPTY_FORM.options,
      ],
    });

    setModalOpen(
      true
    );
  }

  function openEdit(
    question:
      AdminQuestion
  ) {
    setForm({
      id:
        question.id,

      bank:
        question.bank,

      subject:
        question.subject,

      questionText:
        question.questionText,

      options: [
        ...question.options,
      ],

      correctAnswer:
        question.correctAnswer,

      explanation:
        question.explanation ||
        "",

      difficulty:
        question.difficulty ||
        "medium",

      active:
        question.active,
    });

    setModalOpen(
      true
    );
  }

  function updateOption(
    index:
      number,
    value:
      string
  ) {
    setForm(
      (
        current
      ) => {
        const options = [
          ...current.options,
        ];

        options[
          index
        ] =
          value;

        return {
          ...current,
          options,
        };
      }
    );
  }

  function addOption() {
    setForm(
      (
        current
      ) =>
        current.options.length >=
        5
          ? current
          : {
              ...current,

              options: [
                ...current.options,
                "",
              ],
            }
    );
  }

  function removeOption(
    index:
      number
  ) {
    setForm(
      (
        current
      ) => {
        if (
          current.options.length <=
          2
        ) {
          return current;
        }

        const options =
          current.options.filter(
            (
              _,
              optionIndex
            ) =>
              optionIndex !==
              index
          );

        let correctAnswer =
          current.correctAnswer;

        if (
          index ===
          correctAnswer
        ) {
          correctAnswer =
            0;
        } else if (
          index <
          correctAnswer
        ) {
          correctAnswer -=
            1;
        }

        return {
          ...current,
          options,
          correctAnswer,
        };
      }
    );
  }

  async function saveQuestion(
    event:
      FormEvent
  ) {
    event.preventDefault();

    onError(
      ""
    );

    if (
      form.options.some(
        (
          option
        ) =>
          !option.trim()
      )
    ) {
      onError(
        "Todas as alternativas precisam estar preenchidas."
      );

      return;
    }

    setSaving(
      true
    );

    try {
      const payload = {
        bank:
          form.bank,

        subject:
          form.subject,

        questionText:
          form.questionText,

        options:
          form.options,

        correctAnswer:
          form.correctAnswer,

        explanation:
          form.explanation,

        difficulty:
          form.difficulty,
      };

      const response =
        await fetch(
          "/api/admin/questions",
          {
            method:
              form.id ===
              null
                ? "POST"
                : "PATCH",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                form.id ===
                null
                  ? payload
                  : {
                      id:
                        form.id,

                      ...payload,
                    }
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

      await onRefresh();

      setModalOpen(
        false
      );

      onSuccess(
        form.id ===
        null
          ? "Questão criada com sucesso."
          : "Questão atualizada com sucesso."
      );
    } catch (
      error
    ) {
      onError(
        error instanceof
        Error
          ? error.message
          : "Erro ao salvar questão."
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  async function archiveQuestion(
    question:
      AdminQuestion
  ) {
    if (
      !window.confirm(
        `Arquivar a questão #${question.id}?`
      )
    ) {
      return;
    }

    onError(
      ""
    );

    try {
      const response =
        await fetch(
          `/api/admin/questions?id=${question.id}`,
          {
            method:
              "DELETE",

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

      await onRefresh();

      onSuccess(
        `Questão #${question.id} arquivada.`
      );
    } catch (
      error
    ) {
      onError(
        error instanceof
        Error
          ? error.message
          : "Erro ao arquivar questão."
      );
    }
  }

  async function reactivateQuestion(
    question:
      AdminQuestion
  ) {
    onError(
      ""
    );

    try {
      const response =
        await fetch(
          "/api/admin/questions",
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
                  question.id,

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

      await onRefresh();

      onSuccess(
        `Questão #${question.id} reativada.`
      );
    } catch (
      error
    ) {
      onError(
        error instanceof
        Error
          ? error.message
          : "Erro ao reativar questão."
      );
    }
  }

  return (
    <section className="admin-sim-panel">
      <div className="admin-question-heading">
        <div>
          <strong>
            Banco de Questões
          </strong>

          <span>
            {
              questions.filter(
                (
                  item
                ) =>
                  item.active
              ).length
            }{" "}
            ativas de{" "}
            {
              questions.length
            }{" "}
            cadastradas
          </span>
        </div>

        <button
          type="button"
          className="button button-primary"
          onClick={
            openNew
          }
          disabled={
            busy ||
            saving
          }
        >
          + Nova questão
        </button>
      </div>

      <div className="admin-question-filters">
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
                  event.target.value
                )
            }
            placeholder="Enunciado, matéria ou banca"
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
                  event.target.value
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
            Matéria
          </span>

          <select
            value={
              subject
            }
            onChange={
              (
                event
              ) =>
                setSubject(
                  event.target.value
                )
            }
          >
            <option value="">
              Todas
            </option>

            {subjects.map(
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
            Dificuldade
          </span>

          <select
            value={
              difficulty
            }
            onChange={
              (
                event
              ) =>
                setDifficulty(
                  event.target.value
                )
            }
          >
            <option value="">
              Todas
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
                  event.target.value
                )
            }
          >
            <option value="">
              Todas
            </option>

            <option value="active">
              Ativas
            </option>

            <option value="archived">
              Arquivadas
            </option>
          </select>
        </label>
      </div>

      <div className="admin-question-count">
        <strong>
          {filtered.length}
        </strong>{" "}
        questão(ões) encontrada(s)
      </div>

      {filtered.length ===
      0 ? (
        <div className="admin-sim-empty">
          <span>
            🧠
          </span>

          <h3>
            Nenhuma questão encontrada
          </h3>

          <p>
            Ajuste os filtros ou cadastre uma nova questão.
          </p>
        </div>
      ) : (
        <div className="admin-question-list">
          {filtered.map(
            (
              question
            ) => (
              <article
                key={
                  question.id
                }
                className={`admin-question-card ${
                  question.active
                    ? ""
                    : "archived"
                }`}
              >
                <header>
                  <div className="admin-question-tags">
                    <span>
                      #{question.id}
                    </span>

                    <span>
                      {question.bank}
                    </span>

                    <span>
                      {question.subject}
                    </span>

                    <span
                      className={`difficulty-${
                        question.difficulty ||
                        "medium"
                      }`}
                    >
                      {difficultyLabel(
                        question.difficulty
                      )}
                    </span>
                  </div>

                  <span
                    className={`admin-sim-status ${
                      question.active
                        ? "published"
                        : "draft"
                    }`}
                  >
                    {question.active
                      ? "Ativa"
                      : "Arquivada"}
                  </span>
                </header>

                <h3>
                  {question.questionText}
                </h3>

                <ol className="admin-question-options-preview">
                  {question.options.map(
                    (
                      option,
                      index
                    ) => (
                      <li
                        key={`${question.id}-${index}`}
                        className={
                          index ===
                          question.correctAnswer
                            ? "correct"
                            : ""
                        }
                      >
                        <span>
                          {String.fromCharCode(
                            65 +
                              index
                          )}
                        </span>

                        {option}
                      </li>
                    )
                  )}
                </ol>

                <footer>
                  <small>
                    Atualizada em{" "}
                    {new Date(
                      question.updatedAt ||
                        question.createdAt
                    ).toLocaleDateString(
                      "pt-BR"
                    )}
                  </small>

                  <div>
                    {question.active ? (
                      <button
                        type="button"
                        className="button button-ghost"
                        onClick={() =>
                          void archiveQuestion(
                            question
                          )
                        }
                      >
                        Arquivar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="button button-ghost"
                        onClick={() =>
                          void reactivateQuestion(
                            question
                          )
                        }
                      >
                        Reativar
                      </button>
                    )}

                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() =>
                        openEdit(
                          question
                        )
                      }
                    >
                      Editar
                    </button>
                  </div>
                </footer>
              </article>
            )
          )}
        </div>
      )}

      {modalOpen && (
        <div
          className="admin-sim-modal-backdrop"
          role="presentation"
          onMouseDown={
            (
              event
            ) =>
              event.target ===
                event.currentTarget &&
              !saving &&
              setModalOpen(
                false
              )
          }
        >
          <section
            className="admin-sim-modal admin-question-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-question-editor-title"
          >
            <header className="admin-sim-modal-header">
              <div>
                <span className="admin-section-kicker">
                  {form.id ===
                  null
                    ? "Nova questão"
                    : `Questão #${form.id}`}
                </span>

                <h2 id="admin-question-editor-title">
                  {form.id ===
                  null
                    ? "Cadastrar questão"
                    : "Editar questão"}
                </h2>
              </div>

              <button
                type="button"
                className="admin-sim-close"
                onClick={() =>
                  setModalOpen(
                    false
                  )
                }
                disabled={
                  saving
                }
                aria-label="Fechar editor"
              >
                ×
              </button>
            </header>

            <form
              onSubmit={
                saveQuestion
              }
            >
              <div className="admin-sim-modal-body">
                <div className="admin-sim-form-grid">
                  <label>
                    <span>
                      Banca
                    </span>

                    <input
                      type="text"
                      value={
                        form.bank
                      }
                      onChange={
                        (
                          event
                        ) =>
                          setForm(
                            (
                              current
                            ) => ({
                              ...current,

                              bank:
                                event
                                  .target
                                  .value,
                            })
                          )
                      }
                      maxLength={
                        120
                      }
                      required
                    />
                  </label>

                  <label>
                    <span>
                      Matéria
                    </span>

                    <input
                      type="text"
                      value={
                        form.subject
                      }
                      onChange={
                        (
                          event
                        ) =>
                          setForm(
                            (
                              current
                            ) => ({
                              ...current,

                              subject:
                                event
                                  .target
                                  .value,
                            })
                          )
                      }
                      maxLength={
                        200
                      }
                      required
                    />
                  </label>

                  <label>
                    <span>
                      Dificuldade
                    </span>

                    <select
                      value={
                        form.difficulty
                      }
                      onChange={
                        (
                          event
                        ) =>
                          setForm(
                            (
                              current
                            ) => ({
                              ...current,

                              difficulty:
                                event
                                  .target
                                  .value as Difficulty,
                            })
                          )
                      }
                    >
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
                  </label>

                  <div className="admin-question-status-field">
                    <span>
                      Status atual
                    </span>

                    <strong>
                      {form.active
                        ? "Ativa"
                        : "Arquivada"}
                    </strong>
                  </div>

                  <label className="span-2">
                    <span>
                      Enunciado
                    </span>

                    <textarea
                      value={
                        form.questionText
                      }
                      onChange={
                        (
                          event
                        ) =>
                          setForm(
                            (
                              current
                            ) => ({
                              ...current,

                              questionText:
                                event
                                  .target
                                  .value,
                            })
                          )
                      }
                      rows={
                        6
                      }
                      maxLength={
                        15000
                      }
                      required
                    />
                  </label>
                </div>

                <section className="admin-question-options-editor">
                  <header>
                    <div>
                      <h3>
                        Alternativas
                      </h3>

                      <p>
                        Marque o círculo da alternativa correta. O backend aceita de 2 a 5 opções.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={
                        addOption
                      }
                      disabled={
                        form.options
                          .length >=
                        5
                      }
                    >
                      + Alternativa
                    </button>
                  </header>

                  <div>
                    {form.options.map(
                      (
                        option,
                        index
                      ) => (
                        <div
                          key={
                            index
                          }
                          className={`admin-question-option-row ${
                            form.correctAnswer ===
                            index
                              ? "correct"
                              : ""
                          }`}
                        >
                          <label className="admin-question-correct-radio">
                            <input
                              type="radio"
                              name="correct-answer"
                              checked={
                                form.correctAnswer ===
                                index
                              }
                              onChange={() =>
                                setForm(
                                  (
                                    current
                                  ) => ({
                                    ...current,

                                    correctAnswer:
                                      index,
                                  })
                                )
                              }
                            />

                            <span>
                              {String.fromCharCode(
                                65 +
                                  index
                              )}
                            </span>
                          </label>

                          <input
                            type="text"
                            value={
                              option
                            }
                            onChange={
                              (
                                event
                              ) =>
                                updateOption(
                                  index,
                                  event
                                    .target
                                    .value
                                )
                            }
                            maxLength={
                              2000
                            }
                            placeholder={`Alternativa ${String.fromCharCode(
                              65 +
                                index
                            )}`}
                            required
                          />

                          <button
                            type="button"
                            className="admin-question-remove-option"
                            onClick={() =>
                              removeOption(
                                index
                              )
                            }
                            disabled={
                              form.options
                                .length <=
                              2
                            }
                            aria-label={`Remover alternativa ${
                              index +
                              1
                            }`}
                          >
                            ×
                          </button>
                        </div>
                      )
                    )}
                  </div>
                </section>

                <label className="admin-question-explanation">
                  <span>
                    Explicação / comentário do gabarito
                  </span>

                  <textarea
                    value={
                      form.explanation
                    }
                    onChange={
                      (
                        event
                      ) =>
                        setForm(
                          (
                            current
                          ) => ({
                            ...current,

                            explanation:
                              event
                                .target
                                .value,
                          })
                        )
                    }
                    rows={
                      5
                    }
                    maxLength={
                      15000
                    }
                    placeholder="Explique por que a alternativa correta é a resposta."
                  />
                </label>
              </div>

              <footer className="admin-sim-modal-footer">
                <div />

                <div>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() =>
                      setModalOpen(
                        false
                      )
                    }
                    disabled={
                      saving
                    }
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={
                      saving
                    }
                  >
                    {saving
                      ? "Salvando..."
                      : "Salvar questão"}
                  </button>
                </div>
              </footer>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}