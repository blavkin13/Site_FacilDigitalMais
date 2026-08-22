import type {
  NewProduct,
} from "../db/schema";


type CommonEditableProductValues =
  Pick<
    NewProduct,
    | "slug"
    | "title"
    | "shortTitle"
    | "category"
    | "bank"
    | "level"
    | "organization"
    | "contestSlug"
    | "pages"
    | "questions"
    | "oldPrice"
    | "price"
    | "pixPrice"
    | "updated"
    | "coverClass"
    | "kicker"
    | "description"
    | "seoTitle"
    | "seoDescription"
    | "highlights"
    | "syllabus"
    | "testimonial"
    | "mpLink"
  >;


export type AdminProductCreateValues =
  CommonEditableProductValues & {
    slug: string;
    title: string;
    price: number;
    active: false;
  };


export type AdminProductPatchValues =
  Partial<
    CommonEditableProductValues &
      Pick<
        NewProduct,
        "active"
      >
  >;


type JsonRecord =
  Record<
    string,
    unknown
  >;


const CREATE_FIELDS =
  new Set([
    "slug",
    "title",
    "shortTitle",
    "category",
    "bank",
    "level",
    "organization",
    "contestSlug",
    "pages",
    "questions",
    "oldPrice",
    "price",
    "pixPrice",
    "updated",
    "coverClass",
    "kicker",
    "description",
    "seoTitle",
    "seoDescription",
    "highlights",
    "syllabus",
    "testimonial",
    "mpLink",
  ]);


const PATCH_FIELDS =
  new Set([
    "id",
    ...CREATE_FIELDS,
    "active",
  ]);


const MAX_MONEY =
  1_000_000;


export class AdminProductValidationError
  extends Error {
  readonly field:
    string | null;


  constructor(
    message: string,
    field: string | null = null
  ) {
    super(
      message
    );

    this.name =
      "AdminProductValidationError";

    this.field =
      field;
  }
}


function fail(
  message: string,
  field: string | null = null
): never {
  throw new AdminProductValidationError(
    message,
    field
  );
}


function isRecord(
  value: unknown
): value is JsonRecord {
  return (
    typeof value ===
      "object" &&
    value !==
      null &&
    !Array.isArray(
      value
    )
  );
}


function requireRecord(
  value: unknown
): JsonRecord {
  if (
    !isRecord(
      value
    )
  ) {
    fail(
      "O corpo da requisição deve ser um objeto JSON."
    );
  }


  return value;
}


function hasField(
  record: JsonRecord,
  field: string
): boolean {
  return Object.prototype
    .hasOwnProperty.call(
      record,
      field
    );
}


function assertAllowedFields(
  record: JsonRecord,
  allowedFields: Set<string>
): void {
  for (
    const field of Object.keys(
      record
    )
  ) {
    if (
      !allowedFields.has(
        field
      )
    ) {
      fail(
        `Campo "${field}" não é permitido nesta operação.`,
        field
      );
    }
  }
}


function requiredString(
  record: JsonRecord,
  field: string,
  maxLength: number
): string {
  const value =
    record[field];


  if (
    typeof value !==
    "string"
  ) {
    fail(
      `O campo "${field}" deve ser texto.`,
      field
    );
  }


  const normalized =
    value.trim();


  if (
    !normalized
  ) {
    fail(
      `O campo "${field}" é obrigatório.`,
      field
    );
  }


  if (
    normalized.length >
    maxLength
  ) {
    fail(
      `O campo "${field}" excede o limite de ${maxLength} caracteres.`,
      field
    );
  }


  return normalized;
}


function optionalRequiredString(
  record: JsonRecord,
  field: string,
  maxLength: number
): string | undefined {
  if (
    !hasField(
      record,
      field
    )
  ) {
    return undefined;
  }


  return requiredString(
    record,
    field,
    maxLength
  );
}


function optionalNullableString(
  record: JsonRecord,
  field: string,
  maxLength: number
): string | null | undefined {
  if (
    !hasField(
      record,
      field
    )
  ) {
    return undefined;
  }


  const value =
    record[field];


  if (
    value ===
    null
  ) {
    return null;
  }


  if (
    typeof value !==
    "string"
  ) {
    fail(
      `O campo "${field}" deve ser texto ou null.`,
      field
    );
  }


  const normalized =
    value.trim();


  if (
    !normalized
  ) {
    return null;
  }


  if (
    normalized.length >
    maxLength
  ) {
    fail(
      `O campo "${field}" excede o limite de ${maxLength} caracteres.`,
      field
    );
  }


  return normalized;
}


