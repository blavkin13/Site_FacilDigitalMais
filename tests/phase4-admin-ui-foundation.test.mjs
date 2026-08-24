import {
  describe,
  test,
} from "node:test";

import assert from "node:assert/strict";

import {
  readFile,
} from "node:fs/promises";

import {
  join,
} from "node:path";


const root =
  process.cwd();


async function readProjectFile(
  ...parts
) {
  return readFile(
    join(
      root,
      ...parts
    ),
    "utf8"
  );
}


describe(
  "Fase 4.2A - Fundação visual de Simulados",
  () => {
    test(
      "dashboard deve expor a aba administrativa de Simulados",
      async () => {
        const source =
          await readProjectFile(
            "components",
            "admin-dashboard.tsx"
          );


        assert.match(
          source,
          /AdminSimulados/
        );


        assert.match(
          source,
          /\|\s*"simulados"/
        );


        assert.match(
          source,
          /📝\s*Simulados/
        );
      }
    );


    test(
      "área de simulados deve consumir apenas endpoints administrativos",
      async () => {
        const source =
          await readProjectFile(
            "components",
            "admin-simulados.tsx"
          );


        assert.match(
          source,
          /\/api\/admin\/simulations/
        );


        assert.match(
          source,
          /\/api\/admin\/products/
        );


        assert.match(
          source,
          /\/api\/admin\/questions/
        );


        /**
         * A interface administrativa nunca deve
         * utilizar as APIs públicas destinadas
         * ao aluno.
         */
        assert.doesNotMatch(
          source,
          /["'`]\/api\/simulations(?:\/|["'`])/
        );
      }
    );


    test(
      "área deve possuir navegação entre Simulados e Banco de Questões",
      async () => {
        const source =
          await readProjectFile(
            "components",
            "admin-simulados.tsx"
          );


        assert.match(
          source,
          /Simulados e banco de questões/
        );


        assert.match(
          source,
          /Banco de Questões/
        );


        assert.match(
          source,
          /admin-sim-tabs/
        );
      }
    );


    test(
      "listagem deve exibir métricas do modelo normalizado",
      async () => {
        const source =
          await readProjectFile(
            "components",
            "admin-simulados.tsx"
          );


        assert.match(
          source,
          /questionCount/
        );


        assert.match(
          source,
          /productCount/
        );


        assert.match(
          source,
          /productIds/
        );


        assert.match(
          source,
          /publishedAt/
        );
      }
    );


    test(
      "banco de questões deve permitir criar, editar, arquivar e reativar",
      async () => {
        const source =
          await readProjectFile(
            "components",
            "admin-question-bank.tsx"
          );


        /**
         * O teste deve tolerar formatação automática
         * e quebras de linha do TSX.
         */
        assert.match(
          source,
          /method:\s*form\.id\s*===\s*null\s*\?\s*"POST"\s*:\s*"PATCH"/
        );


        assert.match(
          source,
          /method:\s*"DELETE"/
        );


        assert.match(
          source,
          /active:\s*true/
        );


        assert.match(
          source,
          /Arquivar/
        );


        assert.match(
          source,
          /Reativar/
        );
      }
    );


    test(
      "editor de questões deve respeitar 2 a 5 alternativas e gabarito explícito",
      async () => {
        const source =
          await readProjectFile(
            "components",
            "admin-question-bank.tsx"
          );


        assert.match(
          source,
          /current\.options\.length\s*>=\s*5/
        );


        assert.match(
          source,
          /current\.options\.length\s*<=\s*2/
        );


        assert.match(
          source,
          /type="radio"/
        );


        assert.match(
          source,
          /correctAnswer/
        );
      }
    );


    test(
      "fundação visual deve ter evoluído para o editor real da Fase 4.2B",
      async () => {
        const source =
          await readProjectFile(
            "components",
            "admin-simulados.tsx"
          );


        /**
         * O placeholder existia apenas durante a 4.2A.
         *
         * Depois da 4.2B ele não deve reaparecer.
         */
        assert.doesNotMatch(
          source,
          /Montador em preparação/
        );


        assert.doesNotMatch(
          source,
          /Lote 4\.2B entra/
        );


        /**
         * A evolução esperada é a integração
         * do editor real.
         */
        assert.match(
          source,
          /AdminSimulationEditor/
        );


        assert.match(
          source,
          /openNewSimulation/
        );


        assert.match(
          source,
          /openSimulation/
        );


        assert.match(
          source,
          /\+\s*Novo simulado/
        );
      }
    );


    test(
      "CSS da administração de simulados e questões deve permanecer registrado",
      async () => {
        const css =
          await readProjectFile(
            "app",
            "extra.css"
          );


        /**
         * A fundação visual criada na 4.2A
         * deve continuar presente mesmo após
         * a adição do editor da 4.2B.
         */
        assert.match(
          css,
          /FASE 4\.2A — ADMIN SIMULADOS E QUESTÕES/
        );


        assert.match(
          css,
          /\.admin-sim-root/
        );


        assert.match(
          css,
          /\.admin-question-option-row/
        );
      }
    );


    test(
      "package deve manter a regressão da Fase 4.2A dentro do agregador administrativo",
      async () => {
        const packageJson =
          JSON.parse(
            await readProjectFile(
              "package.json"
            )
          );


        const scripts =
          packageJson.scripts ||
          {};


        assert.ok(
          scripts[
            "test:phase4-admin-ui-foundation"
          ],
          "package.json deve possuir test:phase4-admin-ui-foundation"
        );


        assert.ok(
          scripts[
            "test:phase4-admin-ui"
          ],
          "package.json deve possuir o agregador test:phase4-admin-ui"
        );


        /**
         * A regressão da 4.2A deve continuar
         * pertencendo ao agregador da interface.
         */
        assert.ok(
          scripts[
            "test:phase4-admin-ui"
          ].includes(
            "test:phase4-admin-ui-foundation"
          ),
          "test:phase4-admin-ui deve executar a regressão da Fase 4.2A"
        );


        /**
         * Depois da 4.2B, test:all não precisa chamar
         * a suíte foundation diretamente.
         *
         * A cadeia correta é:
         *
         * test:all
         *   ↓
         * test:phase4-admin-ui
         *   ↓
         * foundation + builder
         */
        assert.ok(
          scripts[
            "test:all"
          ],
          "package.json deve possuir test:all"
        );


        assert.ok(
          scripts[
            "test:all"
          ].includes(
            "test:phase4-admin-ui"
          ),
          "test:all deve executar o agregador visual da Fase 4.2"
        );
      }
    );
  }
);