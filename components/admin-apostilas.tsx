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

type AdminAssetKind =
  | "cover"
  | "pdf";

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

  const [
    assetOperation,
    setAssetOperation,
  ] =
    useState<
      AdminAssetKind | null
    >(
      null
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

  function syncProduct(
    product: AdminProduct
  ) {
    setProducts(
      (
        current
      ) => {
        const exists =
          current.some(
            (
              item
            ) =>
              item.id ===
              product.id
          );


        if (
          !exists
        ) {
          return [
            product,
            ...current,
          ];
        }


        return current.map(
          (
            item
          ) =>
            item.id ===
            product.id
              ? product
              : item
        );
      }
    );


    setEditingProduct(
      product
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
      saving ||
      assetOperation !==
        null
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


    if (
      assetOperation !==
      null
    ) {
      return;
    }


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


      const savedProduct =
        data.product as
          AdminProduct;


      syncProduct(
        savedProduct
      );


      if (
        editing
      ) {
        setNotice(
          "Apostila atualizada com sucesso."
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
      } else {
        /**
         * Mantemos o editor aberto.
         *
         * Agora que o rascunho possui ID, o administrador
         * pode enviar capa e PDF imediatamente.
         */
        setForm(
          productToForm(
            savedProduct
          )
        );


        setSlugEdited(
          true
        );


        setNotice(
          "Rascunho criado. Agora você pode enviar a capa e o PDF."
        );
      }
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

  async function uploadAsset(
    kind: AdminAssetKind,
    file: File
  ) {
    if (
      !editingProduct
    ) {
      setError(
        "Salve o rascunho antes de enviar arquivos."
      );


      return;
    }


    const maximumSize =
      kind ===
      "cover"
        ? 8 *
          1024 *
          1024
        : 120 *
          1024 *
          1024;


    if (
      file.size >
      maximumSize
    ) {
      setError(
        kind ===
        "cover"
          ? "A capa excede o limite de 8 MB."
          : "O PDF excede o limite de 120 MB."
      );


      return;
    }


    clearMessages();


    setAssetOperation(
      kind
    );


    try {
      const formData =
        new FormData();


      formData.set(
        "kind",
        kind
      );


      formData.set(
        "file",
        file
      );


      const response =
        await fetch(
          `/api/admin/products/${editingProduct.id}/assets`,
          {
            method:
              "POST",

            credentials:
              "include",

            body:
              formData,
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
          "Não foi possível enviar o arquivo."
        );
      }


      syncProduct(
        data.product as
          AdminProduct
      );


      setNotice(
        kind ===
        "cover"
          ? "Capa enviada com sucesso."
          : "PDF enviado com sucesso."
      );
    } catch (
      uploadError
    ) {
      setError(
        uploadError instanceof
          Error
          ? uploadError.message
          : "Erro ao enviar arquivo."
      );
    } finally {
      setAssetOperation(
        null
      );
    }
  }


  async function removeAsset(
    kind: AdminAssetKind
  ) {
    if (
      !editingProduct
    ) {
      return;
    }


    const label =
      kind ===
      "cover"
        ? "capa"
        : "PDF";


    if (
      !window.confirm(
        `Remover ${label} desta apostila? A apostila será despublicada automaticamente.`
      )
    ) {
      return;
    }


    clearMessages();


    setAssetOperation(
      kind
    );


    try {
      const response =
        await fetch(
          `/api/admin/products/${editingProduct.id}/assets?kind=${kind}`,
          {
            method:
              "DELETE",

            credentials:
              "include",
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
          "Não foi possível remover o arquivo."
        );
      }


      syncProduct(
        data.product as
          AdminProduct
      );


      setNotice(
        `${label === "PDF" ? "PDF" : "Capa"} removido(a). A apostila permanece em rascunho até possuir novamente capa e PDF.`
      );
    } catch (
      removeError
    ) {
      setError(
        removeError instanceof
          Error
          ? removeError.message
          : "Erro ao remover arquivo."
      );
    } finally {
      setAssetOperation(
        null
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
        "Esta apostila ainda não possui capa e PDF. Envie os dois arquivos antes de publicar."
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
                      6. Arquivos
                    </h3>

                    <p>
                      Capa e PDF são enviados por uma
                      API administrativa protegida. O
                      PDF original permanece fora da
                      área pública do site.
                    </p>
                  </header>


                  {!editingProduct ? (
                    <div className="admin-assets-save-first">
                      <strong>
                        Salve o rascunho primeiro.
                      </strong>

                      <span>
                        Após a criação, o editor permanecerá
                        aberto e os controles de upload serão
                        habilitados.
                      </span>
                    </div>
                  ) : (
                    <div className="admin-assets-grid">
                      <article className="admin-asset-card">
                        <div className="admin-asset-card-header">
                          <div>
                            <span className="admin-asset-label">
                              CAPA
                            </span>

                            <strong>
                              {editingProduct.cover
                                ? "✓ Capa cadastrada"
                                : "○ Capa pendente"}
                            </strong>
                          </div>

                          <span
                            className={
                              editingProduct.cover
                                ? "admin-asset-status ready"
                                : "admin-asset-status pending"
                            }
                          >
                            {editingProduct.cover
                              ? "Pronta"
                              : "Pendente"}
                          </span>
                        </div>


                        {editingProduct.cover && (
                          <div className="admin-cover-preview">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={
                                editingProduct.cover
                              }
                              alt={`Capa de ${editingProduct.title}`}
                            />
                          </div>
                        )}


                        <p>
                          PNG, JPG/JPEG ou WebP.
                          Máximo de 8 MB.
                        </p>


                        <label className="admin-upload-control">
                          <span className="button button-ghost">
                            {assetOperation ===
                            "cover"
                              ? "Enviando capa..."
                              : editingProduct.cover
                                ? "Substituir capa"
                                : "Enviar capa"}
                          </span>

                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                            disabled={
                              assetOperation !==
                              null
                            }
                            onChange={
                              (
                                event
                              ) => {
                                const file =
                                  event
                                    .currentTarget
                                    .files?.[0];


                                event.currentTarget.value =
                                  "";


                                if (
                                  file
                                ) {
                                  void uploadAsset(
                                    "cover",
                                    file
                                  );
                                }
                              }
                            }
                          />
                        </label>


                        {editingProduct.cover && (
                          <button
                            type="button"
                            className="admin-asset-remove"
                            disabled={
                              assetOperation !==
                              null
                            }
                            onClick={
                              () =>
                                void removeAsset(
                                  "cover"
                                )
                            }
                          >
                            Remover capa
                          </button>
                        )}
                      </article>


                      <article className="admin-asset-card">
                        <div className="admin-asset-card-header">
                          <div>
                            <span className="admin-asset-label">
                              PDF ORIGINAL
                            </span>

                            <strong>
                              {editingProduct.pdfPath
                                ? "✓ PDF cadastrado"
                                : "○ PDF pendente"}
                            </strong>
                          </div>

                          <span
                            className={
                              editingProduct.pdfPath
                                ? "admin-asset-status ready"
                                : "admin-asset-status pending"
                            }
                          >
                            {editingProduct.pdfPath
                              ? "Protegido"
                              : "Pendente"}
                          </span>
                        </div>


                        <div className="admin-private-file-note">
                          <strong>
                            🔒 Armazenamento privado
                          </strong>

                          <span>
                            O arquivo original não possui URL
                            pública direta.
                          </span>
                        </div>


                        <p>
                          Apenas PDF. Máximo de 120 MB.
                          O arquivo será personalizado somente
                          no momento do download do comprador.
                        </p>


                        <label className="admin-upload-control">
                          <span className="button button-ghost">
                            {assetOperation ===
                            "pdf"
                              ? "Enviando PDF..."
                              : editingProduct.pdfPath
                                ? "Substituir PDF"
                                : "Enviar PDF"}
                          </span>

                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            disabled={
                              assetOperation !==
                              null
                            }
                            onChange={
                              (
                                event
                              ) => {
                                const file =
                                  event
                                    .currentTarget
                                    .files?.[0];


                                event.currentTarget.value =
                                  "";


                                if (
                                  file
                                ) {
                                  void uploadAsset(
                                    "pdf",
                                    file
                                  );
                                }
                              }
                            }
                          />
                        </label>


                        {editingProduct.pdfPath && (
                          <button
                            type="button"
                            className="admin-asset-remove"
                            disabled={
                              assetOperation !==
                              null
                            }
                            onClick={
                              () =>
                                void removeAsset(
                                  "pdf"
                                )
                            }
                          >
                            Remover PDF
                          </button>
                        )}
                      </article>
                    </div>
                  )}
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
                      saving ||
                      assetOperation !==
                        null
                    }
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={
                      saving ||
                      assetOperation !==
                        null
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