function normalizeSlug(
  value: unknown
): string {
  if (
    typeof value !==
    "string"
  ) {
    fail(
      'O campo "slug" deve ser texto.',
      "slug"
    );
  }


  const slug =
    value.trim();


  if (
    slug.length <
      3 ||
    slug.length >
      120
  ) {
    fail(
      'O campo "slug" deve possuir entre 3 e 120 caracteres.',
      "slug"
    );
  }


  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
      slug
    )
  ) {
    fail(
      'O campo "slug" deve conter apenas letras minúsculas, números e hífens.',
      "slug"
    );
  }


  return slug;
}


function requiredSlug(
  record: JsonRecord
): string {
  if (
    !hasField(
      record,
      "slug"
    )
  ) {
    fail(
      'O campo "slug" é obrigatório.',
      "slug"
    );
  }


  return normalizeSlug(
    record.slug
  );
}


function optionalSlug(
  record: JsonRecord
): string | undefined {
  if (
    !hasField(
      record,
      "slug"
    )
  ) {
    return undefined;
  }


  return normalizeSlug(
    record.slug
  );
}

function optionalNullableSlugField(
  record:
    JsonRecord,
  field:
    string
): string | null | undefined {
  const value =
    optionalNullableString(
      record,
      field,
      120
    );


  if (
    value ===
      undefined ||
    value ===
      null
  ) {
    return value;
  }


  if (
    value.length <
      3 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
      value
    )
  ) {
    fail(
      `O campo "${field}" deve conter apenas letras minúsculas, números e hífens.`,
      field
    );
  }


  return value;
}

function normalizeNumber(
  value: unknown,
  field: string,
  {
    minimum = 0,
    maximum =
      Number.MAX_SAFE_INTEGER,
    integer = false,
    greaterThanZero = false,
  }: {
    minimum?: number;
    maximum?: number;
    integer?: boolean;
    greaterThanZero?: boolean;
  } = {}
): number {
  if (
    typeof value !==
      "number" ||
    !Number.isFinite(
      value
    )
  ) {
    fail(
      `O campo "${field}" deve ser um número válido.`,
      field
    );
  }


  if (
    integer &&
    !Number.isSafeInteger(
      value
    )
  ) {
    fail(
      `O campo "${field}" deve ser um número inteiro.`,
      field
    );
  }


  if (
    greaterThanZero
      ? value <= 0
      : value < minimum
  ) {
    fail(
      greaterThanZero
        ? `O campo "${field}" deve ser maior que zero.`
        : `O campo "${field}" não pode ser menor que ${minimum}.`,
      field
    );
  }


  if (
    value >
    maximum
  ) {
    fail(
      `O campo "${field}" excede o valor máximo permitido.`,
      field
    );
  }


  return value;
}


function requiredPrice(
  record: JsonRecord
): number {
  if (
    !hasField(
      record,
      "price"
    )
  ) {
    fail(
      'O campo "price" é obrigatório.',
      "price"
    );
  }


  return normalizeNumber(
    record.price,
    "price",
    {
      greaterThanZero:
        true,

      maximum:
        MAX_MONEY,
    }
  );
}


function optionalRequiredPrice(
  record: JsonRecord
): number | undefined {
  if (
    !hasField(
      record,
      "price"
    )
  ) {
    return undefined;
  }


  return normalizeNumber(
    record.price,
    "price",
    {
      greaterThanZero:
        true,

      maximum:
        MAX_MONEY,
    }
  );
}


function optionalNumber(
  record: JsonRecord,
  field: string,
  options: {
    minimum?: number;
    maximum?: number;
    integer?: boolean;
  } = {}
): number | null | undefined {
  if (
    !hasField(
      record,
      field
    )
  ) {
    return undefined;
  }


  if (
    record[field] ===
    null
  ) {
    return null;
  }


  return normalizeNumber(
    record[field],
    field,
    options
  );
}


function optionalBoolean(
  record: JsonRecord,
  field: string
): boolean | undefined {
  if (
    !hasField(
      record,
      field
    )
  ) {
    return undefined;
  }


  if (
    typeof record[field] !==
    "boolean"
  ) {
    fail(
      `O campo "${field}" deve ser booleano.`,
      field
    );
  }


  return record[field];
}


