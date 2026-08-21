"use client";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  formatPrice,
} from "../lib/currency";


type AdminProduct = {
  id: number;
  slug: string;
  title: string;
  shortTitle: string | null;
  category: string | null;
  bank: string | null;
  level: string | null;
  pages: number | null;
  questions: number | null;
  oldPrice: number | null;
  price: number;
  pixPrice: number | null;
  updated: string | null;
  cover: string | null;
  coverClass: string | null;
  kicker: string | null;
  description: string | null;
  highlights: string | null;
  syllabus: string | null;
  testimonial: string | null;
  mpLink: string | null;
  pdfPath: string | null;
  active: boolean | null;
  createdAt: string;
  updatedAt: string;
};


type SyllabusItem = {
  title: string;
  pages: number;
  questions: number;
  topics: string[];
};


type Testimonial = {
  name: string;
  role: string;
  quote: string;
  score: string;
};


type SyllabusFormItem = {
  title: string;
  pages: string;
  questions: string;
  topics: string;
};


type ProductFormState = {
  slug: string;
  title: string;
  shortTitle: string;
  category: string;
  bank: string;
  level: string;

  pages: string;
  questions: string;

  oldPrice: string;
  price: string;
  pixPrice: string;

  updated: string;

  coverClass: string;

  kicker: string;
  description: string;

  highlights: string;

  syllabus:
    SyllabusFormItem[];

  testimonialName: string;
  testimonialRole: string;
  testimonialQuote: string;
  testimonialScore: string;

  mpLink: string;
};


type StatusFilter =
  | "all"
  | "published"
  | "draft";


function emptySyllabusItem(): SyllabusFormItem {
  return {
    title: "",
    pages: "",
    questions: "",
    topics: "",
  };
}


function emptyForm(): ProductFormState {
  return {
    slug: "",
    title: "",
    shortTitle: "",
    category: "",
    bank: "",
    level: "",

    pages: "",
    questions: "",

    oldPrice: "",
    price: "",
    pixPrice: "",

    updated: "",

    coverClass: "",

    kicker: "",
    description: "",

    highlights: "",

    syllabus: [],

    testimonialName: "",
    testimonialRole: "",
    testimonialQuote: "",
    testimonialScore: "",

    mpLink: "",
  };
}


function safeParseJson<T>(
  value: string | null,
  fallback: T
): T {
  if (
    !value
  ) {
    return fallback;
  }


  try {
    return JSON.parse(
      value
    ) as T;
  } catch {
    return fallback;
  }
}


function productToForm(
  product: AdminProduct
): ProductFormState {
  const highlights =
    safeParseJson<string[]>(
      product.highlights,
      []
    );


  const syllabus =
    safeParseJson<SyllabusItem[]>(
      product.syllabus,
      []
    );


  const testimonial =
    safeParseJson<Testimonial | null>(
      product.testimonial,
      null
    );


  return {
    slug:
      product.slug,

    title:
      product.title,

    shortTitle:
      product.shortTitle ??
      "",

    category:
      product.category ??
      "",

    bank:
      product.bank ??
      "",

    level:
      product.level ??
      "",

    pages:
      product.pages ===
      null
        ? ""
        : String(
            product.pages
          ),

    questions:
      product.questions ===
      null
        ? ""
        : String(
            product.questions
          ),

    oldPrice:
      product.oldPrice ===
      null
        ? ""
        : String(
            product.oldPrice
          ),

    price:
      String(
        product.price
      ),

    pixPrice:
      product.pixPrice ===
      null
        ? ""
        : String(
            product.pixPrice
          ),

    updated:
      product.updated ??
      "",

    coverClass:
      product.coverClass ??
      "",

    kicker:
      product.kicker ??
      "",

    description:
      product.description ??
      "",

    highlights:
      highlights.join(
        "\n"
      ),

    syllabus:
      syllabus.map(
        (
          item
        ) => ({
          title:
            item.title,

          pages:
            String(
              item.pages
            ),

          questions:
            String(
              item.questions
            ),

          topics:
            item.topics.join(
              "\n"
            ),
        })
      ),

    testimonialName:
      testimonial?.name ??
      "",

    testimonialRole:
      testimonial?.role ??
      "",

    testimonialQuote:
      testimonial?.quote ??
      "",

    testimonialScore:
      testimonial?.score ??
      "",

    mpLink:
      product.mpLink ??
      "",
  };
}


function slugify(
  value: string
): string {
  return value
    .normalize(
      "NFD"
    )
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    );
}


function parseOptionalNumber(
  value: string
): number | null {
  const normalized =
    value
      .trim()
      .replace(
        ",",
        "."
      );


  if (
    !normalized
  ) {
    return null;
  }


  return Number(
    normalized
  );
}


function parseRequiredNumber(
  value: string
): number {
  return Number(
    value
      .trim()
      .replace(
        ",",
        "."
      )
  );
}


function textLines(
  value: string
): string[] {
  return value
    .split(
      "\n"
    )
    .map(
      (
        item
      ) =>
        item.trim()
    )
    .filter(
      Boolean
    );
}


