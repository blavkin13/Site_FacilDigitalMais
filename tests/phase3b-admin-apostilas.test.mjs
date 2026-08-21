import {
  describe,
  test,
} from "node:test";

import assert from "node:assert/strict";

import {
  existsSync,
  readFileSync,
} from "node:fs";

import {
  join,
} from "node:path";


function readProjectFile(
  ...segments
) {
  return readFileSync(
    join(
      process.cwd(),
      ...segments
    ),
    "utf8"
  );
}


describe(
  "Fase 3B - Interface administrativa de Apostilas",
  () => {
    test(
      "componente AdminApostilas deve existir",
      () => {
        assert.ok(
          existsSync(
            join(
              process.cwd(),
              "components",
              "admin-apostilas.tsx"
            )
          )
        );
      }
    );


    test(
      "dashboard deve possuir aba Apostilas",
      () => {
        const content =
          readProjectFile(
            "components",
            "admin-dashboard.tsx"
          );


        assert.match(
          content,
          /AdminApostilas/
        );


        assert.match(
          content,
          /"apostilas"/
        );


        assert.match(
          content,
          /📚 Apostilas/
        );


        assert.doesNotMatch(
          content,
          /function\s+AdminProducts\s*\(/
        );
      }
    );


    test(
      "interface deve consumir API administrativa com sessão",
      () => {
        const content =
          readProjectFile(
            "components",
            "admin-apostilas.tsx"
          );


        assert.match(
          content,
          /\/api\/admin\/products/
        );


        assert.match(
          content,
          /credentials:\s*["']include["']/
        );


        assert.match(
          content,
          /fetchProducts/
        );
      }
    );


    test(
      "interface deve oferecer criação de rascunho",
      () => {
        const content =
          readProjectFile(
            "components",
            "admin-apostilas.tsx"
          );


        assert.match(
          content,
          /\+ Nova apostila/
        );


        assert.match(
          content,
          /Criar rascunho/
        );


        assert.match(
          content,
          /method:\s*editing[\s\S]*["']PATCH["'][\s\S]*["']POST["']/
        );
      }
    );


    test(
      "editor deve preservar dados editoriais essenciais",
      () => {
        const content =
          readProjectFile(
            "components",
            "admin-apostilas.tsx"
          );


        const fields = [
          "title",
          "slug",
          "shortTitle",
          "category",
          "bank",
          "level",
          "pages",
          "questions",
          "oldPrice",
          "price",
          "pixPrice",
          "updated",
          "kicker",
          "description",
          "highlights",
          "mpLink",
        ];


        for (
          const field of fields
        ) {
          assert.ok(
            content.includes(
              field
            ),
            `Campo ${field} deve permanecer no editor`
          );
        }
      }
    );


    test(
      "conteúdo programático deve continuar estruturado",
      () => {
        const content =
          readProjectFile(
            "components",
            "admin-apostilas.tsx"
          );


        assert.match(
          content,
          /addSyllabusItem/
        );


        assert.match(
          content,
          /updateSyllabusItem/
        );


        assert.match(
          content,
          /removeSyllabusItem/
        );


        assert.match(
          content,
          /topics/
        );
      }
    );


    test(
      "busca e filtros devem permanecer disponíveis",
      () => {
        const content =
          readProjectFile(
            "components",
            "admin-apostilas.tsx"
          );


        assert.match(
          content,
          /type="search"/
        );


        assert.match(
          content,
          /statusFilter/
        );


        assert.match(
          content,
          /categoryFilter/
        );


        assert.match(
          content,
          /filteredProducts/
        );
      }
    );


    test(
      "interface deve continuar exigindo capa e PDF para publicação",
      () => {
        const content =
          readProjectFile(
            "components",
            "admin-apostilas.tsx"
          );


        assert.match(
          content,
          /hasRequiredAssets/
        );


        assert.match(
          content,
          /product\.cover\s*&&\s*product\.pdfPath/
        );


        assert.match(
          content,
          /Publicar/
        );


        assert.match(
          content,
          /Despublicar/
        );
      }
    );


    test(
      "pré-visualização deve permanecer disponível",
      () => {
        const content =
          readProjectFile(
            "components",
            "admin-apostilas.tsx"
          );


        assert.match(
          content,
          /Pré-visualização dos dados/
        );


        assert.match(
          content,
          /admin-product-preview/
        );
      }
    );


    test(
      "CSS fundamental da interface deve permanecer",
      () => {
        const content =
          readProjectFile(
            "app",
            "extra.css"
          );


        const classes = [
          ".admin-apostilas",
          ".apostilas-toolbar",
          ".apostilas-summary",
          ".apostilas-filters",
          ".admin-modal-backdrop",
          ".admin-form-section",
          ".syllabus-admin-list",
          ".admin-product-preview",
        ];


        for (
          const className of classes
        ) {
          assert.ok(
            content.includes(
              className
            ),
            `${className} deve existir`
          );
        }
      }
    );


    test(
      "package deve manter teste 3B no gate global",
      () => {
        const packageJson =
          JSON.parse(
            readProjectFile(
              "package.json"
            )
          );


        assert.ok(
          packageJson.scripts[
            "test:phase3b-admin-ui"
          ]
        );


        assert.match(
          packageJson.scripts[
            "test:all"
          ],
          /test:phase3b-admin-ui/
        );
      }
    );
  }
);