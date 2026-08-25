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
  "Fase 4.2B - Editor e montador administrativo de Simulados",
  () => {
    test(
      "admin de simulados deve integrar o editor completo",
      async () => {
        const source =
          await readProjectFile(
            "components",
            "admin-simulados.tsx"
          );


        assert.match(
          source,
          /AdminSimulationEditor/
        );


        assert.match(
          source,
          /\+\s*Novo simulado/
        );


        assert.match(
          source,
          /openSimulation/
        );


        assert.doesNotMatch(
          source,
          /Montador em preparação/
        );
      }
    );


    test(
      "editor deve utilizar exclusivamente APIs administrativas",
      async () => {
        const source =
          await readProjectFile(
            "components",
            "admin-simulation-editor.tsx"
          );


        assert.match(
          source,
          /\/api\/admin\/simulations/
        );


        assert.match(
          source,
          /\/products/
        );


        assert.match(
          source,
          /\/questions/
        );


        assert.doesNotMatch(
          source,
          /fetch\(\s*["'`]\/api\/simulations/
        );
      }
    );


    test(
      "novo simulado deve ser persistido por POST e edição por PATCH",
      async () => {
        const source =
          await readProjectFile(
            "components",
            "admin-simulation-editor.tsx"
          );


        assert.match(
          source,
          /method:\s*"POST"/
        );


        assert.match(
          source,
          /method:\s*"PATCH"/
        );


        assert.match(
          source,
          /workingId\s*===\s*null/
        );


        assert.match(
          source,
          /setWorkingId/
        );
      }
    );


    test(
      "editor deve persistir apostilas e questões pelas relações normalizadas",
      async () => {
        const source =
          await readProjectFile(
            "components",
            "admin-simulation-editor.tsx"
          );


        assert.match(
          source,
          /productIds:\s*selectedProductIds/
        );


        assert.match(
          source,
          /questionIds:\s*selectedQuestionIds/
        );


        assert.match(
          source,
          /method:\s*"PUT"/
        );


        assert.match(
          source,
          /persistRelations/
        );
      }
    );


    test(
      "montador deve adicionar remover e reordenar questões",
      async () => {
        const source =
          await readProjectFile(
            "components",
            "admin-simulation-editor.tsx"
          );


        assert.match(
          source,
          /function\s+addQuestion/
        );


        assert.match(
          source,
          /function\s+removeQuestion/
        );


        assert.match(
          source,
          /function\s+moveQuestion/
        );


        assert.match(
          source,
          /Mover questão para cima/
        );


        assert.match(
          source,
          /Mover questão para baixo/
        );
      }
    );


    test(
      "banco do montador não deve oferecer questões arquivadas",
      async () => {
        const source =
          await readProjectFile(
            "components",
            "admin-simulation-editor.tsx"
          );


        assert.match(
          source,
          /if\s*\(\s*!question\.active\s*\)/
        );


        assert.match(
          source,
          /return\s+false/
        );
      }
    );


    test(
      "checklist deve reutilizar a regra central de publicação",
      async () => {
        const source =
          await readProjectFile(
            "components",
            "admin-simulation-editor.tsx"
          );


        assert.match(
          source,
          /getSimulationPublicationIssues/
        );


        assert.match(
          source,
          /readyForPublication/
        );


        assert.match(
          source,
          /publicationIssues/
        );


        assert.match(
          source,
          /Pronto para publicar/
        );
      }
    );


    test(
      "publicação deve persistir relações antes de ativar o simulado",
      async () => {
        const source =
          await readProjectFile(
            "components",
            "admin-simulation-editor.tsx"
          );


        const persistPosition =
          source.indexOf(
            "await persistEditorState()"
          );


        const activationPosition =
          source.indexOf(
            "active:\n                  true"
          );


        assert.ok(
          persistPosition >=
            0,
          "Editor deve persistir o estado antes da publicação."
        );


        assert.ok(
          activationPosition >
            persistPosition,
          "Ativação deve ocorrer somente depois da persistência das relações."
        );
      }
    );


    test(
      "editor deve permitir despublicar sem exclusão física",
      async () => {
        const source =
          await readProjectFile(
            "components",
            "admin-simulation-editor.tsx"
          );


        assert.match(
          source,
          /function\s+unpublishSimulation/
        );


        assert.match(
          source,
          /active:\s*false/
        );


        assert.match(
          source,
          /Despublicar/
        );


        assert.doesNotMatch(
          source,
          /method:\s*"DELETE"/
        );
      }
    );


    test(
      "prévia deve mostrar ordem das questões e gabarito somente no ambiente administrativo",
      async () => {
        const source =
          await readProjectFile(
            "components",
            "admin-simulation-editor.tsx"
          );


        assert.match(
          source,
          /Prévia administrativa/
        );


        assert.match(
          source,
          /question\.correctAnswer/
        );


        assert.match(
          source,
          /Gabarito/
        );


        assert.match(
          source,
          /selectedQuestions\.map/
        );
      }
    );


    test(
      "CSS do editor e montador deve estar registrado",
      async () => {
        const css =
          await readProjectFile(
            "app",
            "extra.css"
          );


        assert.match(
          css,
          /FASE 4\.2B — EDITOR E MONTADOR DE SIMULADOS/
        );


        assert.match(
          css,
          /\.admin-simulation-editor/
        );


        assert.match(
          css,
          /\.admin-simulation-builder/
        );


        assert.match(
          css,
          /\.admin-simulation-publication-grid/
        );
      }
    );


    test(
      "package deve executar as duas suítes visuais da Fase 4.2",
      async () => {
        const packageJson =
          JSON.parse(
            await readProjectFile(
              "package.json"
            )
          );


        assert.ok(
          packageJson.scripts[
            "test:phase4-admin-builder"
          ]
        );


        assert.ok(
          packageJson.scripts[
            "test:phase4-admin-ui"
          ]
        );


        assert.ok(
          packageJson.scripts[
            "test:phase4-admin-ui"
          ].includes(
            "test:phase4-admin-ui-foundation"
          )
        );


        assert.ok(
          packageJson.scripts[
            "test:phase4-admin-ui"
          ].includes(
            "test:phase4-admin-builder"
          )
        );


        assert.ok(
          packageJson.scripts[
            "test:all"
          ].includes(
            "test:phase4-admin-ui"
          )
        );
      }
    );
  }
);