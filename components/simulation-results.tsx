"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface DetailedAnswer {
  questionId: number;
  subject: string;
  questionText: string;
  options: string[];
  selectedOption: number;
  correctAnswer: number;
  isCorrect: boolean;
  explanation: string | null;
}

interface RankingEntry {
  position: number;
  name: string;
  score: number;
  totalQuestions: number;
  timeSpent: number;
  completedAt: string;
  isCurrentUser: boolean;
}

interface ResultData {
  score: number;
  totalQuestions: number;
  timeSpent: number;
  percentage: number;
  detailedAnswers: DetailedAnswer[];
  ranking: RankingEntry[];
  userPosition: number;
  simulationTitle: string;
  simulationBank: string;
  timeUp?: boolean;
}

interface SimulationResultsProps {
  simulationId: number;
}

export function SimulationResults({ simulationId }: SimulationResultsProps) {
  const [data, setData] = useState<ResultData | null>(null);
  const [expandedQ, setExpandedQ] = useState<number | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(`sim_result_${simulationId}`);
    if (stored) {
      try {
        setData(JSON.parse(stored));
      } catch {
        // fallback
      }
    }
  }, [simulationId]);

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  }

  if (!data) {
    return (
      <main className="simulation-page">
        <div className="container" style={{ padding: "4rem 1rem", textAlign: "center" }}>
          <p>Nenhum resultado encontrado. <Link href="/simulados">Voltar aos simulados</Link></p>
        </div>
      </main>
    );
  }

  const correctCount = data.detailedAnswers.filter((a) => a.isCorrect).length;
  const wrongCount = data.totalQuestions - correctCount;

  // Agrupar acertos por disciplina
  const bySubject = new Map<string, { correct: number; total: number }>();
  for (const a of data.detailedAnswers) {
    const current = bySubject.get(a.subject) || { correct: 0, total: 0 };
    current.total += 1;
    if (a.isCorrect) current.correct += 1;
    bySubject.set(a.subject, current);
  }

  return (
    <main className="simulation-page results-page">
      <section className="results-hero">
        <div className="container">
          <span className="eyebrow eyebrow-light">
            <i /> {data.simulationBank}
          </span>
          <h1>{data.simulationTitle}</h1>
          <p>{data.timeUp ? "Tempo esgotado!" : "Simulado concluído!"}</p>
        </div>
      </section>

      <section className="container results-container">
        {/* Cards de resultado */}
        <div className="results-summary">
          <div className={`result-card big ${data.percentage >= 70 ? "success" : data.percentage >= 50 ? "warning" : "danger"}`}>
            <small>SUA PONTUAÇÃO</small>
            <strong>{data.percentage}%</strong>
            <span>{data.score} de {data.totalQuestions} acertos</span>
          </div>

          <div className="result-card">
            <small>TEMPO</small>
            <strong>{formatTime(data.timeSpent)}</strong>
            <span>do tempo total</span>
          </div>

          <div className="result-card">
            <small>POSIÇÃO NO RANKING</small>
            <strong>{data.userPosition}º</strong>
            <span>de {data.ranking.length} participantes</span>
          </div>
        </div>

        {/* Desempenho por disciplina */}
        <div className="results-subject-panel">
          <header>
            <span>DESEMPENHO POR DISCIPLINA</span>
            <h2>Onde você se destacou</h2>
          </header>
          <div className="subject-grid">
            {Array.from(bySubject.entries()).map(([subject, stats]) => {
              const perc = Math.round((stats.correct / stats.total) * 100);
              return (
                <article key={subject} className="subject-card">
                  <b>{subject}</b>
                  <div className="subject-bar">
                    <i style={{ width: `${perc}%` }} />
                  </div>
                  <div className="subject-stats">
                    <span className="correct">✓ {stats.correct}</span>
                    <span className="wrong">✗ {stats.total - stats.correct}</span>
                    <strong>{perc}%</strong>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {/* Revisão das questões */}
        <div className="results-review">
          <header>
            <span>REVISÃO DETALHADA</span>
            <h2>Veja cada questão</h2>
            <p>Clique em uma questão para ver a explicação.</p>
          </header>

          <div className="questions-review-list">
            {data.detailedAnswers.map((answer, idx) => (
              <article
                key={answer.questionId}
                className={`review-question ${answer.isCorrect ? "correct" : "wrong"}`}
              >
                <header onClick={() => setExpandedQ(expandedQ === idx ? null : idx)}>
                  <div>
                    <span className={`q-status ${answer.isCorrect ? "ok" : "fail"}`}>
                      {answer.isCorrect ? "✓ Acerto" : "✗ Erro"}
                    </span>
                    <strong>Questão {idx + 1} — {answer.subject}</strong>
                  </div>
                  <b>{expandedQ === idx ? "−" : "+"}</b>
                </header>

                {expandedQ === idx && (
                  <div className="review-body">
                    <p className="q-text">{answer.questionText}</p>
                    <div className="q-options">
                      {answer.options.map((opt, n) => {
                        let className = "";
                        if (n === answer.correctAnswer) className = "correct";
                        else if (n === answer.selectedOption) className = "wrong-selected";
                        return (
                          <div key={n} className={`q-option ${className}`}>
                            <b>{String.fromCharCode(65 + n)}</b>
                            <span>{opt}</span>
                          </div>
                        );
                      })}
                    </div>
                    {answer.explanation && (
                      <div className="q-explanation">
                        <strong>💡 Comentário:</strong>
                        <p>{answer.explanation}</p>
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>

        {/* Ranking */}
        <div className="results-ranking">
          <header>
            <span>RANKING HISTÓRICO</span>
            <h2>Top {data.ranking.length} alunos</h2>
          </header>

          <div className="ranking-table">
            <div className="ranking-header">
              <span>#</span>
              <span>Aluno</span>
              <span>Acertos</span>
              <span>Tempo</span>
              <span>Data</span>
            </div>
            {data.ranking.map((entry) => (
              <div
                key={entry.position}
                className={`ranking-row ${entry.isCurrentUser ? "current-user" : ""}`}
              >
                <span className="position">
                  {entry.position <= 3 ? ["🥇", "🥈", "🥉"][entry.position - 1] : `${entry.position}º`}
                </span>
                <span className="name">
                  {entry.name}
                  {entry.isCurrentUser && <b>(você)</b>}
                </span>
                <span className="score">
                  {entry.score}/{entry.totalQuestions}
                </span>
                <span className="time">{formatTime(entry.timeSpent)}</span>
                <span className="date">
                  {new Date(entry.completedAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Ações */}
        <div className="results-actions">
          <Link href={`/simulados/${simulationId}`} className="button button-primary">
            Refazer simulado →
          </Link>
          <Link href="/simulados" className="button button-ghost">
            Voltar aos simulados
          </Link>
        </div>
      </section>
    </main>
  );
}