function hasRequiredAssets(
  product: AdminProduct
): boolean {
  return Boolean(
    product.cover &&
    product.pdfPath
  );
}


function formatDate(
  value: string
): string {
  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }


  return date.toLocaleDateString(
    "pt-BR"
  );
}


function formPayload(
  form: ProductFormState
) {
  const testimonialValues = [
    form.testimonialName.trim(),
    form.testimonialRole.trim(),
    form.testimonialQuote.trim(),
    form.testimonialScore.trim(),
  ];


  const hasTestimonial =
    testimonialValues.some(
      Boolean
    );


  return {
    slug:
      form.slug.trim(),

    title:
      form.title.trim(),

    shortTitle:
      form.shortTitle.trim() ||
      null,

    category:
      form.category.trim() ||
      null,

    bank:
      form.bank.trim() ||
      null,

    level:
      form.level.trim() ||
      null,

    pages:
      parseOptionalNumber(
        form.pages
      ),

    questions:
      parseOptionalNumber(
        form.questions
      ),

    oldPrice:
      parseOptionalNumber(
        form.oldPrice
      ),

    price:
      parseRequiredNumber(
        form.price
      ),

    pixPrice:
      parseOptionalNumber(
        form.pixPrice
      ),

    updated:
      form.updated.trim() ||
      null,

    coverClass:
      form.coverClass.trim() ||
      null,

    kicker:
      form.kicker.trim() ||
      null,

    description:
      form.description.trim() ||
      null,

    highlights:
      textLines(
        form.highlights
      ),

    syllabus:
      form.syllabus.map(
        (
          item
        ) => ({
          title:
            item.title.trim(),

          pages:
            parseOptionalNumber(
              item.pages
            ) ??
            0,

          questions:
            parseOptionalNumber(
              item.questions
            ) ??
            0,

          topics:
            textLines(
              item.topics
            ),
        })
      ),

    testimonial:
      hasTestimonial
        ? {
            name:
              form.testimonialName.trim(),

            role:
              form.testimonialRole.trim(),

            quote:
              form.testimonialQuote.trim(),

            score:
              form.testimonialScore.trim(),
          }
        : null,

    mpLink:
      form.mpLink.trim() ||
      null,
  };
}


function validateForm(
  form: ProductFormState
): string | null {
  if (
    !form.title.trim()
  ) {
    return "Informe o título da apostila.";
  }


  if (
    !form.slug.trim()
  ) {
    return "Informe o slug da apostila.";
  }


  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
      form.slug.trim()
    )
  ) {
    return "O slug deve conter apenas letras minúsculas, números e hífens.";
  }


  const price =
    parseRequiredNumber(
      form.price
    );


  if (
    !Number.isFinite(
      price
    ) ||
    price <=
      0
  ) {
    return "Informe um preço válido maior que zero.";
  }


  const numericFields = [
    [
      "Páginas",
      form.pages,
    ],

    [
      "Questões",
      form.questions,
    ],

    [
      "Preço anterior",
      form.oldPrice,
    ],

    [
      "Preço PIX",
      form.pixPrice,
    ],
  ] as const;


  for (
    const [
      label,
      value,
    ] of numericFields
  ) {
    if (
      value.trim() &&
      !Number.isFinite(
        parseOptionalNumber(
          value
        )
      )
    ) {
      return `${label} deve conter um número válido.`;
    }
  }


  for (
    const [
      index,
      item,
    ] of form.syllabus.entries()
  ) {
    if (
      !item.title.trim()
    ) {
      return `Informe o nome da disciplina ${index + 1}.`;
    }


    const pages =
      parseOptionalNumber(
        item.pages
      );


    const questions =
      parseOptionalNumber(
        item.questions
      );


    if (
      pages !==
        null &&
      (
        !Number.isInteger(
          pages
        ) ||
        pages <
          0
      )
    ) {
      return `Páginas da disciplina ${index + 1} deve ser um inteiro não negativo.`;
    }


    if (
      questions !==
        null &&
      (
        !Number.isInteger(
          questions
        ) ||
        questions <
          0
      )
    ) {
      return `Questões da disciplina ${index + 1} deve ser um inteiro não negativo.`;
    }
  }


  const testimonialFields = [
    form.testimonialName.trim(),
    form.testimonialRole.trim(),
    form.testimonialQuote.trim(),
    form.testimonialScore.trim(),
  ];


  const filledTestimonialFields =
    testimonialFields.filter(
      Boolean
    ).length;


  if (
    filledTestimonialFields >
      0 &&
    filledTestimonialFields <
      testimonialFields.length
  ) {
    return "Preencha todos os campos do depoimento ou deixe todos vazios.";
  }


  return null;
}


