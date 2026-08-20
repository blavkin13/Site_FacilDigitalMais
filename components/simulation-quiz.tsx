"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Question {
  id: number;
  subject: string;
  questionText: string;
  options: string[];
  difficulty: string | null;
}

interface SimulationData {
  id: number;
  title: string;
  bank: string;
  description: string | null;
  timeLimit: number;
  totalQuestions: number;
}

interface SimulationQuizProps {
  simulation: SimulationData;
  questions: Question[];
}

interface UserAnswer {
  questionId: number;
  selectedOption: number | null;
}

export function SimulationQuiz({ simulation, questions }: SimulationQuizProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<UserAnswer[]>(
    questions.map((q) => ({ questionId: q.id, selectedOption: null }))
  );
  const [timeLeft, setTimeLeft] = useState(simulation.timeLimit * 60); // em segundos
  const [started, setStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const startTimeRef = useRef<number>(Date.now());

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentIndex];

  // Timer
  useEffect(() => {
    if (!started) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmit(true); // timeUp = true
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [started]);

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function selectOption(optionIndex: number) {
    const newAnswers = [...answers];
    newAnswers[currentIndex] = {
      ...newAnswers[currentIndex],
      selectedOption: optionIndex,
    };
    setAnswers(newAnswers);
  }

  function nextQuestion() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }

  function prevQuestion() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }

  async function handleSubmit(timeUp: boolean = false) {
    setSubmitting(true);

    const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);

    try {
      const res = await fetch(`/api/simulations/${simulation.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ answers, timeSpent }),
      });

      const data = await res.json();

      if (res.ok) {
        // Armazenar resultado na sessionStorage para a página de resultado
        sessionStorage.setItem(
          `sim_result_${simulation.id}`,
          JSON.stringify({
            ...data,
            simulationTitle: simulation.title,
            simulationBank: simulation.bank,
            timeUp,
          })
        );
        router.push(`/simulados/${simulation.id}/resultado`);
      } else {
        alert(data.error || "Erro ao submeter.");
      }
    } catch {
      alert("Erro de conexão.");
    } finally {
      setSubmitting(false);
    }
  }

  const answeredCount = answers.filter((a) => a.selectedOption !== null).length;
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const timePercentage = (timeLeft / (simulation.timeLimit * 60)) * 100;
  const timeWarning = timePercentage < 20;

  if (!started) {
    return (
      <main className="simulation-page">
        <section className="simulation-hero">
          <div className="container">
            <span className="eyebrow eyebrow-light"><i /> {simulation.bank}</span>
            <h1>{simulation.title}</h1>
            {simulation.description && <p>{simulation.description}</p>}
          </div>
        </section>

        <section className="container">
          <div className="sim-start-card">
            <h2>Preparado para começar?</h2>
            <div className="sim-info-grid">
              <div>
                <small>QUESTÕES</small>
                <strong>{simulation.totalQuestions}</strong>
              </div>
              <div>
                <small>TEMPO</small>
                <strong>{simulation.timeLimit} min</strong>
              </div>
              <div>
                <small>BANCA</small>
                <strong>{simulation.bank}</strong>
              </div>
            </div>
            <p>
              ⚠ O tempo começa a contar assim que você iniciar. Certifique-se de
              estar em um ambiente tranquilo.
            </p>
            <button
              className="button button-primary sim-start-btn"
              onClick={() => {
                startTimeRef.current = Date.now();
                setStarted(true);
              }}
            >
              Iniciar simulado →
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="quiz-page">
      <section className="quiz-hero">
        <div className="container">
          <span className="eyebrow eyebrow-light"><i /> {simulation.bank}</span>
          <h1>{simulation.title}</h1>
        </div>
      </section>

      <section className="quiz-shell container">
        <header>
          <div>
            <span>
              QUESTÃO {currentIndex + 1} DE {questions.length}
            </span>
            <div className="quiz-progress">
              <i style={{ width: `${progress}%` }} />
            </div>
          </div>
          <strong className={timeWarning ? "time-warning" : ""}>
            ⏱ {formatTime(timeLeft)}
          </strong>
        </header>

        <div className="quiz-content">
          <aside>
            <span>DISCIPLINA</span>
            <b>{currentQuestion.subject}</b>
            {currentQuestion.difficulty && (
              <small className={`diff-${currentQuestion.difficulty}`}>
                {currentQuestion.difficulty === "easy"
                  ? "Fácil"
                  : currentQuestion.difficulty === "medium"
                  ? "Médio"
                  : "Difícil"}
              </small>
            )}
            <hr />
            <div className="quiz-nav-stats">
              <small>Respondidas</small>
              <strong>
                {answeredCount}/{questions.length}
              </strong>
            </div>
            <div className="quiz-question-nav">
              {questions.map((_, idx) => (
                <button
                  key={idx}
                  className={`q-nav-btn ${idx === currentIndex ? "current" : ""} ${
                    answers[idx]?.selectedOption !== null ? "answered" : ""
                  }`}
                  onClick={() => setCurrentIndex(idx)}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </aside>

          <article>
            <span>{simulation.bank.toUpperCase()} • QUESTÃO {currentIndex + 1}</span>
            <h2>{currentQuestion.questionText}</h2>
            <div className="answers">
              {currentQuestion.options.map((opt, n) => (
                <button
                  key={n}
                  onClick={() => selectOption(n)}
                  className={currentAnswer?.selectedOption === n ? "selected" : ""}
                  disabled={submitting}
                >
                  <b>{String.fromCharCode(65 + n)}</b>
                  {opt}
                </button>
              ))}
            </div>

            <footer className="quiz-actions">
              <button
                className="button button-ghost"
                onClick={prevQuestion}
                disabled={currentIndex === 0}
              >
                ← Anterior
              </button>

              {currentIndex < questions.length - 1 ? (
                <button
                  className="button button-primary"
                  onClick={nextQuestion}
                >
                  Próxima →
                </button>
              ) : (
                <button
                  className="button button-accent"
                  onClick={() => handleSubmit(false)}
                  disabled={submitting || answeredCount < questions.length}
                  title={
                    answeredCount < questions.length
                      ? `Responda todas as ${questions.length} questões`
                      : "Finalizar simulado"
                  }
                >
                  {submitting ? "Enviando..." : "Finalizar simulado ✓"}
                </button>
              )}
            </footer>
          </article>
        </div>
      </section>
    </main>
  );
}