function normalizeStringArray(
  value: unknown,
  field: string,
  {
    maxItems,
    maxLength,
  }: {
    maxItems: number;
    maxLength: number;
  }
): string[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    fail(
      `O campo "${field}" deve ser um array.`,
      field
    );
  }


  if (
    value.length >
    maxItems
  ) {
    fail(
      `O campo "${field}" aceita no máximo ${maxItems} itens.`,
      field
    );
  }


  return value.map(
    (
      item,
      index
    ) => {
      if (
        typeof item !==
        "string"
      ) {
        fail(
          `O item ${index + 1} de "${field}" deve ser texto.`,
          field
        );
      }


      const normalized =
        item.trim();


      if (
        !normalized
      ) {
        fail(
          `O item ${index + 1} de "${field}" não pode estar vazio.`,
          field
        );
      }


      if (
        normalized.length >
        maxLength
      ) {
        fail(
          `O item ${index + 1} de "${field}" excede ${maxLength} caracteres.`,
          field
        );
      }


      return normalized;
    }
  );
}


function optionalHighlights(
  record: JsonRecord
): string | null | undefined {
  if (
    !hasField(
      record,
      "highlights"
    )
  ) {
    return undefined;
  }


  if (
    record.highlights ===
    null
  ) {
    return null;
  }


  const highlights =
    normalizeStringArray(
      record.highlights,
      "highlights",
      {
        maxItems:
          30,

        maxLength:
          240,
      }
    );


  return JSON.stringify(
    highlights
  );
}


function normalizeSyllabusItem(
  value: unknown,
  index: number
) {
  if (
    !isRecord(
      value
    )
  ) {
    fail(
      `A disciplina ${index + 1} de "syllabus" deve ser um objeto.`,
      "syllabus"
    );
  }


  assertAllowedFields(
    value,
    new Set([
      "title",
      "pages",
      "questions",
      "topics",
    ])
  );


  const title =
    requiredString(
      value,
      "title",
      160
    );


  if (
    !hasField(
      value,
      "pages"
    )
  ) {
    fail(
      `A disciplina "${title}" deve informar pages.`,
      "syllabus"
    );
  }


  if (
    !hasField(
      value,
      "questions"
    )
  ) {
    fail(
      `A disciplina "${title}" deve informar questions.`,
      "syllabus"
    );
  }


  const pages =
    normalizeNumber(
      value.pages,
      "pages",
      {
        minimum:
          0,

        maximum:
          100_000,

        integer:
          true,
      }
    );


  const questions =
    normalizeNumber(
      value.questions,
      "questions",
      {
        minimum:
          0,

        maximum:
          100_000,

        integer:
          true,
      }
    );


  const topics =
    hasField(
      value,
      "topics"
    )
      ? normalizeStringArray(
          value.topics,
          "topics",
          {
            maxItems:
              100,

            maxLength:
              240,
          }
        )
      : [];


  return {
    title,
    pages,
    questions,
    topics,
  };
}


function optionalSyllabus(
  record: JsonRecord
): string | null | undefined {
  if (
    !hasField(
      record,
      "syllabus"
    )
  ) {
    return undefined;
  }


  if (
    record.syllabus ===
    null
  ) {
    return null;
  }


  if (
    !Array.isArray(
      record.syllabus
    )
  ) {
    fail(
      'O campo "syllabus" deve ser um array.',
      "syllabus"
    );
  }


  if (
    record.syllabus.length >
    100
  ) {
    fail(
      'O campo "syllabus" aceita no máximo 100 disciplinas.',
      "syllabus"
    );
  }


  return JSON.stringify(
    record.syllabus.map(
      normalizeSyllabusItem
    )
  );
}


function optionalTestimonial(
  record: JsonRecord
): string | null | undefined {
  if (
    !hasField(
      record,
      "testimonial"
    )
  ) {
    return undefined;
  }


  if (
    record.testimonial ===
    null
  ) {
    return null;
  }


  if (
    !isRecord(
      record.testimonial
    )
  ) {
    fail(
      'O campo "testimonial" deve ser um objeto ou null.',
      "testimonial"
    );
  }


  assertAllowedFields(
    record.testimonial,
    new Set([
      "name",
      "role",
      "quote",
      "score",
    ])
  );


  const testimonial = {
    name:
      requiredString(
        record.testimonial,
        "name",
        120
      ),

    role:
      requiredString(
        record.testimonial,
        "role",
        160
      ),

    quote:
      requiredString(
        record.testimonial,
        "quote",
        1200
      ),

    score:
      requiredString(
        record.testimonial,
        "score",
        120
      ),
  };


  return JSON.stringify(
    testimonial
  );
}