export function AdminApostilas() {
  const [
    products,
    setProducts,
  ] =
    useState<
      AdminProduct[]
    >(
      []
    );


  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );


  const [
    saving,
    setSaving,
  ] =
    useState(
      false
    );


  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null
    );


  const [
    notice,
    setNotice,
  ] =
    useState<
      string | null
    >(
      null
    );


  const [
    search,
    setSearch,
  ] =
    useState(
      ""
    );


  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<StatusFilter>(
      "all"
    );


  const [
    categoryFilter,
    setCategoryFilter,
  ] =
    useState(
      ""
    );


  const [
    editorOpen,
    setEditorOpen,
  ] =
    useState(
      false
    );


  const [
    editingProduct,
    setEditingProduct,
  ] =
    useState<
      AdminProduct | null
    >(
      null
    );


  const [
    form,
    setForm,
  ] =
    useState<ProductFormState>(
      emptyForm()
    );


  const [
    slugEdited,
    setSlugEdited,
  ] =
    useState(
      false
    );


  async function fetchProducts() {
    setLoading(
      true
    );


    setError(
      null
    );


    try {
      const response =
        await fetch(
          "/api/admin/products",
          {
            credentials:
              "include",

            cache:
              "no-store",
          }
        );


      const data =
        await response
          .json()
          .catch(
            () => ({})
          );


      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
          "Não foi possível carregar as apostilas."
        );
      }


      setProducts(
        Array.isArray(
          data.products
        )
          ? data.products
          : []
      );
    } catch (
      fetchError
    ) {
      setError(
        fetchError instanceof
          Error
          ? fetchError.message
          : "Erro ao carregar apostilas."
      );
    } finally {
      setLoading(
        false
      );
    }
  }


  useEffect(
    () => {
      void fetchProducts();
    },
    []
  );


  const categories =
    useMemo(
      () =>
        Array.from(
          new Set(
            products
              .map(
                (
                  product
                ) =>
                  product.category
                    ?.trim()
              )
              .filter(
                (
                  value
                ): value is string =>
                  Boolean(
                    value
                  )
              )
          )
        ).sort(
          (
            first,
            second
          ) =>
            first.localeCompare(
              second,
              "pt-BR"
            )
        ),
      [
        products,
      ]
    );


  const filteredProducts =
    useMemo(
      () => {
        const normalizedSearch =
          search
            .trim()
            .toLocaleLowerCase(
              "pt-BR"
            );


        return products.filter(
          (
            product
          ) => {
            const matchesSearch =
              !normalizedSearch ||
              [
                product.title,
                product.slug,
                product.shortTitle,
                product.category,
                product.bank,
                product.level,
              ].some(
                (
                  value
                ) =>
                  value
                    ?.toLocaleLowerCase(
                      "pt-BR"
                    )
                    .includes(
                      normalizedSearch
                    )
              );


            const matchesStatus =
              statusFilter ===
                "all" ||
              (
                statusFilter ===
                  "published"
                  ? Boolean(
                      product.active
                    )
                  : !product.active
              );


            const matchesCategory =
              !categoryFilter ||
              product.category ===
                categoryFilter;


            return (
              matchesSearch &&
              matchesStatus &&
              matchesCategory
            );
          }
        );
      },
      [
        products,
        search,
        statusFilter,
        categoryFilter,
      ]
    );


  const publishedCount =
    products.filter(
      (
        product
      ) =>
        Boolean(
          product.active
        )
    ).length;


  const draftCount =
    products.length -
    publishedCount;


  const missingAssetsCount =
    products.filter(
      (
        product
      ) =>
        !hasRequiredAssets(
          product
        )
    ).length;


  function clearMessages() {
    setError(
      null
    );


    setNotice(
      null
    );
  }


  function openCreate() {
    clearMessages();


    setEditingProduct(
      null
    );


    setForm(
      emptyForm()
    );


    setSlugEdited(
      false
    );


    setEditorOpen(
      true
    );
  }


  function openEdit(
    product: AdminProduct
  ) {
    clearMessages();


    setEditingProduct(
      product
    );


    setForm(
      productToForm(
        product
      )
    );


    setSlugEdited(
      true
    );


    setEditorOpen(
      true
    );
  }


  function closeEditor() {
    if (
      saving
    ) {
      return;
    }


    setEditorOpen(
      false
    );


    setEditingProduct(
      null
    );


    setForm(
      emptyForm()
    );
  }


  function updateField<
    Key extends
      keyof ProductFormState
  >(
    field: Key,
    value:
      ProductFormState[Key]
  ) {
    setForm(
      (
        current
      ) => ({
        ...current,
        [field]:
          value,
      })
    );
  }


  function updateTitle(
    value: string
  ) {
    setForm(
      (
        current
      ) => ({
        ...current,

        title:
          value,

        slug:
          slugEdited
            ? current.slug
            : slugify(
                value
              ),
      })
    );
  }


  function updateSlug(
    value: string
  ) {
    setSlugEdited(
      true
    );


    updateField(
      "slug",
      slugify(
        value
      )
    );
  }


  function addSyllabusItem() {
    setForm(
      (
        current
      ) => ({
        ...current,

        syllabus: [
          ...current.syllabus,
          emptySyllabusItem(),
        ],
      })
    );
  }


  function updateSyllabusItem(
    index: number,
    field:
      keyof SyllabusFormItem,
    value: string
  ) {
    setForm(
      (
        current
      ) => ({
        ...current,

        syllabus:
          current.syllabus.map(
            (
              item,
              itemIndex
            ) =>
              itemIndex ===
              index
                ? {
                    ...item,
                    [field]:
                      value,
                  }
                : item
          ),
      })
    );
  }


  function removeSyllabusItem(
    index: number
  ) {
    setForm(
      (
        current
      ) => ({
        ...current,

        syllabus:
          current.syllabus.filter(
            (
              _,
              itemIndex
            ) =>
              itemIndex !==
              index
          ),
      })
    );
  }


  async function saveProduct(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();


    clearMessages();


    const validationError =
      validateForm(
        form
      );


    if (
      validationError
    ) {
      setError(
        validationError
      );


      return;
    }


    setSaving(
      true
    );


    try {
      const editing =
        Boolean(
          editingProduct
        );


      const response =
        await fetch(
          "/api/admin/products",
          {
            method:
              editing
                ? "PATCH"
                : "POST",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                ...(
                  editingProduct
                    ? {
                        id:
                          editingProduct.id,
                      }
                    : {}
                ),

                ...formPayload(
                  form
                ),
              }),
          }
        );


      const data =
        await response
          .json()
          .catch(
            () => ({})
          );


      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
          (
            editing
              ? "Não foi possível atualizar a apostila."
              : "Não foi possível criar a apostila."
          )
        );
      }


      setNotice(
        editing
          ? "Apostila atualizada com sucesso."
          : "Apostila criada como rascunho."
      );


      setEditorOpen(
        false
      );


      setEditingProduct(
        null
      );


      setForm(
        emptyForm()
      );


      await fetchProducts();
    } catch (
      saveError
    ) {
      setError(
        saveError instanceof
          Error
          ? saveError.message
          : "Erro ao salvar apostila."
      );
    } finally {
      setSaving(
        false
      );
    }
  }


  async function togglePublication(
    product: AdminProduct
  ) {
    clearMessages();


    const targetActive =
      !Boolean(
        product.active
      );


    if (
      targetActive &&
      !hasRequiredAssets(
        product
      )
    ) {
      setError(
        "Esta apostila ainda não possui capa e PDF. O upload seguro será habilitado na Fase 3C antes da publicação."
      );


      return;
    }


    const confirmed =
      window.confirm(
        targetActive
          ? `Publicar "${product.title}" no catálogo?`
          : `Retirar "${product.title}" do catálogo público?`
      );


    if (
      !confirmed
    ) {
      return;
    }


    try {
      const response =
        await fetch(
          "/api/admin/products",
          {
            method:
              "PATCH",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                id:
                  product.id,

                active:
                  targetActive,
              }),
          }
        );


      const data =
        await response
          .json()
          .catch(
            () => ({})
          );


      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
          "Não foi possível alterar a publicação."
        );
      }


      setNotice(
        targetActive
          ? "Apostila publicada."
          : "Apostila movida para rascunho."
      );


      await fetchProducts();
    } catch (
      publicationError
    ) {
      setError(
        publicationError instanceof
          Error
          ? publicationError.message
          : "Erro ao alterar publicação."
      );
    }
  }


  if (
    loading
  ) {
    return (
      <div className="admin-apostilas">
        <div className="admin-loading-card">
          Carregando apostilas...
        </div>
      </div>
    );
  }


  return (
    <div className="admin-apostilas">
      <header className="apostilas-toolbar">
        <div>
          <span className="admin-section-kicker">
            Catálogo
          </span>

          <h2>
            📚 Apostilas
          </h2>

          <p>
            Gerencie dados editoriais,
            preços e publicação dos
            materiais.
          </p>
        </div>

        <button
          type="button"
          className="button button-primary"
          onClick={
            openCreate
          }
        >
          + Nova apostila
        </button>
      </header>


      {error && (
        <div
          className="admin-feedback admin-feedback-error"
          role="alert"
        >
          {error}
        </div>
      )}


      {notice && (
        <div
          className="admin-feedback admin-feedback-success"
          role="status"
        >
          {notice}
        </div>
      )}


      <section className="apostilas-summary">
        <article>
          <small>
            TOTAL
          </small>

          <strong>
            {products.length}
          </strong>

          <span>
            apostilas cadastradas
          </span>
        </article>

        <article>
          <small>
            PUBLICADAS
          </small>

          <strong>
            {publishedCount}
          </strong>

          <span>
            visíveis no site
          </span>
        </article>

        <article>
          <small>
            RASCUNHOS
          </small>

          <strong>
            {draftCount}
          </strong>

          <span>
            fora do catálogo
          </span>
        </article>

        <article>
          <small>
            ARQUIVOS PENDENTES
          </small>

          <strong>
            {missingAssetsCount}
          </strong>

          <span>
            sem capa ou PDF
          </span>
        </article>
      </section>


      <section className="apostilas-filters">
        <label className="apostilas-search">
          <span>
            Buscar
          </span>

          <input
            type="search"
            value={
              search
            }
            onChange={
              (
                event
              ) =>
                setSearch(
                  event.target.value
                )
            }
            placeholder="Título, slug, banca..."
          />
        </label>

        <label>
          <span>
            Status
          </span>

          <select
            value={
              statusFilter
            }
            onChange={
              (
                event
              ) =>
                setStatusFilter(
                  event.target.value as
                    StatusFilter
                )
            }
          >
            <option value="all">
              Todos
            </option>

            <option value="published">
              Publicadas
            </option>

            <option value="draft">
              Rascunhos
            </option>
          </select>
        </label>

        <label>
          <span>
            Categoria
          </span>

          <select
            value={
              categoryFilter
            }
            onChange={
              (
                event
              ) =>
                setCategoryFilter(
                  event.target.value
                )
            }
          >
            <option value="">
              Todas
            </option>

            {categories.map(
              (
                category
              ) => (
                <option
                  key={
                    category
                  }
                  value={
                    category
                  }
                >
                  {category}
                </option>
              )
            )}
          </select>
        </label>
      </section>


      <section className="table-card apostilas-table-card">
        <div className="table-filter">
          <div>
            <h3>
              Materiais cadastrados
            </h3>

            <small>
              {filteredProducts.length} de{" "}
              {products.length} resultado(s)
            </small>
          </div>
        </div>


        {filteredProducts.length ===
        0 ? (
          <div className="apostila-empty">
            <strong>
              Nenhuma apostila encontrada.
            </strong>

            <span>
              Ajuste os filtros ou crie um
              novo material.
            </span>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>
                  Apostila
                </th>

                <th>
                  Categoria
                </th>

                <th>
                  Preço
                </th>

                <th>
                  Arquivos
                </th>

                <th>
                  Status
                </th>

                <th>
                  Atualização
                </th>

                <th>
                  Ações
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.map(
                (
                  product
                ) => (
                  <tr
                    key={
                      product.id
                    }
                  >
                    <td>
                      <div className="apostila-title-cell">
                        <strong>
                          {product.title}
                        </strong>

                        <code>
                          {product.slug}
                        </code>

                        <small>
                          {product.bank ||
                            "Banca não informada"}
                          {" • "}
                          {product.level ||
                            "Nível não informado"}
                        </small>
                      </div>
                    </td>

                    <td>
                      {product.category ||
                        "—"}
                    </td>

                    <td>
                      <strong>
                        {formatPrice(
                          product.price
                        )}
                      </strong>

                      {product.pixPrice !==
                        null && (
                        <small>
                          PIX{" "}
                          {formatPrice(
                            product.pixPrice
                          )}
                        </small>
                      )}
                    </td>

                    <td>
                      <div className="asset-badges">
                        <span
                          className={
                            product.cover
                              ? "asset-ok"
                              : "asset-missing"
                          }
                        >
                          {product.cover
                            ? "✓ Capa"
                            : "○ Capa"}
                        </span>

                        <span
                          className={
                            product.pdfPath
                              ? "asset-ok"
                              : "asset-missing"
                          }
                        >
                          {product.pdfPath
                            ? "✓ PDF"
                            : "○ PDF"}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`status-badge ${
                          product.active
                            ? "status-approved"
                            : "status-rejected"
                        }`}
                      >
                        {product.active
                          ? "Publicada"
                          : "Rascunho"}
                      </span>
                    </td>

                    <td>
                      <small>
                        {formatDate(
                          product.updatedAt
                        )}
                      </small>
                    </td>

                    <td>
                      <div className="admin-action-group">
                        <button
                          type="button"
                          className="button button-ghost"
                          onClick={
                            () =>
                              openEdit(
                                product
                              )
                          }
                        >
                          Editar
                        </button>

                        {product.active && (
                          <Link
                            href={`/apostilas/${product.slug}`}
                            className="button button-ghost"
                            target="_blank"
                          >
                            Ver
                          </Link>
                        )}

                        <button
                          type="button"
                          className={
                            product.active
                              ? "button button-ghost admin-unpublish-button"
                              : "button button-primary"
                          }
                          disabled={
                            !product.active &&
                            !hasRequiredAssets(
                              product
                            )
                          }
                          title={
                            !product.active &&
                            !hasRequiredAssets(
                              product
                            )
                              ? "É necessário possuir capa e PDF antes de publicar."
                              : undefined
                          }
                          onClick={
                            () =>
                              void togglePublication(
                                product
                              )
                          }
                        >
                          {product.active
                            ? "Despublicar"
                            : "Publicar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </section>


      {editorOpen && (
        <div
          className="admin-modal-backdrop"
          role="presentation"
        >
          <section
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="apostila-editor-title"
          >
            <header className="admin-modal-header">
              <div>
                <span className="admin-section-kicker">
                  {editingProduct
                    ? `Apostila #${editingProduct.id}`
                    : "Novo material"}
                </span>

                <h2 id="apostila-editor-title">
                  {editingProduct
                    ? "Editar apostila"
                    : "Criar apostila"}
                </h2>

                <p>
                  {editingProduct
                    ? "Altere os dados editoriais sem modificar os arquivos enviados."
                    : "A nova apostila será salva inicialmente como rascunho."}
                </p>
              </div>

              <button
                type="button"
                className="admin-modal-close"
                onClick={
                  closeEditor
                }
                disabled={
                  saving
                }
                aria-label="Fechar editor"
              >
                ×
              </button>
            </header>


            <form
              onSubmit={
                saveProduct
              }
            >
              <div className="admin-modal-body">
                {error && (
                  <div
                    className="admin-feedback admin-feedback-error"
                    role="alert"
                  >
                    {error}
                  </div>
                )}


                <section className="admin-form-section">
                  <header>
                    <h3>
                      1. Identificação
                    </h3>

                    <p>
                      Informações principais utilizadas
                      no catálogo e na página da
                      apostila.
                    </p>
                  </header>

                  <div className="admin-form-grid">
                    <label className="admin-field span-2">
                      <span>
                        Título *
                      </span>

                      <input
                        type="text"
                        value={
                          form.title
                        }
                        onChange={
                          (
                            event
                          ) =>
                            updateTitle(
                              event.target.value
                            )
                        }
                        maxLength={
                          180
                        }
                        required
                      />
                    </label>

                    <label className="admin-field">
                      <span>
                        Slug *
                      </span>

                      <input
                        type="text"
                        value={
                          form.slug
                        }
                        onChange={
                          (
                            event
                          ) =>
                            updateSlug(
                              event.target.value
                            )
                        }
                        maxLength={
                          120
                        }
                        required
                      />

                      <small>
                        URL: /apostilas/{form.slug || "slug-da-apostila"}
                      </small>
                    </label>

                    <label className="admin-field">
                      <span>
                        Título curto
                      </span>

                      <input
                        type="text"
                        value={
                          form.shortTitle
                        }
                        onChange={
                          (
                            event
                          ) =>
                            updateField(
                              "shortTitle",
                              event.target.value
                            )
                        }
                        maxLength={
                          120
                        }
                      />
                    </label>

                    <label className="admin-field">
                      <span>
                        Categoria
                      </span>

                      <input
                        type="text"
                        value={
                          form.category
                        }
                        onChange={
                          (
                            event
                          ) =>
                            updateField(
                              "category",
                              event.target.value
                            )
                        }
                        maxLength={
                          100
                        }
                        placeholder="Ex.: Estatais"
                      />
                    </label>

                    <label className="admin-field">
                      <span>
                        Banca
                      </span>

                      <input
                        type="text"
                        value={
                          form.bank
                        }
                        onChange={
                          (
                            event
                          ) =>
                            updateField(
                              "bank",
                              event.target.value
                            )
                        }
                        maxLength={
                          100
                        }
                        placeholder="Ex.: Cesgranrio"
                      />
                    </label>

                    <label className="admin-field">
                      <span>
                        Nível
                      </span>

                      <input
                        type="text"
                        value={
                          form.level
                        }
                        onChange={
                          (
                            event
                          ) =>
                            updateField(
                              "level",
                              event.target.value
                            )
                        }
                        maxLength={
                          80
                        }
                        placeholder="Ex.: Superior"
                      />
                    </label>

                    <label className="admin-field">
                      <span>
                        Atualização editorial
                      </span>

                      <input
                        type="text"
                        value={
                          form.updated
                        }
                        onChange={
                          (
                            event
                          ) =>
                            updateField(
                              "updated",
                              event.target.value
                            )
                        }
                        maxLength={
                          100
                        }
                        placeholder="Ex.: Atualizado para o edital 2026"
                      />
                    </label>
                  </div>
                </section>


                <section className="admin-form-section">
                  <header>
                    <h3>
                      2. Conteúdo e preço
                    </h3>

                    <p>
                      Métricas exibidas na página do
                      produto e valores comerciais.
                    </p>
                  </header>

                  <div className="admin-form-grid admin-form-grid-3">
                    <label className="admin-field">
                      <span>
                        Páginas
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={
                          form.pages
                        }
                        onChange={
                          (
                            event
                          ) =>
                            updateField(
                              "pages",
                              event.target.value
                            )
                        }
                      />
                    </label>

                    <label className="admin-field">
                      <span>
                        Questões
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={
                          form.questions
                        }
                        onChange={
                          (
                            event
                          ) =>
                            updateField(
                              "questions",
                              event.target.value
                            )
                        }
                      />
                    </label>

                    <label className="admin-field">
                      <span>
                        Preço anterior
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          form.oldPrice
                        }
                        onChange={
                          (
                            event
                          ) =>
                            updateField(
                              "oldPrice",
                              event.target.value
                            )
                        }
                      />
                    </label>

                    <label className="admin-field">
                      <span>
                        Preço *
                      </span>

                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={
                          form.price
                        }
                        onChange={
                          (
                            event
                          ) =>
                            updateField(
                              "price",
                              event.target.value
                            )
                        }
                        required
                      />
                    </label>

                    <label className="admin-field">
                      <span>
                        Preço PIX
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          form.pixPrice
                        }
                        onChange={
                          (
                            event
                          ) =>
                            updateField(
                              "pixPrice",
                              event.target.value
                            )
                        }
                      />
                    </label>

                    <label className="admin-field">
                      <span>
                        Classe visual legada
                      </span>

                      <input
                        type="text"
                        value={
                          form.coverClass
                        }
                        onChange={
                          (
                            event
                          ) =>
                            updateField(
                              "coverClass",
                              event.target.value
                            )
                        }
                        maxLength={
                          80
                        }
                      />
                    </label>
                  </div>
                </section>


                <section className="admin-form-section">
                  <header>
                    <h3>
                      3. Apresentação
                    </h3>

                    <p>
                      Textos comerciais apresentados
                      ao candidato.
                    </p>
                  </header>

                  <div className="admin-form-grid">
                    <label className="admin-field span-2">
                      <span>
                        Chamada principal
                      </span>

                      <textarea
                        rows={
                          3
                        }
                        value={
                          form.kicker
                        }
                        onChange={
                          (
                            event
                          ) =>
                            updateField(
                              "kicker",
                              event.target.value
                            )
                        }
                        maxLength={
                          600
                        }
                      />
                    </label>

                    <label className="admin-field span-2">
                      <span>
                        Descrição
                      </span>

                      <textarea
                        rows={
                          6
                        }
                        value={
                          form.description
                        }
                        onChange={
                          (
                            event
                          ) =>
                            updateField(
                              "description",
                              event.target.value
                            )
                        }
                        maxLength={
                          5000
                        }
                      />
                    </label>

                    <label className="admin-field span-2">
                      <span>
                        Destaques
                      </span>

                      <textarea
                        rows={
                          6
                        }
                        value={
                          form.highlights
                        }
                        onChange={
                          (
                            event
                          ) =>
                            updateField(
                              "highlights",
                              event.target.value
                            )
                        }
                        placeholder={
                          "Um destaque por linha\nConteúdo atualizado\nQuestões comentadas"
                        }
                      />

                      <small>
                        Um item por linha.
                      </small>
                    </label>

                    <label className="admin-field span-2">
                      <span>
                        Link Mercado Pago
                      </span>

                      <input
                        type="url"
                        value={
                          form.mpLink
                        }
                        onChange={
                          (
                            event
                          ) =>
                            updateField(
                              "mpLink",
                              event.target.value
                            )
                        }
                        placeholder="https://..."
                      />

                      <small>
                        Quando informado, deve utilizar HTTPS.
                      </small>
                    </label>
                  </div>
                </section>


                <section className="admin-form-section">
                  <header className="admin-form-section-header-actions">
                    <div>
                      <h3>
                        4. Conteúdo programático
                      </h3>

                      <p>
                        Cadastre disciplinas, tópicos e
                        volume de conteúdo.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="button button-ghost"
                      onClick={
                        addSyllabusItem
                      }
                    >
                      + Adicionar disciplina
                    </button>
                  </header>


                  {form.syllabus.length ===
                  0 ? (
                    <div className="syllabus-empty">
                      Nenhuma disciplina cadastrada.
                    </div>
                  ) : (
                    <div className="syllabus-admin-list">
                      {form.syllabus.map(
                        (
                          item,
                          index
                        ) => (
                          <article
                            className="syllabus-admin-item"
                            key={
                              index
                            }
                          >
                            <header>
                              <strong>
                                Disciplina {index + 1}
                              </strong>

                              <button
                                type="button"
                                onClick={
                                  () =>
                                    removeSyllabusItem(
                                      index
                                    )
                                }
                              >
                                Remover
                              </button>
                            </header>

                            <div className="admin-form-grid admin-form-grid-3">
                              <label className="admin-field span-2">
                                <span>
                                  Disciplina
                                </span>

                                <input
                                  type="text"
                                  value={
                                    item.title
                                  }
                                  onChange={
                                    (
                                      event
                                    ) =>
                                      updateSyllabusItem(
                                        index,
                                        "title",
                                        event.target.value
                                      )
                                  }
                                />
                              </label>

                              <label className="admin-field">
                                <span>
                                  Páginas
                                </span>

                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={
                                    item.pages
                                  }
                                  onChange={
                                    (
                                      event
                                    ) =>
                                      updateSyllabusItem(
                                        index,
                                        "pages",
                                        event.target.value
                                      )
                                  }
                                />
                              </label>

                              <label className="admin-field">
                                <span>
                                  Questões
                                </span>

                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={
                                    item.questions
                                  }
                                  onChange={
                                    (
                                      event
                                    ) =>
                                      updateSyllabusItem(
                                        index,
                                        "questions",
                                        event.target.value
                                      )
                                  }
                                />
                              </label>

                              <label className="admin-field span-2">
                                <span>
                                  Tópicos
                                </span>

                                <textarea
                                  rows={
                                    5
                                  }
                                  value={
                                    item.topics
                                  }
                                  onChange={
                                    (
                                      event
                                    ) =>
                                      updateSyllabusItem(
                                        index,
                                        "topics",
                                        event.target.value
                                      )
                                  }
                                  placeholder="Um tópico por linha"
                                />
                              </label>
                            </div>
                          </article>
                        )
                      )}
                    </div>
                  )}
                </section>


                <section className="admin-form-section">
                  <header>
                    <h3>
                      5. Depoimento
                    </h3>

                    <p>
                      Opcional. Caso utilizado, os
                      quatro campos devem ser
                      preenchidos.
                    </p>
                  </header>

                  <div className="admin-form-grid">
                    <label className="admin-field">
                      <span>
                        Nome
                      </span>

                      <input
                        type="text"
                        value={
                          form.testimonialName
                        }
                        onChange={
                          (
                            event
                          ) =>
                            updateField(
                              "testimonialName",
                              event.target.value
                            )
                        }
                      />
                    </label>

                    <label className="admin-field">
                      <span>
                        Identificação
                      </span>

                      <input
                        type="text"
                        value={
                          form.testimonialRole
                        }
                        onChange={
                          (
                            event
                          ) =>
                            updateField(
                              "testimonialRole",
                              event.target.value
                            )
                        }
                        placeholder="Ex.: Aprovado"
                      />
                    </label>

                    <label className="admin-field span-2">
                      <span>
                        Depoimento
                      </span>

                      <textarea
                        rows={
                          4
                        }
                        value={
                          form.testimonialQuote
                        }
                        onChange={
                          (
                            event
                          ) =>
                            updateField(
                              "testimonialQuote",
                              event.target.value
                            )
                        }
                      />
                    </label>

                    <label className="admin-field">
                      <span>
                        Resultado / destaque
                      </span>

                      <input
                        type="text"
                        value={
                          form.testimonialScore
                        }
                        onChange={
                          (
                            event
                          ) =>
                            updateField(
                              "testimonialScore",
                              event.target.value
                            )
                        }
                        placeholder="Ex.: 92% de acertos"
                      />
                    </label>
                  </div>
                </section>


                <section className="admin-form-section">
                  <header>
                    <h3>
                      6. Arquivos
                    </h3>

                    <p>
                      Capa e PDF são protegidos contra
                      alteração por JSON e serão
                      gerenciados pela API de upload da
                      Fase 3C.
                    </p>
                  </header>

                  <div className="admin-readonly-assets">
                    <article>
                      <span>
                        Capa
                      </span>

                      <strong>
                        {editingProduct?.cover
                          ? "✓ Arquivo cadastrado"
                          : "○ Pendente"}
                      </strong>

                      <small>
                        {editingProduct?.cover ||
                          "Upload ainda não disponível nesta fase."}
                      </small>
                    </article>

                    <article>
                      <span>
                        PDF original
                      </span>

                      <strong>
                        {editingProduct?.pdfPath
                          ? "✓ Arquivo cadastrado"
                          : "○ Pendente"}
                      </strong>

                      <small>
                        {editingProduct?.pdfPath ||
                          "Upload ainda não disponível nesta fase."}
                      </small>
                    </article>
                  </div>
                </section>


                <aside className="admin-product-preview">
                  <span className="admin-section-kicker">
                    Pré-visualização dos dados
                  </span>

                  <h3>
                    {form.title ||
                      "Título da apostila"}
                  </h3>

                  <small>
                    {form.category ||
                      "Categoria"}
                    {" • "}
                    {form.bank ||
                      "Banca"}
                  </small>

                  <strong>
                    {Number.isFinite(
                      parseRequiredNumber(
                        form.price
                      )
                    ) &&
                    parseRequiredNumber(
                      form.price
                    ) >
                      0
                      ? formatPrice(
                          parseRequiredNumber(
                            form.price
                          )
                        )
                      : "Preço não informado"}
                  </strong>

                  <p>
                    {form.description ||
                      form.kicker ||
                      "A descrição comercial aparecerá aqui."}
                  </p>

                  {textLines(
                    form.highlights
                  )
                    .slice(
                      0,
                      4
                    )
                    .map(
                      (
                        highlight
                      ) => (
                        <span
                          className="admin-preview-highlight"
                          key={
                            highlight
                          }
                        >
                          ✓ {highlight}
                        </span>
                      )
                    )}
                </aside>
              </div>


              <footer className="admin-modal-footer">
                <div>
                  <strong>
                    {editingProduct
                      ? editingProduct.active
                        ? "Material publicado"
                        : "Material em rascunho"
                      : "Novo material será criado como rascunho"}
                  </strong>

                  <small>
                    Publicação é controlada separadamente
                    na listagem.
                  </small>
                </div>

                <div className="admin-modal-footer-actions">
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={
                      closeEditor
                    }
                    disabled={
                      saving
                    }
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={
                      saving
                    }
                  >
                    {saving
                      ? "Salvando..."
                      : editingProduct
                        ? "Salvar alterações"
                        : "Criar rascunho"}
                  </button>
                </div>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}