"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "./auth-provider";

interface Bank {
  name: string;
  count: number;
}

interface Simulation {
  id: number;
  title: string;
  bank: string;
  description: string | null;
  timeLimit: number;
}

export function SimulationList() {
  const { user, loading: authLoading } = useAuth();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!authLoading && user) {
      fetchSimulations();
    }
  }, [authLoading, user]);

  async function fetchSimulations() {
    try {
      const res = await fetch("/api/simulations", { credentials: "include" });
      const data = await res.json();

      if (res.ok) {
        setHasAccess(data.hasAccess);
        setBanks(data.banks || []);
        setSimulations(data.simulations || []);
        if (!data.hasAccess) {
          setMessage(data.message || "Acesso negado.");
        }
      } else {
        setMessage(data.error || "Erro ao carregar.");
      }
    } catch {
      setMessage("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || loading) {
    return (
      <main className="simulation-page">
        <div className="container" style={{ padding: "4rem 1rem", textAlign: "center" }}>
          <p>Carregando simulados...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="simulation-page">
        <section className="simulation-hero">
          <div className="container">
            <span className="eyebrow eyebrow-light"><i /> Simulados</span>
            <h1>Entre para acessar os simulados.</h1>
            <Link href="/login?returnTo=/simulados" className="button button-primary">
              Fazer login →
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (!hasAccess) {
    return (
      <main className="simulation-page">
        <section className="simulation-hero">
          <div className="container">
            <span className="eyebrow eyebrow-light"><i /> Simulados exclusivos</span>
            <h1>Acesso liberado para alunos.</h1>
            <p>{message}</p>
            <Link href="/apostilas" className="button button-primary">
              Ver apostilas →
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const filteredSimulations = selectedBank
    ? simulations.filter((s) => s.bank === selectedBank)
    : simulations;

  return (
    <main className="simulation-page">
      <section className="simulation-hero">
        <div className="container">
          <span className="eyebrow eyebrow-light"><i /> Área de simulados</span>
          <h1>Pratique no estilo das principais bancas.</h1>
          <p>Teste seu conhecimento com questões cronometradas e veja sua posição no ranking.</p>
        </div>
      </section>

      <section className="container simulation-layout">
        {/* Lista de bancas */}
        <aside className="banks-sidebar">
          <b>BANCAS</b>
          <button
            className={selectedBank === null ? "active" : ""}
            onClick={() => setSelectedBank(null)}
          >
            <span>Todas</span>
            <small>{simulations.length}</small>
          </button>
          {banks.map((bank) => (
            <button
              key={bank.name}
              className={selectedBank === bank.name ? "active" : ""}
              onClick={() => setSelectedBank(bank.name)}
            >
              <span>{bank.name}</span>
              <small>{bank.count}</small>
            </button>
          ))}
        </aside>

        {/* Lista de simulados */}
        <div className="simulations-grid">
          {filteredSimulations.length === 0 ? (
            <div className="simulations-empty">
              <span>✓</span>
              <h3>Nenhum simulado para esta banca.</h3>
              <p>Em breve teremos mais provas disponíveis.</p>
            </div>
          ) : (
            filteredSimulations.map((sim) => (
              <Link
                key={sim.id}
                href={`/simulados/${sim.id}`}
                className="simulation-card"
              >
                <span className="sim-bank">{sim.bank}</span>
                <h3>{sim.title}</h3>
                {sim.description && <p>{sim.description}</p>}
                <footer>
                  <span><i>⏱</i> {sim.timeLimit} min</span>
                  <span><i>✓</i> Simulado</span>
                  <b>Iniciar →</b>
                </footer>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}