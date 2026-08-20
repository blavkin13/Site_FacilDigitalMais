"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { SimulationQuiz } from "./simulation-quiz";

interface SimulationData {
  id: number;
  title: string;
  bank: string;
  description: string | null;
  timeLimit: number;
  totalQuestions: number;
}

interface Question {
  id: number;
  subject: string;
  questionText: string;
  options: string[];
  difficulty: string | null;
}

export function SimulationQuizClient({ simulationId }: { simulationId: number }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [simulation, setSimulation] = useState<SimulationData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    fetchSimulation();
  }, [simulationId]);

  async function fetchSimulation() {
    try {
      const res = await fetch(`/api/simulations/${simulationId}`, {
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erro ao carregar.");
        return;
      }

      const data = await res.json();
      setSimulation(data.simulation);
      setQuestions(data.questions);
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="simulation-page">
        <div className="container" style={{ padding: "4rem 1rem", textAlign: "center" }}>
          <p>Carregando simulado...</p>
        </div>
      </main>
    );
  }

  if (error || !simulation) {
    return (
      <main className="simulation-page">
        <div className="container" style={{ padding: "4rem 1rem", textAlign: "center" }}>
          <h2>❌ {error || "Simulado não encontrado."}</h2>
          <Link href="/simulados" className="button button-primary" style={{ marginTop: "1rem", display: "inline-block" }}>
            Voltar aos simulados
          </Link>
        </div>
      </main>
    );
  }

  if (questions.length === 0) {
    return (
      <main className="simulation-page">
        <div className="container" style={{ padding: "4rem 1rem", textAlign: "center" }}>
          <h2>⚠ Este simulado ainda não possui questões cadastradas.</h2>
          <Link href="/simulados" className="button button-primary" style={{ marginTop: "1rem", display: "inline-block" }}>
            Voltar
          </Link>
        </div>
      </main>
    );
  }

  return <SimulationQuiz simulation={simulation} questions={questions} />;
}