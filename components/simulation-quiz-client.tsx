"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  SimulationQuiz,
} from "./simulation-quiz";


interface SimulationData {
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

  totalQuestions:
    number;
}


export function SimulationQuizClient({
  simulationId,
}: {
  simulationId:
    number;
}) {
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
    simulation,
    setSimulation,
  ] =
    useState<
      SimulationData | null
    >(
      null
    );


  useEffect(
    () => {
      void fetchSimulation();
    },
    [
      simulationId,
    ]
  );


  async function fetchSimulation() {
    setLoading(
      true
    );

    setError(
      ""
    );


    try {
      const response =
        await fetch(
          `/api/simulations/${simulationId}`,
          {
            credentials:
              "include",

            cache:
              "no-store",
          }
        );


      const data =
        await response.json();


      if (
        !response.ok
      ) {
        setError(
          data.error ||
          "Erro ao carregar."
        );

        return;
      }


      setSimulation(
        data.simulation
      );
    } catch {
      setError(
        "Erro de conexão."
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
            Carregando simulado...
          </p>
        </div>
      </main>
    );
  }


  if (
    error ||
    !simulation
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
            ❌{" "}
            {error ||
              "Simulado não encontrado."}
          </h2>

          <Link
            href="/simulados"
            className="button button-primary"
            style={{
              marginTop:
                "1rem",

              display:
                "inline-block",
            }}
          >
            Voltar aos simulados
          </Link>
        </div>
      </main>
    );
  }


  if (
    simulation.totalQuestions <=
    0
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
            ⚠ Este simulado ainda não possui questões cadastradas.
          </h2>

          <Link
            href="/simulados"
            className="button button-primary"
            style={{
              marginTop:
                "1rem",

              display:
                "inline-block",
            }}
          >
            Voltar
          </Link>
        </div>
      </main>
    );
  }


  return (
    <SimulationQuiz
      simulation={
        simulation
      }
    />
  );
}