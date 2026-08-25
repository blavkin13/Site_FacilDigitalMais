"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";


interface HistoryEntry {
  id:
    number;

  simulationId:
    number;

  simulationTitle:
    string;

  simulationBank:
    string;

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

  authoritativeTime:
    boolean;

  reviewAvailable:
    boolean;
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


  return minutes >
    0
    ? `${minutes}m ${rest}s`
    : `${rest}s`;
}


export function SimulationHistory() {
  const [
    results,
    setResults,
  ] =
    useState<
      HistoryEntry[]
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


  useEffect(
    () => {
      let cancelled =
        false;


      async function loadHistory() {
        try {
          const response =
            await fetch(
              "/api/simulations/results",
              {
                credentials:
                  "include",

                cache:
                  "no-store",
              }
            );


          if (
            !response.ok
          ) {
            return;
          }


          const data =
            await response.json();


          if (
            !cancelled
          ) {
            setResults(
              data.results ||
              []
            );
          }
        } catch {
          // Histórico é complementar à listagem.
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


      void loadHistory();


      return () => {
        cancelled =
          true;
      };
    },
    []
  );


  const bestPercentage =
    useMemo(
      () =>
        results.reduce(
          (
            best,
            result
          ) =>
            Math.max(
              best,
              result.percentage
            ),
          0
        ),
      [
        results,
      ]
    );


  if (
    loading
  ) {
    return (
      <section className="simulation-history container">
        <header>
          <span>
            MEU HISTÓRICO
          </span>

          <h2>
            Carregando resultados...
          </h2>
        </header>
      </section>
    );
  }


  if (
    results.length ===
    0
  ) {
    return null;
  }


  return (
    <section className="simulation-history container">
      <header className="simulation-history-header">
        <div>
          <span className="admin-section-kicker">
            Meu histórico
          </span>

          <h2>
            Resultados anteriores
          </h2>

          <p>
            Seus resultados permanecem disponíveis mesmo depois de sair da conta ou trocar de dispositivo.
          </p>
        </div>

        <div className="simulation-history-summary">
          <article>
            <small>
              TENTATIVAS
            </small>

            <strong>
              {results.length}
            </strong>
          </article>

          <article>
            <small>
              MELHOR RESULTADO
            </small>

            <strong>
              {bestPercentage}%
            </strong>
          </article>
        </div>
      </header>


      <div className="simulation-history-list">
        {results.map(
          (
            result
          ) => (
            <Link
              key={
                result.id
              }
              href={`/simulados/${result.simulationId}/resultado/${result.id}`}
              className="simulation-history-card"
            >
              <div className="simulation-history-main">
                <span>
                  {result.simulationBank}
                </span>

                <h3>
                  {result.simulationTitle}
                </h3>

                <small>
                  {new Date(
                    result.completedAt
                  ).toLocaleString(
                    "pt-BR"
                  )}
                </small>
              </div>

              <div className="simulation-history-metrics">
                <div>
                  <small>
                    NOTA
                  </small>

                  <strong>
                    {result.percentage}%
                  </strong>
                </div>

                <div>
                  <small>
                    ACERTOS
                  </small>

                  <strong>
                    {result.score}/
                    {result.totalQuestions}
                  </strong>
                </div>

                <div>
                  <small>
                    TEMPO
                  </small>

                  <strong>
                    {formatTime(
                      result.timeSpent
                    )}
                  </strong>
                </div>
              </div>

              <div className="simulation-history-action">
                <span>
                  {result.reviewAvailable
                    ? "Ver resultado →"
                    : "Ver registro →"}
                </span>
              </div>
            </Link>
          )
        )}
      </div>
    </section>
  );
}