function optionalHttpsUrl(
  record: JsonRecord,
  field: string
): string | null | undefined {
  const value =
    optionalNullableString(
      record,
      field,
      2048
    );


  if (
    value ===
      undefined ||
    value ===
      null
  ) {
    return value;
  }


  let parsed:
    URL;


  try {
    parsed =
      new URL(
        value
      );
  } catch {
    fail(
      `O campo "${field}" deve conter uma URL válida.`,
      field
    );
  }


  if (
    parsed.protocol !==
    "https:"
  ) {
    fail(
      `O campo "${field}" deve utilizar HTTPS.`,
      field
    );
  }


  return parsed.toString();
}


export function validateAdminProductId(
  value: unknown
): number {
  let normalized:
    number;


  if (
    typeof value ===
    "number"
  ) {
    normalized =
      value;
  } else if (
    typeof value ===
      "string" &&
    /^\d+$/.test(
      value
    )
  ) {
    normalized =
      Number(
        value
      );
  } else {
    fail(
      "ID da apostila inválido.",
      "id"
    );
  }


  if (
    !Number.isSafeInteger(
      normalized
    ) ||
    normalized <=
      0
  ) {
    fail(
      "ID da apostila inválido.",
      "id"
    );
  }


  return normalized;
}


export function validateAdminProductCreate(
  input: unknown
): AdminProductCreateValues {
  const record =
    requireRecord(
      input
    );


  assertAllowedFields(
    record,
    CREATE_FIELDS
  );


  return {
    slug:
      requiredSlug(
        record
      ),

    title:
      requiredString(
        record,
        "title",
        180
      ),

    shortTitle:
      optionalNullableString(
        record,
        "shortTitle",
        120
      ),

    category:
      optionalNullableString(
        record,
        "category",
        100
      ),

    bank:
      optionalNullableString(
        record,
        "bank",
        100
      ),

    level:
      optionalNullableString(
        record,
        "level",
        80
      ),

    organization:
      optionalNullableString(
        record,
        "organization",
        120
      ),

    contestSlug:
      optionalNullableSlugField(
        record,
        "contestSlug"
      ),

    pages:
      optionalNumber(
        record,
        "pages",
        {
          minimum:
            0,

          maximum:
            100_000,

          integer:
            true,
        }
      ),

    questions:
      optionalNumber(
        record,
        "questions",
        {
          minimum:
            0,

          maximum:
            100_000,

          integer:
            true,
        }
      ),

    oldPrice:
      optionalNumber(
        record,
        "oldPrice",
        {
          minimum:
            0,

          maximum:
            MAX_MONEY,
        }
      ),

    price:
      requiredPrice(
        record
      ),

    pixPrice:
      optionalNumber(
        record,
        "pixPrice",
        {
          minimum:
            0,

          maximum:
            MAX_MONEY,
        }
      ),

    updated:
      optionalNullableString(
        record,
        "updated",
        100
      ),

    coverClass:
      optionalNullableString(
        record,
        "coverClass",
        80
      ),

    kicker:
      optionalNullableString(
        record,
        "kicker",
        600
      ),

    description:
      optionalNullableString(
        record,
        "description",
        5000
      ),

    seoTitle:
      optionalNullableString(
        record,
        "seoTitle",
        70
      ),

    seoDescription:
      optionalNullableString(
        record,
        "seoDescription",
        180
      ),

    highlights:
      optionalHighlights(
        record
      ),

    syllabus:
      optionalSyllabus(
        record
      ),

    testimonial:
      optionalTestimonial(
        record
      ),

    mpLink:
      optionalHttpsUrl(
        record,
        "mpLink"
      ),

    /**
     * Toda nova apostila nasce como rascunho.
     *
     * A publicação é uma operação independente via PATCH.
     */
    active:
      false,
  };
}


