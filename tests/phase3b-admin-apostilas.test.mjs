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
        const path =
          join(
            process.cwd(),
            "components",
            "admin-apostilas.tsx"
          );


        assert.ok(
          existsSync(
            path
          ),
          "components/admin-apostilas.tsx deve existir"
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
          /AdminApostilas/,
          "Dashboard deve utilizar AdminApostilas"
        );


        assert.match(
          content,
          /"apostilas"/,
          "A aba administrativa deve se chamar apostilas"
        );


        assert.match(
          content,
          /📚 Apostilas/,
          "Sidebar deve exibir Apostilas"
        );


        assert.doesNotMatch(
          content,
          /function\s+AdminProducts\s*\(/,
          "Gerenciamento legado inline deve ser removido"
        );
      }
    );


    test(
      "interface deve listar apostilas pela API segura",
      () => {
        const content =
          readProjectFile(
            "components",
            "admin-apostilas.tsx"
          );


        assert.match(
          content,
          /\/api\/admin\/products/,
          "Interface deve consumir API administrativa"
        );


        assert.match(
          content,
          /credentials:\s*["']include["']/,
          "Requisições devem enviar sessão"
        );


        assert.match(
          content,
          /fetchProducts/,
          "Interface deve possuir carregamento centralizado"
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
          /\+ Nova apostila/,
          "Deve existir ação para criar apostila"
        );


        assert.match(
          content,
          /method:\s*editing[\s\S]*["']PATCH["'][\s\S]*["']POST["']/,
          "Editor deve diferenciar criação e edição"
        );


        assert.match(
          content,
          /Criar rascunho/,
          "Nova apostila deve ser apresentada como rascunho"
        );
      }
    );


    test(
      "interface deve permitir editar todos os dados editoriais essenciais",
      () => {
        const content =
          readProjectFile(
            "components",
            "admin-apostilas.tsx"
          );


        const requiredFields = [
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
          const field of requiredFields
        ) {
          assert.ok(
            content.includes(
              field
            ),
            `Editor deve conter ${field}`
          );
        }
      }
    );


    test(
      "conteúdo programático deve possuir editor estruturado",
      () => {
        const content =
          readProjectFile(
            "components",
            "admin-apostilas.tsx"
          );


        assert.match(
          content,
          /addSyllabusItem/,
          "Deve ser possível adicionar disciplina"
        );


        assert.match(
          content,
          /updateSyllabusItem/,
          "Deve ser possível editar disciplina"
        );


        assert.match(
          content,
          /removeSyllabusItem/,
          "Deve ser possível remover disciplina"
        );


        assert.match(
          content,
          /topics/,
          "Editor deve aceitar tópicos"
        );
      }
    );


    test(
      "interface deve possuir busca e filtros",
      () => {
        const content =
          readProjectFile(
            "components",
            "admin-apostilas.tsx"
          );


        assert.match(
          content,
          /type="search"/,
          "Deve existir busca"
        );


        assert.match(
          content,
          /statusFilter/,
          "Deve existir filtro por status"
        );


        assert.match(
          content,
          /categoryFilter/,
          "Deve existir filtro por categoria"
        );


        assert.match(
          content,
          /filteredProducts/,
          "Listagem deve utilizar produtos filtrados"
        );
      }
    );


    test(
      "publicação deve exigir capa e PDF na interface",
      () => {
        const content =
          readProjectFile(
            "components",
            "admin-apostilas.tsx"
          );


        assert.match(
          content,
          /hasRequiredAssets/,
          "Interface deve verificar arquivos obrigatórios"
        );


        assert.match(
          content,
          /product\.cover\s*&&\s*product\.pdfPath/,
          "Capa e PDF devem ser necessários"
        );


        assert.match(
          content,
          /Publicar/,
          "Deve existir ação de publicação"
        );


        assert.match(
          content,
          /Despublicar/,
          "Deve existir ação de despublicação"
        );
      }
    );


    test(
      "Fase 3B não deve implementar upload de arquivo",
      () => {
        const content =
          readProjectFile(
            "components",
            "admin-apostilas.tsx"
          );


        assert.doesNotMatch(
          content,
          /type\s*=\s*["']file["']/,
          "Upload fica reservado para a Fase 3C"
        );


        assert.match(
          content,
          /Fase 3C/,
          "Interface deve comunicar que arquivos serão tratados posteriormente"
        );
      }
    );


    test(
      "interface deve exibir pré-visualização dos dados",
      () => {
        const content =
          readProjectFile(
            "components",
            "admin-apostilas.tsx"
          );


        assert.match(
          content,
          /Pré-visualização dos dados/,
          "Editor deve possuir preview"
        );


        assert.match(
          content,
          /admin-product-preview/,
          "Preview deve possuir componente visual próprio"
        );
      }
    );


    test(
      "CSS da interface administrativa deve existir",
      () => {
        const content =
          readProjectFile(
            "app",
            "extra.css"
          );


        const requiredClasses = [
          ".admin-apostilas",
          ".apostilas-toolbar",
          ".apostilas-summary",
          ".apostilas-filters",
          ".admin-modal-backdrop",
          ".admin-form-section",
          ".syllabus-admin-list",
          ".admin-readonly-assets",
          ".admin-product-preview",
        ];


        for (
          const className of requiredClasses
        ) {
          assert.ok(
            content.includes(
              className
            ),
            `CSS deve conter ${className}`
          );
        }
      }
    );


    test(
      "package deve incluir teste 3B no gate global",
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
          ],
          "Script da Fase 3B deve existir"
        );


        assert.match(
          packageJson.scripts[
            "test:all"
          ],
          /test:phase3b-admin-ui/,
          "test:all deve incluir Fase 3B administrativa"
        );
      }
    );
  }
);