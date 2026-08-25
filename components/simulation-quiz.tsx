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


/**
 * sessionStorage é apenas uma camada auxiliar
 * de UX.
 *
 * A tentativa, o relógio oficial e o resultado
 * continuam pertencendo ao servidor.
 *
 * Alguns navegadores podem bloquear storage por
 * configuração de privacidade, política ou falta
 * de espaço. Nenhuma dessas situações pode
 * interromper uma prova em andamento.
 */
function safeSessionGet(
  key:
    string
) {
  try {
    if (
      typeof window ===
      "undefined"
    ) {
      return null;
    }


    return window
      .sessionStorage
      .getItem(
        key
      );
  } catch {
    return null;
  }
}


function safeSessionSet(
  key:
    string,
  value:
    string
) {
  try {
    if (
      typeof window ===
      "undefined"
    ) {
      return;
    }


    window
      .sessionStorage
      .setItem(
        key,
        value
      );
  } catch {
    /**
     * Falha de storage não pode interromper
     * a execução da prova.
     */
  }
}


function safeSessionRemove(
  key:
    string
) {
  try {
    if (
      typeof window ===
      "undefined"
    ) {
      return;
    }


    window
      .sessionStorage
      .removeItem(
        key
      );
  } catch {
    /**
     * Falha de storage não bloqueia
     * a aplicação.
     */
  }
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


  /**
   * Mantemos uma referência sincronizada das
   * respostas para que callbacks assíncronos,
   * inclusive o auto-submit, sempre utilizem
   * o estado mais recente.
   */
  const answersRef =
    useRef<
      UserAnswer[]
    >(
      []
    );


  /**
   * O contador visual não depende de Date.now().
   *
   * O servidor entrega secondsRemaining e o
   * navegador apenas projeta a passagem do tempo
   * utilizando performance.now(), que é monotônico.
   */
  const timerAnchorRef =
    useRef<
      TimerAnchor | null
    >(
      null
    );


  /**
   * Impede dois submits concorrentes disparados
   * pelo mesmo componente.
   *
   * O servidor ainda possui sua própria proteção
   * transacional e UNIQUE por attempt_id.
   */
  const submitStartedRef =
    useRef(
      false
    );


  /**
   * Impede o timer de disparar o auto-submit
   * repetidamente quando permanecer em 00:00.
   */
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
    safeSessionRemove(
      attemptStorageKey
    );


    if (
      token
    ) {
      safeSessionRemove(
        answersStorageKey(
          token
        )
      );
    }
  }


  /**
   * Respostas são restauradas apenas como
   * conveniência ao usuário.
   *
   * Nunca confiamos nesses dados para:
   *
   * - definir questões oficiais;
   * - definir gabarito;
   * - definir score;
   * - definir tempo.
   *
   * O servidor continua sendo a autoridade.
   */
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
        safeSessionGet(
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


      /**
       * Somente questões presentes no snapshot
       * oficial atual são restauradas.
       *
       * Qualquer dado estranho colocado
       * manualmente no sessionStorage é ignorado.
       */
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


  /**
   * Ativa ou reativa uma tentativa retornada
   * pelo servidor.
   *
   * A função também ancora novamente o contador
   * monotônico usando secondsRemaining recebido
   * da API.
   */
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


    const remaining =
      Math.max(
        0,
        nextAttempt
          .secondsRemaining
      );


    setTimeLeft(
      remaining
    );


    timerAnchorRef.current =
      {
        secondsRemaining:
          remaining,

        /**
         * performance.now() é monotônico.
         *
         * Alterar manualmente a hora do
         * computador não devolve tempo à prova.
         */
        monotonicStartedAt:
          performance.now(),
      };


    submitStartedRef.current =
      false;


    autoSubmitTriggeredRef.current =
      false;


    /**
     * O token local melhora a velocidade do
     * próximo F5.
     *
     * Ele não é obrigatório: /attempts/active
     * consegue descobrir a tentativa pelo
     * próprio servidor.
     */
    safeSessionSet(
      attemptStorageKey,
      nextAttempt.token
    );
  }


  /**
   * Recuperação inicial da tentativa.
   *
   * Caso exista token no navegador:
   *   GET /attempts/{token}
   *
   * Caso não exista:
   *   GET /attempts/active
   *
   * Isso permite retomar a prova mesmo após:
   *
   * - fechar a aba;
   * - reiniciar o navegador;
   * - limpar o sessionStorage;
   *
   * desde que exista uma tentativa in_progress
   * válida no servidor.
   */
  useEffect(
    () => {
      let cancelled =
        false;


      async function resume() {
        const storedToken =
          safeSessionGet(
            attemptStorageKey
          );


        const endpoint =
          storedToken
            ? `/api/simulations/${simulation.id}/attempts/${storedToken}`
            : `/api/simulations/${simulation.id}/attempts/active`;


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


          /**
           * Token local antigo deixa de ser útil
           * quando a tentativa:
           *
           * - expirou;
           * - terminou;
           * - foi revogada;
           * - não existe.
           */
          if (
            storedToken &&
            (
              response.status ===
                403 ||
              response.status ===
                404 ||
              response.status ===
                409 ||
              response.status ===
                410
            )
          ) {
            clearAttemptStorage(
              storedToken
            );
          }


          /**
           * 404 em /active é completamente normal:
           * significa apenas que o aluno ainda
           * não iniciou uma prova.
           */
          if (
            !storedToken &&
            response.status ===
              404
          ) {
            return;
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


  /**
   * Cronômetro visual.
   *
   * Ele NÃO é autoridade de tempo.
   *
   * O tempo oficial permanece:
   *
   * started_at
   * expires_at
   *
   * armazenados no servidor.
   */
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


        /**
         * Quando o relógio visual chega a zero,
         * tentamos finalizar automaticamente.
         *
         * O servidor decide se o submit ainda
         * está dentro da janela permitida.
         */
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


  /**
   * Quando a aba volta a ficar visível ou a
   * janela recupera foco, consultamos novamente
   * o servidor.
   *
   * Isso corrige situações em que navegadores,
   * principalmente em dispositivos móveis,
   * suspendem timers JavaScript em background.
   */
  useEffect(
    () => {
      const candidateToken =
        attempt?.token;


      if (
        typeof candidateToken !==
          "string" ||
        candidateToken.length ===
          0
      ) {
        return;
      }


      /**
       * Depois da validação acima criamos uma
       * referência explicitamente string.
       *
       * Isso evita que o TypeScript volte a
       * considerar attempt?.token como undefined
       * dentro das funções assíncronas aninhadas.
       */
      const token:
        string =
        candidateToken;


      let cancelled =
        false;


      let syncing =
        false;


      async function resyncAttempt() {
        if (
          syncing ||
          cancelled
        ) {
          return;
        }


        syncing =
          true;


        try {
          const response =
            await fetch(
              `/api/simulations/${simulation.id}/attempts/${token}`,
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
            const nextAttempt:
              PublicAttempt =
              data.attempt;


            /**
             * Não chamamos activateAttempt aqui
             * porque isso restauraria navegação
             * e respostas desnecessariamente.
             *
             * Precisamos apenas atualizar os
             * dados autoritativos da tentativa
             * e reancorar o relógio.
             */
            setAttempt(
              nextAttempt
            );


            const authoritativeRemaining =
              Math.max(
                0,
                nextAttempt
                  .secondsRemaining
              );


            setTimeLeft(
              authoritativeRemaining
            );


            timerAnchorRef.current =
              {
                secondsRemaining:
                  authoritativeRemaining,

                monotonicStartedAt:
                  performance.now(),
              };


            return;
          }


          /**
           * Estes status representam situações
           * terminais para a tentativa atual.
           */
          const terminal =
            response.status ===
              403 ||
            response.status ===
              404 ||
            response.status ===
              409 ||
            response.status ===
              410;


          if (
            terminal
          ) {
            clearAttemptStorage(
              token
            );


            setAttempt(
              null
            );


            answersRef.current =
              [];


            setAnswers(
              []
            );


            setActionError(
              data.error ||
              "Esta tentativa não está mais disponível."
            );
          }
        } catch {
          /**
           * Uma falha temporária de internet
           * não encerra a prova.
           *
           * O relógio local monotônico continua
           * apenas para exibição.
           *
           * O servidor fará a validação oficial
           * quando houver novo contato.
           */
        } finally {
          syncing =
            false;
        }
      }


      function handleVisibilityChange() {
        if (
          document.visibilityState ===
          "visible"
        ) {
          void resyncAttempt();
        }
      }


      function handleFocus() {
        void resyncAttempt();
      }


      document.addEventListener(
        "visibilitychange",
        handleVisibilityChange
      );


      window.addEventListener(
        "focus",
        handleFocus
      );


      return () => {
        cancelled =
          true;


        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange
        );


        window.removeEventListener(
          "focus",
          handleFocus
        );
      };
    },
    [
      attempt?.token,
      simulation.id,
    ]
  );


  /**
   * Proteção de UX contra fechamento acidental.
   *
   * O navegador decide qual mensagem exibir.
   *
   * Essa proteção NÃO é usada como mecanismo
   * de segurança: fechar a aba não encerra nem
   * reinicia a tentativa server-side.
   */
  useEffect(
    () => {
      if (
        !attempt ||
        submitting
      ) {
        return;
      }


      function handleBeforeUnload(
        event:
          BeforeUnloadEvent
      ) {
        event.preventDefault();


        event.returnValue =
          "";
      }


      window.addEventListener(
        "beforeunload",
        handleBeforeUnload
      );


      return () => {
        window.removeEventListener(
          "beforeunload",
          handleBeforeUnload
        );
      };
    },
    [
      attempt?.token,
      submitting,
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
      /**
       * O endpoint é idempotente do ponto de
       * vista funcional:
       *
       * - cria nova tentativa se não houver;
       * - retoma a existente se já houver uma
       *   tentativa in_progress.
       */
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


    /**
     * Persistência local das respostas melhora
     * recuperação após F5.
     *
     * Falha de storage é silenciosamente
     * tolerada pelos helpers seguros.
     */
    safeSessionSet(
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
    /**
     * timeUp representa somente o motivo visual
     * do disparo.
     *
     * Ele NÃO é enviado ao backend e NÃO decide
     * se a tentativa expirou.
     */
    void timeUp;


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
             * O cliente envia somente:
             *
             * - attemptToken;
             * - answers.
             *
             * Não enviamos:
             *
             * - score;
             * - timeSpent;
             * - correctAnswer;
             * - expiresAt adulterável.
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
         * O resultado já foi persistido pelo
         * servidor antes desta resposta.
         *
         * O sessionStorage não é usado para
         * transportar resultado concluído.
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
          /**
           * O backend afirma que concluiu, mas
           * não retornou o identificador necessário
           * para consultar o resultado persistente.
           *
           * Não tentamos reenviar a mesma prova.
           */
          setAttempt(
            null
          );


          answersRef.current =
            [];


          setAnswers(
            []
          );


          setActionError(
            "O simulado foi concluído, mas o servidor não retornou o identificador do resultado."
          );


          return;
        }


        /**
         * replace evita deixar a prova concluída
         * como entrada anterior no histórico do
         * navegador.
         */
        router.replace(
          `/simulados/${simulation.id}/resultado/${resultId}`
        );


        return;
      }


      setActionError(
        data.error ||
        "Erro ao finalizar o simulado."
      );


      /**
       * Estes estados impedem qualquer novo
       * submit para a mesma tentativa no cliente.
       */
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


        answersRef.current =
          [];


        setAnswers(
          []
        );


        return;
      }


      /**
       * Erros não terminais podem ser corrigidos
       * ou reenviados.
       *
       * Exemplo:
       * falha momentânea ou payload rejeitado.
       */
      submitStartedRef.current =
        false;


      /**
       * Caso o primeiro auto-submit tenha falhado
       * por motivo não terminal, permitimos que o
       * usuário tente finalizar novamente.
       */
      if (
        timeLeft <=
        0
      ) {
        autoSubmitTriggeredRef.current =
          true;
      }
    } catch {
      setActionError(
        "Erro de conexão ao finalizar. Tente novamente."
      );


      /**
       * Nenhum resultado foi confirmado pelo
       * navegador, portanto permitimos retry.
       *
       * Mesmo que a primeira requisição tenha
       * chegado ao servidor, a tentativa concluída
       * será protegida server-side contra duplicação.
       */
      submitStartedRef.current =
        false;
    } finally {
      setSubmitting(
        false
      );
    }
  }


  /**
   * Enquanto verificamos o servidor não exibimos
   * o botão de iniciar.
   *
   * Isso evita que o usuário tente começar uma
   * segunda prova antes de descobrirmos uma
   * tentativa já aberta.
   */
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


  /**
   * Estado pré-prova.
   */
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
              ⚠ O relógio oficial começa no servidor ao clicar em iniciar. Recarregar ou fechar a página não reinicia o tempo.
            </p>


            {actionError && (
              <div
                className="auth-error"
                role="alert"
              >
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


  /**
   * A partir daqui usamos exclusivamente
   * as questões do snapshot da tentativa.
   */
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


  /**
   * Snapshot sem questão correspondente é uma
   * situação defensiva excepcional.
   */
  if (
    !currentQuestion
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
          <div
            className="auth-error"
            role="alert"
          >
            <h2>
              Tentativa inválida.
            </h2>

            <p>
              Não foi possível localizar a questão atual desta tentativa.
            </p>
          </div>
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
          <div
            className="auth-error"
            role="alert"
          >
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


            <div
              className="quiz-progress"
              role="progressbar"
              aria-label="Progresso do simulado"
              aria-valuemin={
                1
              }
              aria-valuemax={
                questions.length
              }
              aria-valuenow={
                currentIndex +
                1
              }
            >
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
            role="timer"
            aria-label={`Tempo restante: ${formatTime(
              timeLeft
            )}`}
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


            <div
              className="quiz-question-nav"
              aria-label="Navegação entre questões"
            >
              {questions.map(
                (
                  question,
                  index
                ) => {
                  const answered =
                    answers[index]
                      ?.selectedOption !==
                    null &&
                    answers[index]
                      ?.selectedOption !==
                    undefined;


                  return (
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
                        answered
                          ? "answered"
                          : ""
                      }`}
                      onClick={() =>
                        setCurrentIndex(
                          index
                        )
                      }
                      aria-current={
                        index ===
                        currentIndex
                          ? "step"
                          : undefined
                      }
                      aria-label={`Ir para questão ${
                        index +
                        1
                      }${
                        answered
                          ? ", respondida"
                          : ", não respondida"
                      }`}
                      disabled={
                        submitting
                      }
                    >
                      {index +
                        1}
                    </button>
                  );
                }
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


            <div
              className="answers"
              role="group"
              aria-label={`Alternativas da questão ${
                currentIndex +
                1
              }`}
            >
              {currentQuestion.options.map(
                (
                  option,
                  optionIndex
                ) => {
                  const selected =
                    currentAnswer
                      ?.selectedOption ===
                    optionIndex;


                  return (
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
                        selected
                          ? "selected"
                          : ""
                      }
                      disabled={
                        submitting ||
                        timeLeft <=
                          0
                      }
                      aria-pressed={
                        selected
                      }
                      aria-label={`Alternativa ${String.fromCharCode(
                        65 +
                          optionIndex
                      )}: ${option}`}
                    >
                      <b
                        aria-hidden="true"
                      >
                        {String.fromCharCode(
                          65 +
                            optionIndex
                        )}
                      </b>

                      {option}
                    </button>
                  );
                }
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