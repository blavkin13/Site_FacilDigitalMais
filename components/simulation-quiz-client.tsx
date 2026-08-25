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
      let cancelled =
        false;


      async function fetchSimulation() {
        setLoading(
          true
        );


        setError(
          ""
        );


        try {
          /**
           * Este endpoint devolve somente
           * metadados.
           *
           * As questões reais serão recebidas
           * somente pela infraestrutura de
           * attempts, depois que o relógio
           * server-side começar.
           */
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
            cancelled
          ) {
            return;
          }


          if (
            !response.ok
          ) {
            setError(
              data.error ||
              "Erro ao carregar simulado."
            );


            return;
          }


          if (
            !data.simulation
          ) {
            setError(
              "Dados do simulado inválidos."
            );


            return;
          }


          setSimulation(
            data.simulation
          );
        } catch {
          if (
            !cancelled
          ) {
            setError(
              "Erro de conexão."
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


      void fetchSimulation();


      return () => {
        cancelled =
          true;
      };
    },
    [
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


  return (
    <SimulationQuiz
      simulation={
        simulation
      }
    />
  );
}