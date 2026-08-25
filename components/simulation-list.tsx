"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  useAuth,
} from "./auth-provider";

import {
  SimulationHistory,
} from "./simulation-history";


interface Bank {
  name:
    string;

  count:
    number;
}


interface Simulation {
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
}


export function SimulationList() {
  const {
    user,
    loading:
      authLoading,
  } =
    useAuth();


  const [
    banks,
    setBanks,
  ] =
    useState<
      Bank[]
    >(
      []
    );


  const [
    simulations,
    setSimulations,
  ] =
    useState<
      Simulation[]
    >(
      []
    );


  const [
    hasAccess,
    setHasAccess,
  ] =
    useState(
      false
    );


  const [
    selectedBank,
    setSelectedBank,
  ] =
    useState<
      string | null
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
    message,
    setMessage,
  ] =
    useState(
      ""
    );


  useEffect(
    () => {
      if (
        !authLoading &&
        user
      ) {
        void fetchSimulations();
      } else if (
        !authLoading
      ) {
        setLoading(
          false
        );
      }
    },
    [
      authLoading,
      user,
    ]
  );


  async function fetchSimulations() {
    try {
      const response =
        await fetch(
          "/api/simulations",
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
        response.ok
      ) {
        setHasAccess(
          data.hasAccess ===
          true
        );

        setBanks(
          data.banks ||
          []
        );

        setSimulations(
          data.simulations ||
          []
        );


        if (
          !data.hasAccess
        ) {
          setMessage(
            data.message ||
            "Você não possui acesso ativo a novos simulados."
          );
        }
      } else {
        setMessage(
          data.error ||
          "Erro ao carregar."
        );
      }
    } catch {
      setMessage(
        "Erro de conexão."
      );
    } finally {
      setLoading(
        false
      );
    }
  }


  if (
    authLoading ||
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
            Carregando simulados...
          </p>
        </div>
      </main>
    );
  }


  if (
    !user
  ) {
    return (
      <main className="simulation-page">
        <section className="simulation-hero">
          <div className="container">
            <span className="eyebrow eyebrow-light">
              <i /> Simulados
            </span>

            <h1>
              Entre para acessar os simulados.
            </h1>

            <Link
              href="/login?returnTo=/simulados"
              className="button button-primary"
            >
              Fazer login →
            </Link>
          </div>
        </section>
      </main>
    );
  }


  if (
    !hasAccess
  ) {
    return (
      <main className="simulation-page">
        <section className="simulation-hero">
          <div className="container">
            <span className="eyebrow eyebrow-light">
              <i /> Simulados exclusivos
            </span>

            <h1>
              Novas tentativas exigem uma compra elegível.
            </h1>

            <p>
              {message}
            </p>

            <Link
              href="/apostilas"
              className="button button-primary"
            >
              Ver apostilas →
            </Link>
          </div>
        </section>

        {/**
         * Histórico não depende do entitlement atual.
         *
         * Um aluno reembolsado continua podendo
         * consultar provas concluídas anteriormente.
         */}
        <SimulationHistory />
      </main>
    );
  }


  const filteredSimulations =
    selectedBank
      ? simulations.filter(
          (
            simulation
          ) =>
            simulation.bank ===
            selectedBank
        )
      : simulations;


  return (
    <main className="simulation-page">
      <section className="simulation-hero">
        <div className="container">
          <span className="eyebrow eyebrow-light">
            <i /> Área de simulados
          </span>

          <h1>
            Pratique no estilo das principais bancas.
          </h1>

          <p>
            Teste seu conhecimento com questões cronometradas e acompanhe seu histórico.
          </p>
        </div>
      </section>


      <section className="container simulation-layout">
        <aside className="banks-sidebar">
          <b>
            BANCAS
          </b>

          <button
            type="button"
            className={
              selectedBank ===
              null
                ? "active"
                : ""
            }
            onClick={() =>
              setSelectedBank(
                null
              )
            }
          >
            <span>
              Todas
            </span>

            <small>
              {simulations.length}
            </small>
          </button>


          {banks.map(
            (
              bank
            ) => (
              <button
                type="button"
                key={
                  bank.name
                }
                className={
                  selectedBank ===
                  bank.name
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setSelectedBank(
                    bank.name
                  )
                }
              >
                <span>
                  {bank.name}
                </span>

                <small>
                  {bank.count}
                </small>
              </button>
            )
          )}
        </aside>


        <div className="simulations-grid">
          {filteredSimulations.length ===
          0 ? (
            <div className="simulations-empty">
              <span>
                ✓
              </span>

              <h3>
                Nenhum simulado para esta banca.
              </h3>

              <p>
                Em breve teremos mais provas disponíveis.
              </p>
            </div>
          ) : (
            filteredSimulations.map(
              (
                simulation
              ) => (
                <Link
                  key={
                    simulation.id
                  }
                  href={`/simulados/${simulation.id}`}
                  className="simulation-card"
                >
                  <span className="sim-bank">
                    {simulation.bank}
                  </span>

                  <h3>
                    {simulation.title}
                  </h3>

                  {simulation.description && (
                    <p>
                      {simulation.description}
                    </p>
                  )}

                  <footer>
                    <span>
                      <i>
                        ⏱
                      </i>{" "}
                      {simulation.timeLimit} min
                    </span>

                    <span>
                      <i>
                        ✓
                      </i>{" "}
                      Simulado
                    </span>

                    <b>
                      Iniciar →
                    </b>
                  </footer>
                </Link>
              )
            )
          )}
        </div>
      </section>


      <SimulationHistory />
    </main>
  );
}