export function validateAdminProductPatch(
  input: unknown
): {
  id: number;
  updates: AdminProductPatchValues;
} {
  const record =
    requireRecord(
      input
    );


  assertAllowedFields(
    record,
    PATCH_FIELDS
  );


  if (
    !hasField(
      record,
      "id"
    )
  ) {
    fail(
      "ID da apostila é obrigatório.",
      "id"
    );
  }


  const id =
    validateAdminProductId(
      record.id
    );


  const updates:
    AdminProductPatchValues =
    {};


  const slug =
    optionalSlug(
      record
    );

  if (
    slug !==
    undefined
  ) {
    updates.slug =
      slug;
  }


  const title =
    optionalRequiredString(
      record,
      "title",
      180
    );

  if (
    title !==
    undefined
  ) {
    updates.title =
      title;
  }


  const shortTitle =
    optionalNullableString(
      record,
      "shortTitle",
      120
    );

  if (
    shortTitle !==
    undefined
  ) {
    updates.shortTitle =
      shortTitle;
  }


  const category =
    optionalNullableString(
      record,
      "category",
      100
    );

  if (
    category !==
    undefined
  ) {
    updates.category =
      category;
  }


  const bank =
    optionalNullableString(
      record,
      "bank",
      100
    );

  if (
    bank !==
    undefined
  ) {
    updates.bank =
      bank;
  }


  const level =
    optionalNullableString(
      record,
      "level",
      80
    );

  if (
    level !==
    undefined
  ) {
    updates.level =
      level;
  }

  const organization =
    optionalNullableString(
      record,
      "organization",
      120
    );


  if (
    organization !==
    undefined
  ) {
    updates.organization =
      organization;
  }


  const contestSlug =
    optionalNullableSlugField(
      record,
      "contestSlug"
    );


  if (
    contestSlug !==
    undefined
  ) {
    updates.contestSlug =
      contestSlug;
  }


  const pages =
    optionalNumber(
      record,
      "pages",
      {
        minimum:
          0,

        maximum:
          100_000,

        integer:
          true,
      }
    );

  if (
    pages !==
    undefined
  ) {
    updates.pages =
      pages;
  }


  const questions =
    optionalNumber(
      record,
      "questions",
      {
        minimum:
          0,

        maximum:
          100_000,

        integer:
          true,
      }
    );

  if (
    questions !==
    undefined
  ) {
    updates.questions =
      questions;
  }


  const oldPrice =
    optionalNumber(
      record,
      "oldPrice",
      {
        minimum:
          0,

        maximum:
          MAX_MONEY,
      }
    );

  if (
    oldPrice !==
    undefined
  ) {
    updates.oldPrice =
      oldPrice;
  }


  const price =
    optionalRequiredPrice(
      record
    );

  if (
    price !==
    undefined
  ) {
    updates.price =
      price;
  }


  const pixPrice =
    optionalNumber(
      record,
      "pixPrice",
      {
        minimum:
          0,

        maximum:
          MAX_MONEY,
      }
    );

  if (
    pixPrice !==
    undefined
  ) {
    updates.pixPrice =
      pixPrice;
  }


  const updated =
    optionalNullableString(
      record,
      "updated",
      100
    );

  if (
    updated !==
    undefined
  ) {
    updates.updated =
      updated;
  }


  const coverClass =
    optionalNullableString(
      record,
      "coverClass",
      80
    );

  if (
    coverClass !==
    undefined
  ) {
    updates.coverClass =
      coverClass;
  }


  const kicker =
    optionalNullableString(
      record,
      "kicker",
      600
    );

  if (
    kicker !==
    undefined
  ) {
    updates.kicker =
      kicker;
  }


  const description =
    optionalNullableString(
      record,
      "description",
      5000
    );

  if (
    description !==
    undefined
  ) {
    updates.description =
      description;
  }

  const seoTitle =
    optionalNullableString(
      record,
      "seoTitle",
      70
    );


  if (
    seoTitle !==
    undefined
  ) {
    updates.seoTitle =
      seoTitle;
  }


  const seoDescription =
    optionalNullableString(
      record,
      "seoDescription",
      180
    );


  if (
    seoDescription !==
    undefined
  ) {
    updates.seoDescription =
      seoDescription;
  }

  const highlights =
    optionalHighlights(
      record
    );

  if (
    highlights !==
    undefined
  ) {
    updates.highlights =
      highlights;
  }


  const syllabus =
    optionalSyllabus(
      record
    );

  if (
    syllabus !==
    undefined
  ) {
    updates.syllabus =
      syllabus;
  }


  const testimonial =
    optionalTestimonial(
      record
    );

  if (
    testimonial !==
    undefined
  ) {
    updates.testimonial =
      testimonial;
  }


  const mpLink =
    optionalHttpsUrl(
      record,
      "mpLink"
    );

  if (
    mpLink !==
    undefined
  ) {
    updates.mpLink =
      mpLink;
  }


  const active =
    optionalBoolean(
      record,
      "active"
    );

  if (
    active !==
    undefined
  ) {
    updates.active =
      active;
  }


  if (
    Object.keys(
      updates
    ).length ===
    0
  ) {
    fail(
      "Nenhum campo válido foi informado para atualização."
    );
  }


  return {
    id,
    updates,
  };
}