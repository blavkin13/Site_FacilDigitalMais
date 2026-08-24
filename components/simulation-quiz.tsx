"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";


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


interface AttemptQuestion {
  id:
    number;

  position:
    number;

  subject:
    string;

  questionText:
    string;

  options:
    string[];

  difficulty:
    string | null;
}


interface PublicAttempt {
  token:
    string;

  status:
    "in_progress";

  startedAt:
    string;

  expiresAt:
    string;

  serverNow:
    string;

  secondsRemaining:
    number;

  simulation: {
    id:
      number;

    title:
      string;

    bank:
      string;

    timeLimit:
      number;

    totalQuestions:
      number;
  };

  questions:
    AttemptQuestion[];
}


interface UserAnswer {
  questionId:
    number;

  selectedOption:
    number | null;
}


interface SimulationQuizProps {
  simulation:
    SimulationData;
}


type TimerAnchor = {
  secondsRemaining:
    number;

  monotonicStartedAt:
    number;
};


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


  return `${String(
    minutes
  ).padStart(
    2,
    "0"
  )}:${String(
    rest
  ).padStart(
    2,
    "0"
  )}`;
}


export function SimulationQuiz({
  simulation,
}: SimulationQuizProps) {
  const router =
    useRouter();


  const [
    attempt,
    setAttempt,
  ] =
    useState<
      PublicAttempt | null
    >(
      null
    );

  const [
    answers,
    setAnswers,
  ] =
    useState<
      UserAnswer[]
    >(
      []
    );

  const [
    currentIndex,
    setCurrentIndex,
  ] =
    useState(
      0
    );

  const [
    timeLeft,
    setTimeLeft,
  ] =
    useState(
      simulation.timeLimit *
      60
    );

  const [
    checkingResume,
    setCheckingResume,
  ] =
    useState(
      true
    );

  const [
    starting,
    setStarting,
  ] =
    useState(
      false
    );

  const [
    submitting,
    setSubmitting,
  ] =
    useState(
      false
    );

  const [
    actionError,
    setActionError,
  ] =
    useState(
      ""
    );


  const answersRef =
    useRef<
      UserAnswer[]
    >(
      []
    );


  const timerAnchorRef =
    useRef<
      TimerAnchor | null
    >(
      null
    );


  const submitStartedRef =
    useRef(
      false
    );


  const autoSubmitTriggeredRef =
    useRef(
      false
    );


  const attemptStorageKey =
    `sim_attempt_${simulation.id}`;


  function answersStorageKey(
    token:
      string
  ) {
    return `sim_attempt_answers_${token}`;
  }


  function clearAttemptStorage(
    token:
      string | null
  ) {
    sessionStorage.removeItem(
      attemptStorageKey
    );


    if (
      token
    ) {
      sessionStorage.removeItem(
        answersStorageKey(
          token
        )
      );
    }
  }


  function restoreAnswers(
    nextAttempt:
      PublicAttempt
  ) {
    const blank =
      nextAttempt.questions.map(
        (
          question
        ) => ({
          questionId:
            question.id,

          selectedOption:
            null,
        })
      );


    try {
      const stored =
        sessionStorage.getItem(
          answersStorageKey(
            nextAttempt.token
          )
        );


      if (
        !stored
      ) {
        return blank;
      }


      const parsed:
        unknown =
        JSON.parse(
          stored
        );


      if (
        !Array.isArray(
          parsed
        )
      ) {
        return blank;
      }


      const storedMap =
        new Map<
          number,
          number | null
        >();


      for (
        const item of
          parsed
      ) {
        if (
          typeof item !==
            "object" ||
          item ===
            null ||
          !(
            "questionId" in
            item
          ) ||
          !(
            "selectedOption" in
            item
          )
        ) {
          continue;
        }


        const questionId =
          Number(
            item.questionId
          );

        const selectedOption =
          item.selectedOption;


        if (
          !Number.isInteger(
            questionId
          ) ||
          (
            selectedOption !==
              null &&
            !Number.isInteger(
              selectedOption
            )
          )
        ) {
          continue;
        }


        storedMap.set(
          questionId,
          selectedOption ===
            null
            ? null
            : Number(
                selectedOption
              )
        );
      }


      return nextAttempt.questions.map(
        (
          question
        ) => {
          const selected =
            storedMap.get(
              question.id
            );


          const validSelected =
            selected !==
              undefined &&
            (
              selected ===
                null ||
              (
                selected >=
                  0 &&
                selected <
                  question.options.length
              )
            )
              ? selected
              : null;


          return {
            questionId:
              question.id,

            selectedOption:
              validSelected,
          };
        }
      );
    } catch {
      return blank;
    }
  }


  function activateAttempt(
    nextAttempt:
      PublicAttempt
  ) {
    const restored =
      restoreAnswers(
        nextAttempt
      );


    setAttempt(
      nextAttempt
    );

    setAnswers(
      restored
    );

    answersRef.current =
      restored;


    setCurrentIndex(
      0
    );


    setTimeLeft(
      Math.max(
        0,
        nextAttempt.secondsRemaining
      )
    );


    timerAnchorRef.current =
      {
        secondsRemaining:
          Math.max(
            0,
            nextAttempt
              .secondsRemaining
          ),

        /**
         * performance.now() é monotônico.
         *
         * Alterar manualmente o relógio do
         * computador não altera este contador.
         */
        monotonicStartedAt:
          performance.now(),
      };


    submitStartedRef.current =
      false;

    autoSubmitTriggeredRef.current =
      false;


    sessionStorage.setItem(
      attemptStorageKey,
      nextAttempt.token
    );
  }


  useEffect(
    () => {
      let cancelled =
        false;


      async function resume() {
        const storedToken =
          sessionStorage.getItem(
            attemptStorageKey
          );


        if (
          !storedToken
        ) {
          setCheckingResume(
            false
          );

          return;
        }


        try {
          const response =
            await fetch(
              `/api/simulations/${simulation.id}/attempts/${storedToken}`,
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
            response.ok &&
            data.attempt
          ) {
            activateAttempt(
              data.attempt
            );

            return;
          }


          if (
            response.status ===
              403 ||
            response.status ===
              404 ||
            response.status ===
              409 ||
            response.status ===
              410
          ) {
            clearAttemptStorage(
              storedToken
            );
          }


          if (
            data.error
          ) {
            setActionError(
              data.error
            );
          }
        } catch {
          if (
            !cancelled
          ) {
            setActionError(
              "Não foi possível verificar uma tentativa em andamento."
            );
          }
        } finally {
          if (
            !cancelled
          ) {
            setCheckingResume(
              false
            );
          }
        }
      }


      void resume();


      return () => {
        cancelled =
          true;
      };
    },
    [
      simulation.id,
    ]
  );


  useEffect(
    () => {
      if (
        !attempt
      ) {
        return;
      }


      function tick() {
        const anchor =
          timerAnchorRef.current;


        if (
          !anchor
        ) {
          return;
        }


        const elapsed =
          (
            performance.now() -
            anchor.monotonicStartedAt
          ) /
          1000;


        const remaining =
          Math.max(
            0,
            Math.ceil(
              anchor.secondsRemaining -
              elapsed
            )
          );


        setTimeLeft(
          remaining
        );


        if (
          remaining ===
            0 &&
          !autoSubmitTriggeredRef.current
        ) {
          autoSubmitTriggeredRef.current =
            true;

          void handleSubmit(
            true
          );
        }
      }


      tick();


      const interval =
        window.setInterval(
          tick,
          250
        );


      return () => {
        window.clearInterval(
          interval
        );
      };
    },
    [
      attempt?.token,
    ]
  );


  async function startSimulation() {
    setStarting(
      true
    );

    setActionError(
      ""
    );


    try {
      const response =
        await fetch(
          `/api/simulations/${simulation.id}/attempts`,
          {
            method:
              "POST",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },
          }
        );


      const data =
        await response.json();


      if (
        !response.ok ||
        !data.attempt
      ) {
        setActionError(
          data.error ||
          "Não foi possível iniciar o simulado."
        );

        return;
      }


      activateAttempt(
        data.attempt
      );
    } catch {
      setActionError(
        "Erro de conexão ao iniciar a tentativa."
      );
    } finally {
      setStarting(
        false
      );
    }
  }


  function selectOption(
    optionIndex:
      number
  ) {
    if (
      !attempt ||
      submitting ||
      timeLeft <=
        0
    ) {
      return;
    }


    const next =
      answersRef.current.map(
        (
          answer,
          index
        ) =>
          index ===
          currentIndex
            ? {
                ...answer,

                selectedOption:
                  optionIndex,
              }
            : answer
      );


    answersRef.current =
      next;

    setAnswers(
      next
    );


    sessionStorage.setItem(
      answersStorageKey(
        attempt.token
      ),
      JSON.stringify(
        next
      )
    );
  }


  function nextQuestion() {
    if (
      !attempt
    ) {
      return;
    }


    if (
      currentIndex <
      attempt.questions.length -
        1
    ) {
      setCurrentIndex(
        currentIndex +
        1
      );
    }
  }


  function prevQuestion() {
    if (
      currentIndex >
      0
    ) {
      setCurrentIndex(
        currentIndex -
        1
      );
    }
  }


  async function handleSubmit(
    timeUp:
      boolean =
      false
  ) {
    if (
      !attempt ||
      submitStartedRef.current
    ) {
      return;
    }


    submitStartedRef.current =
      true;

    setSubmitting(
      true
    );

    setActionError(
      ""
    );


    try {
      const response =
        await fetch(
          `/api/simulations/${simulation.id}/submit`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            credentials:
              "include",

            /**
             * Não enviamos score nem timeSpent.
             */
            body:
              JSON.stringify({
                attemptToken:
                  attempt.token,

                answers:
                  answersRef.current,
              }),
          }
        );


      const data =
        await response.json();


      if (
        response.ok
      ) {
        /**
         * O servidor já persistiu o resultado.
         *
         * sessionStorage continua sendo usado apenas
         * durante uma tentativa aberta para recuperar
         * respostas locais após F5.
         *
         * Resultado concluído não depende mais do
         * navegador.
         */
        const resultId =
          Number(
            data
              ?.result
              ?.id
          );


        clearAttemptStorage(
          attempt.token
        );


        if (
          !Number.isInteger(
            resultId
          ) ||
          resultId <=
            0
        ) {
          setAttempt(
            null
          );

          setActionError(
            "O simulado foi concluído, mas o servidor não retornou o identificador do resultado."
          );

          return;
        }


        router.replace(
          `/simulados/${simulation.id}/resultado/${resultId}`
        );


        return;
      }


      setActionError(
        data.error ||
        "Erro ao finalizar o simulado."
      );


      const terminal =
        data.reason ===
          "attempt_expired" ||
        data.reason ===
          "attempt_revoked" ||
        data.reason ===
          "access_revoked" ||
        data.reason ===
          "attempt_completed" ||
        data.reason ===
          "attempt_not_found";


      if (
        terminal
      ) {
        clearAttemptStorage(
          attempt.token
        );

        setAttempt(
          null
        );

        return;
      }


      /**
       * Erro não terminal, por exemplo conexão
       * ou payload. Permitimos nova tentativa
       * manual de finalização.
       */
      submitStartedRef.current =
        false;
    } catch {
      setActionError(
        "Erro de conexão ao finalizar. Tente novamente."
      );

      submitStartedRef.current =
        false;
    } finally {
      setSubmitting(
        false
      );
    }
  }


  if (
    checkingResume
  ) {
    return (
      <main className="simulation-page">
        <section className="container">
          <div className="sim-start-card">
            <h2>
              Verificando tentativa em andamento...
            </h2>

            <p>
              Aguarde alguns instantes.
            </p>
          </div>
        </section>
      </main>
    );
  }


  if (
    !attempt
  ) {
    return (
      <main className="simulation-page">
        <section className="simulation-hero">
          <div className="container">
            <span className="eyebrow eyebrow-light">
              <i />{" "}
              {simulation.bank}
            </span>

            <h1>
              {simulation.title}
            </h1>

            {simulation.description && (
              <p>
                {simulation.description}
              </p>
            )}
          </div>
        </section>

        <section className="container">
          <div className="sim-start-card">
            <h2>
              Preparado para começar?
            </h2>

            <div className="sim-info-grid">
              <div>
                <small>
                  QUESTÕES
                </small>

                <strong>
                  {simulation.totalQuestions}
                </strong>
              </div>

              <div>
                <small>
                  TEMPO
                </small>

                <strong>
                  {simulation.timeLimit} min
                </strong>
              </div>

              <div>
                <small>
                  BANCA
                </small>

                <strong>
                  {simulation.bank}
                </strong>
              </div>
            </div>

            <p>
              ⚠ O relógio oficial começa no servidor ao clicar em iniciar. Recarregar a página não reinicia o tempo.
            </p>

            {actionError && (
              <div className="auth-error">
                {actionError}
              </div>
            )}

            <button
              type="button"
              className="button button-primary sim-start-btn"
              onClick={() =>
                void startSimulation()
              }
              disabled={
                starting
              }
            >
              {starting
                ? "Iniciando..."
                : "Iniciar simulado →"}
            </button>
          </div>
        </section>
      </main>
    );
  }


  const questions =
    attempt.questions;


  const currentQuestion =
    questions[
      currentIndex
    ];


  const currentAnswer =
    answers[
      currentIndex
    ];


  if (
    !currentQuestion
  ) {
    return (
      <main className="simulation-page">
        <div className="container">
          <h2>
            Tentativa inválida.
          </h2>
        </div>
      </main>
    );
  }


  const answeredCount =
    answers.filter(
      (
        answer
      ) =>
        answer.selectedOption !==
        null
    ).length;


  const progress =
    (
      (
        currentIndex +
        1
      ) /
      questions.length
    ) *
    100;


  const totalSeconds =
    attempt
      .simulation
      .timeLimit *
    60;


  const timePercentage =
    totalSeconds >
    0
      ? (
          timeLeft /
          totalSeconds
        ) *
        100
      : 0;


  const timeWarning =
    timePercentage <
    20;


  return (
    <main className="quiz-page">
      <section className="quiz-hero">
        <div className="container">
          <span className="eyebrow eyebrow-light">
            <i />{" "}
            {attempt.simulation.bank}
          </span>

          <h1>
            {attempt.simulation.title}
          </h1>
        </div>
      </section>

      <section className="quiz-shell container">
        {actionError && (
          <div className="auth-error">
            {actionError}
          </div>
        )}

        <header>
          <div>
            <span>
              QUESTÃO{" "}
              {currentIndex +
                1}{" "}
              DE{" "}
              {questions.length}
            </span>

            <div className="quiz-progress">
              <i
                style={{
                  width:
                    `${progress}%`,
                }}
              />
            </div>
          </div>

          <strong
            className={
              timeWarning
                ? "time-warning"
                : ""
            }
          >
            ⏱{" "}
            {formatTime(
              timeLeft
            )}
          </strong>
        </header>

        <div className="quiz-content">
          <aside>
            <span>
              DISCIPLINA
            </span>

            <b>
              {currentQuestion.subject}
            </b>

            {currentQuestion.difficulty && (
              <small
                className={`diff-${currentQuestion.difficulty}`}
              >
                {currentQuestion.difficulty ===
                "easy"
                  ? "Fácil"
                  : currentQuestion.difficulty ===
                      "medium"
                    ? "Médio"
                    : "Difícil"}
              </small>
            )}

            <hr />

            <div className="quiz-nav-stats">
              <small>
                Respondidas
              </small>

              <strong>
                {answeredCount}/
                {questions.length}
              </strong>
            </div>

            <div className="quiz-question-nav">
              {questions.map(
                (
                  question,
                  index
                ) => (
                  <button
                    type="button"
                    key={
                      question.id
                    }
                    className={`q-nav-btn ${
                      index ===
                      currentIndex
                        ? "current"
                        : ""
                    } ${
                      answers[index]
                        ?.selectedOption !==
                      null
                        ? "answered"
                        : ""
                    }`}
                    onClick={() =>
                      setCurrentIndex(
                        index
                      )
                    }
                  >
                    {index +
                      1}
                  </button>
                )
              )}
            </div>
          </aside>

          <article>
            <span>
              {attempt.simulation.bank.toUpperCase()}{" "}
              • QUESTÃO{" "}
              {currentIndex +
                1}
            </span>

            <h2>
              {currentQuestion.questionText}
            </h2>

            <div className="answers">
              {currentQuestion.options.map(
                (
                  option,
                  optionIndex
                ) => (
                  <button
                    type="button"
                    key={
                      optionIndex
                    }
                    onClick={() =>
                      selectOption(
                        optionIndex
                      )
                    }
                    className={
                      currentAnswer
                        ?.selectedOption ===
                      optionIndex
                        ? "selected"
                        : ""
                    }
                    disabled={
                      submitting ||
                      timeLeft <=
                        0
                    }
                  >
                    <b>
                      {String.fromCharCode(
                        65 +
                          optionIndex
                      )}
                    </b>

                    {option}
                  </button>
                )
              )}
            </div>

            <footer className="quiz-actions">
              <button
                type="button"
                className="button button-ghost"
                onClick={
                  prevQuestion
                }
                disabled={
                  currentIndex ===
                  0 ||
                  submitting
                }
              >
                ← Anterior
              </button>

              {currentIndex <
              questions.length -
                1 ? (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={
                    nextQuestion
                  }
                  disabled={
                    submitting
                  }
                >
                  Próxima →
                </button>
              ) : (
                <button
                  type="button"
                  className="button button-accent"
                  onClick={() =>
                    void handleSubmit(
                      timeLeft <=
                        0
                    )
                  }
                  disabled={
                    submitting ||
                    (
                      timeLeft >
                        0 &&
                      answeredCount <
                        questions.length
                    )
                  }
                  title={
                    timeLeft >
                      0 &&
                    answeredCount <
                      questions.length
                      ? `Responda todas as ${questions.length} questões`
                      : "Finalizar simulado"
                  }
                >
                  {submitting
                    ? "Enviando..."
                    : timeLeft <=
                        0
                      ? "Tentar finalizar novamente"
                      : "Finalizar simulado ✓"}
                </button>
              )}
            </footer>
          </article>
        </div>
      </section>
    </main>
  );
}