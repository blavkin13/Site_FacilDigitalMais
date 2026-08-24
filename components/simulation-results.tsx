"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";


interface DetailedAnswer {
  questionId:
    number;

  subject:
    string;

  questionText:
    string;

  options:
    string[];

  selectedOption:
    number | null;

  correctAnswer:
    number;

  isCorrect:
    boolean;

  explanation:
    string | null;
}


interface RankingEntry {
  position:
    number;

  name:
    string;

  score:
    number;

  totalQuestions:
    number;

  timeSpent:
    number;

  completedAt:
    string;

  isCurrentUser:
    boolean;
}


interface ResultData {
  id:
    number;

  simulationId:
    number;

  score:
    number;

  totalQuestions:
    number;

  percentage:
    number;

  timeSpent:
    number;

  completedAt:
    string;

  simulationTitle:
    string;

  simulationBank:
    string;

  timeLimit:
    number | null;

  timeUp:
    boolean;

  authoritativeTime:
    boolean;

  reviewAvailable:
    boolean;

  detailedAnswers:
    DetailedAnswer[];
}


interface ApiData {
  result:
    ResultData;

  ranking:
    RankingEntry[];

  userPosition:
    number;

  totalParticipants:
    number;
}


interface SimulationResultsProps {
  simulationId:
    number;

  resultId?:
    number;
}


function formatTime(
  seconds:
    number
) {
  const minutes =
    Math.floor(
      seconds /
      60
    );

  const rest =
    seconds %
    60;


  if (
    minutes ===
    0
  ) {
    return `${rest}s`;
  }


  return `${minutes}m ${rest}s`;
}


