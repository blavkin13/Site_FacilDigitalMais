import type {
  Product as DatabaseProduct,
} from "../db/schema";


export type ProductPublicationIssue = {
  field:
    string;

  message:
    string;
};


type PublishableProduct =
  Pick<
    DatabaseProduct,
    | "slug"
    | "title"
    | "shortTitle"
    | "category"
    | "bank"
    | "level"
    | "organization"
    | "contestSlug"
    | "description"
    | "price"
    | "cover"
    | "pdfPath"
  >;


function hasText(
  value:
    string | null
): boolean {
  return Boolean(
    value?.trim()
  );
}


export function getProductPublicationIssues(
  product:
    PublishableProduct
): ProductPublicationIssue[] {
  const issues:
    ProductPublicationIssue[] =
    [];


  const requiredTextFields: Array<{
    field:
      keyof PublishableProduct;

    label:
      string;
  }> = [
    {
      field:
        "slug",

      label:
        "Slug",
    },

    {
      field:
        "title",

      label:
        "Título",
    },

    {
      field:
        "shortTitle",

      label:
        "Cargo / especialidade",
    },

    {
      field:
        "organization",

      label:
        "Órgão / organização",
    },

    {
      field:
        "contestSlug",

      label:
        "Slug do concurso",
    },

    {
      field:
        "category",

      label:
        "Categoria",
    },

    {
      field:
        "bank",

      label:
        "Banca",
    },

    {
      field:
        "level",

      label:
        "Nível",
    },

    {
      field:
        "description",

      label:
        "Descrição",
    },

    {
      field:
        "cover",

      label:
        "Capa",
    },

    {
      field:
        "pdfPath",

      label:
        "PDF",
    },
  ];


  for (
    const {
      field,
      label,
    } of requiredTextFields
  ) {
    const value =
      product[
        field
      ];


    if (
      typeof value !==
        "string" ||
      !hasText(
        value
      )
    ) {
      issues.push({
        field,

        message:
          `${label} é obrigatório para publicação.`,
      });
    }
  }


  if (
    !Number.isFinite(
      product.price
    ) ||
    product.price <=
      0
  ) {
    issues.push({
      field:
        "price",

      message:
        "Preço deve ser maior que zero.",
    });
  }


  return issues;
}


export function isProductReadyForPublication(
  product:
    PublishableProduct
): boolean {
  return (
    getProductPublicationIssues(
      product
    ).length ===
    0
  );
}