export function SimulationResults({
  simulationId,
  resultId,
}: SimulationResultsProps) {
  const [
    data,
    setData,
  ] =
    useState<
      ApiData | null
    >(
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
    error,
    setError,
  ] =
    useState(
      ""
    );

  const [
    expandedQ,
    setExpandedQ,
  ] =
    useState<
      number | null
    >(
      null
    );


  useEffect(
    () => {
      let cancelled =
        false;


      async function loadResult() {
        setLoading(
          true
        );

        setError(
          ""
        );


        const endpoint =
          Number.isInteger(
            resultId
          ) &&
          Number(
            resultId
          ) >
            0
            ? `/api/simulations/${simulationId}/results/${resultId}`
            : `/api/simulations/${simulationId}/results/latest`;


        try {
          const response =
            await fetch(
              endpoint,
              {
                credentials:
                  "include",

                cache:
                  "no-store",
              }
            );


          const body =
            await response.json();


          if (
            cancelled
          ) {
            return;
          }


          if (
            !response.ok
          ) {
            setError(
              body.error ||
              "Não foi possível carregar este resultado."
            );

            return;
          }


          setData(
            body
          );
        } catch {
          if (
            !cancelled
          ) {
            setError(
              "Erro de conexão ao carregar o resultado."
            );
          }
        } finally {
          if (
            !cancelled
          ) {
            setLoading(
              false
            );
          }
        }
      }


      void loadResult();


      return () => {
        cancelled =
          true;
      };
    },
    [
      resultId,
      simulationId,
    ]
  );


  if (
    loading
  ) {
    return (
      <main className="simulation-page">
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
            Carregando resultado...
          </p>
        </div>
      </main>
    );
  }


  if (
    error ||
    !data
  ) {
    return (
      <main className="simulation-page">
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
            Resultado indisponível
          </h2>

          <p>
            {error ||
              "Nenhum resultado encontrado."}
          </p>

          <Link
            href="/simulados"
            className="button button-primary"
          >
            Voltar aos simulados
          </Link>
        </div>
      </main>
    );
  }


  const result =
    data.result;


  const correctCount =
    result.detailedAnswers.filter(
      (
        answer
      ) =>
        answer.isCorrect
    ).length;


  const wrongCount =
    result.reviewAvailable
      ? result.totalQuestions -
        correctCount
      : result.totalQuestions -
        result.score;


  const bySubject =
    new Map<
      string,
      {
        correct:
          number;

        total:
          number;
      }
    >();


  for (
    const answer of
      result.detailedAnswers
  ) {
    const current =
      bySubject.get(
        answer.subject
      ) || {
        correct:
          0,

        total:
          0,
      };


    current.total +=
      1;


    if (
      answer.isCorrect
    ) {
      current.correct +=
        1;
    }


    bySubject.set(
      answer.subject,
      current
    );
  }


  return (
    <main className="simulation-page results-page">
      <section className="results-hero">
        <div className="container">
          <span className="eyebrow eyebrow-light">
            <i />{" "}
            {result.simulationBank}
          </span>

          <h1>
            {result.simulationTitle}
          </h1>

          <p>
            {result.timeUp
              ? "Tempo esgotado — resultado salvo."
              : "Simulado concluído!"}
          </p>

          <small className="results-persistent-label">
            Resultado #{result.id} •{" "}
            {new Date(
              result.completedAt
            ).toLocaleString(
              "pt-BR"
            )}
          </small>
        </div>
      </section>


      <section className="container results-container">
        <div className="results-summary">
          <div
            className={`result-card big ${
              result.percentage >=
              70
                ? "success"
                : result.percentage >=
                    50
                  ? "warning"
                  : "danger"
            }`}
          >
            <small>
              SUA PONTUAÇÃO
            </small>

            <strong>
              {result.percentage}%
            </strong>

            <span>
              {result.score} de{" "}
              {result.totalQuestions} acertos
            </span>
          </div>


          <div className="result-card">
            <small>
              TEMPO
            </small>

            <strong>
              {formatTime(
                result.timeSpent
              )}
            </strong>

            <span>
              {result.authoritativeTime
                ? "medido pelo servidor"
                : "resultado legado"}
            </span>
          </div>


          <div className="result-card">
            <small>
              ACERTOS / ERROS
            </small>

            <strong>
              {result.score} /{" "}
              {wrongCount}
            </strong>

            <span>
              desempenho final
            </span>
          </div>


          <div className="result-card">
            <small>
              POSIÇÃO NO RANKING
            </small>

            <strong>
              {data.userPosition >
              0
                ? `${data.userPosition}º`
                : "—"}
            </strong>

            <span>
              de{" "}
              {data.totalParticipants} participante(s)
            </span>
          </div>
        </div>


        {result.reviewAvailable &&
          bySubject.size >
            0 && (
          <div className="results-subject-panel">
            <header>
              <span>
                DESEMPENHO POR DISCIPLINA
              </span>

              <h2>
                Onde você se destacou
              </h2>
            </header>

            <div className="subject-grid">
              {Array.from(
                bySubject.entries()
              ).map(
                (
                  [
                    subject,
                    stats,
                  ]
                ) => {
                  const percentage =
                    Math.round(
                      (
                        stats.correct /
                        stats.total
                      ) *
                        100
                    );


                  return (
                    <article
                      key={
                        subject
                      }
                      className="subject-card"
                    >
                      <b>
                        {subject}
                      </b>

                      <div className="subject-bar">
                        <i
                          style={{
                            width:
                              `${percentage}%`,
                          }}
                        />
                      </div>

                      <div className="subject-stats">
                        <span className="correct">
                          ✓{" "}
                          {stats.correct}
                        </span>

                        <span className="wrong">
                          ✗{" "}
                          {stats.total -
                            stats.correct}
                        </span>

                        <strong>
                          {percentage}%
                        </strong>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          </div>
        )}


        {result.reviewAvailable ? (
          <div className="results-review">
            <header>
              <span>
                REVISÃO DETALHADA
              </span>

              <h2>
                Veja cada questão
              </h2>

              <p>
                O conteúdo abaixo é o snapshot da prova que você realmente respondeu.
              </p>
            </header>

            <div className="questions-review-list">
              {result.detailedAnswers.map(
                (
                  answer,
                  index
                ) => (
                  <article
                    key={
                      answer.questionId
                    }
                    className={`review-question ${
                      answer.isCorrect
                        ? "correct"
                        : "wrong"
                    }`}
                  >
                    <header
                      onClick={() =>
                        setExpandedQ(
                          expandedQ ===
                            index
                            ? null
                            : index
                        )
                      }
                    >
                      <div>
                        <span
                          className={`q-status ${
                            answer.isCorrect
                              ? "ok"
                              : "fail"
                          }`}
                        >
                          {answer.isCorrect
                            ? "✓ Acerto"
                            : "✗ Erro"}
                        </span>

                        <strong>
                          Questão{" "}
                          {index +
                            1} —{" "}
                          {answer.subject}
                        </strong>
                      </div>

                      <b>
                        {expandedQ ===
                        index
                          ? "−"
                          : "+"}
                      </b>
                    </header>


                    {expandedQ ===
                      index && (
                      <div className="review-body">
                        <p className="q-text">
                          {answer.questionText}
                        </p>

                        <div className="q-options">
                          {answer.options.map(
                            (
                              option,
                              optionIndex
                            ) => {
                              let className =
                                "";


                              if (
                                optionIndex ===
                                answer.correctAnswer
                              ) {
                                className =
                                  "correct";
                              } else if (
                                optionIndex ===
                                answer.selectedOption
                              ) {
                                className =
                                  "wrong-selected";
                              }


                              return (
                                <div
                                  key={
                                    optionIndex
                                  }
                                  className={`q-option ${className}`}
                                >
                                  <b>
                                    {String.fromCharCode(
                                      65 +
                                        optionIndex
                                    )}
                                  </b>

                                  <span>
                                    {option}
                                  </span>
                                </div>
                              );
                            }
                          )}
                        </div>


                        {answer.explanation && (
                          <div className="q-explanation">
                            <strong>
                              💡 Comentário:
                            </strong>

                            <p>
                              {answer.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                )
              )}
            </div>
          </div>
        ) : (
          <div className="results-review-unavailable">
            <strong>
              Revisão detalhada indisponível
            </strong>

            <p>
              Este é um resultado legado criado antes da preservação do snapshot completo das questões. A pontuação histórica permanece válida.
            </p>
          </div>
        )}


        <div className="results-ranking">
          <header>
            <span>
              RANKING HISTÓRICO
            </span>

            <h2>
              Top {data.ranking.length} alunos
            </h2>

            <p>
              Melhor tentativa de cada aluno. O percentual é o critério principal e o tempo server-side é usado apenas como desempate.
            </p>
          </header>

          <div className="ranking-table">
            <div className="ranking-header">
              <span>
                #
              </span>

              <span>
                Aluno
              </span>

              <span>
                Acertos
              </span>

              <span>
                Tempo
              </span>

              <span>
                Data
              </span>
            </div>

            {data.ranking.map(
              (
                entry
              ) => (
                <div
                  key={`${entry.position}-${entry.name}`}
                  className={`ranking-row ${
                    entry.isCurrentUser
                      ? "current-user"
                      : ""
                  }`}
                >
                  <span className="position">
                    {entry.position <=
                    3
                      ? [
                          "🥇",
                          "🥈",
                          "🥉",
                        ][
                          entry.position -
                            1
                        ]
                      : `${entry.position}º`}
                  </span>

                  <span className="name">
                    {entry.name}

                    {entry.isCurrentUser && (
                      <b>
                        (você)
                      </b>
                    )}
                  </span>

                  <span className="score">
                    {entry.score}/
                    {entry.totalQuestions}
                  </span>

                  <span className="time">
                    {formatTime(
                      entry.timeSpent
                    )}
                  </span>

                  <span className="date">
                    {new Date(
                      entry.completedAt
                    ).toLocaleDateString(
                      "pt-BR"
                    )}
                  </span>
                </div>
              )
            )}
          </div>
        </div>


        <div className="results-actions">
          <Link
            href={`/simulados/${simulationId}`}
            className="button button-primary"
          >
            Refazer simulado →
          </Link>

          <Link
            href="/simulados"
            className="button button-ghost"
          >
            Meu histórico
          </Link>
        </div>
      </section>
    </main>
  );
}