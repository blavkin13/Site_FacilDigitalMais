import {
  asc,
  desc,
  eq,
} from "drizzle-orm";

import {
  initDatabase,
} from "../db/init";

import {
  getDb,
} from "../db/index";

import {
  products as productsTable,
  type Product as DatabaseProduct,
} from "../db/schema";

import type {
  Product,
} from "./products";

/**
 * ============================================================
 * PRODUCT REPOSITORY
 * ============================================================
 *
 * Esta é a camada oficial de leitura dos produtos/apostilas.
 *
 * A partir da Fase 1B:
 *
 * - Home
 * - Catálogo
 * - Landing page da apostila
 * - Landing page do concurso
 * - Sitemap
 *
 * deixarão de acessar produtos hardcoded e passarão a
 * utilizar exclusivamente estas funções.
 *
 * IMPORTANTE:
 *
 * Este arquivo é server-side.
 *
 * Não deve ser importado diretamente por componentes
 * marcados com "use client".
 * ============================================================
 */


/**
 * Faz parsing seguro de JSON.
 *
 * Dados antigos ou corrompidos no banco não devem derrubar
 * o catálogo inteiro.
 */
function parseJson(
  value: string | null
): unknown {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}


/**
 * Verifica se um valor é um objeto simples.
 */
function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}


/**
 * Converte highlights persistidos em JSON para string[].
 */
function parseHighlights(
  value: string | null
): string[] {
  const parsed = parseJson(value);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .filter(
      (item): item is string =>
        typeof item === "string"
    )
    .map((item) => item.trim())
    .filter(Boolean);
}


/**
 * Converte o conteúdo programático armazenado em JSON
 * para o formato utilizado pelo frontend.
 */
function parseSyllabus(
  value: string | null
): Product["syllabus"] {
  const parsed = parseJson(value);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .filter(isRecord)
    .map((item) => {
      const topics = Array.isArray(
        item.topics
      )
        ? item.topics
            .filter(
              (
                topic
              ): topic is string =>
                typeof topic === "string"
            )
            .map(
              (topic) =>
                topic.trim()
            )
            .filter(Boolean)
        : [];

      return {
        title:
          typeof item.title ===
          "string"
            ? item.title.trim()
            : "",

        pages:
          typeof item.pages ===
          "number"
            ? item.pages
            : 0,

        questions:
          typeof item.questions ===
          "number"
            ? item.questions
            : 0,

        topics,
      };
    })
    .filter(
      (item) =>
        item.title.length > 0
    );
}


/**
 * Converte o depoimento persistido em JSON.
 *
 * O tipo atual do frontend espera sempre um objeto.
 * Enquanto não migramos ProductDetail para aceitar
 * testimonial opcional, retornamos um objeto vazio
 * caso o banco não possua depoimento.
 */
function parseTestimonial(
  value: string | null
): Product["testimonial"] {
  const parsed = parseJson(value);

  if (!isRecord(parsed)) {
    return {
      name: "",
      role: "",
      quote: "",
      score: "",
    };
  }

  return {
    name:
      typeof parsed.name ===
      "string"
        ? parsed.name
        : "",

    role:
      typeof parsed.role ===
      "string"
        ? parsed.role
        : "",

    quote:
      typeof parsed.quote ===
      "string"
        ? parsed.quote
        : "",

    score:
      typeof parsed.score ===
      "string"
        ? parsed.score
        : "",
  };
}


/**
 * Converte um registro do SQLite para o modelo utilizado
 * atualmente pelos componentes do site.
 *
 * Aqui fazemos a fronteira:
 *
 * SQLite
 *   ↓
 * campos nullable + JSON em TEXT
 *   ↓
 * Produto seguro para o frontend
 */
export function mapDatabaseProduct(
  row: DatabaseProduct
): Product {
  return {
    slug:
      row.slug,

    title:
      row.title,

    shortTitle:
      row.shortTitle?.trim() ||
      row.title,

    category:
      row.category?.trim() ||
      "Outros",

    bank:
      row.bank?.trim() ||
      "Banca não informada",

    level:
      row.level?.trim() ||
      "Nível não informado",

    pages:
      row.pages ?? 0,

    questions:
      row.questions ?? 0,

    oldPrice:
      row.oldPrice ??
      row.price,

    price:
      row.price,

    pixPrice:
      row.pixPrice ??
      Number(
        (
          row.price * 0.95
        ).toFixed(2)
      ),

    updated:
      row.updated?.trim() ||
      "",

    cover:
      row.cover?.trim() ||
      "",

    coverClass:
      row.coverClass?.trim() ||
      "default",

    kicker:
      row.kicker?.trim() ||
      row.description?.trim() ||
      "",

    description:
      row.description?.trim() ||
      "",

    highlights:
      parseHighlights(
        row.highlights
      ),

    syllabus:
      parseSyllabus(
        row.syllabus
      ),

    testimonial:
      parseTestimonial(
        row.testimonial
      ),
  };
}


/**
 * Normaliza texto para formato de slug.
 *
 * Exemplo:
 *
 * Banco do Brasil
 *
 * →
 *
 * banco-do-brasil
 */
function slugify(
  value: string
): string {
  return value
    .normalize("NFD")
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


/**
 * Infere o concurso/órgão a partir do título.
 *
 * Formato atual dos produtos:
 *
 * Transpetro — Auxiliar de Saúde
 * Transpetro — Contabilidade
 *
 * Resultado:
 *
 * transpetro
 *
 * Também funciona com nomes compostos:
 *
 * Banco do Brasil — Escriturário
 *
 * →
 *
 * banco-do-brasil
 *
 * Na futura evolução do schema teremos contestSlug
 * explícito. Até lá, esta função centraliza a regra.
 */
export function getContestSlugFromProduct(
  product: Pick<
    Product,
    "title" | "slug"
  >
): string {
  const titleParts =
    product.title.split(
      /\s+[—–]\s+/
    );

  if (
    titleParts.length > 1 &&
    titleParts[0]?.trim()
  ) {
    const titleSlug =
      slugify(
        titleParts[0]
      );

    if (titleSlug) {
      return titleSlug;
    }
  }

  /**
   * Compatibilidade com produtos antigos
   * cujo título não possui travessão.
   */
  const firstSlugPart =
    product.slug
      .split("-")
      .filter(Boolean)[0];

  return (
    firstSlugPart ||
    slugify(product.title)
  );
}


/**
 * Verifica se uma apostila pertence a um concurso.
 */
export function productMatchesContest(
  product: Product,
  contestSlug: string
): boolean {
  const normalizedContest =
    slugify(contestSlug);

  if (!normalizedContest) {
    return false;
  }

  const inferredContest =
    getContestSlugFromProduct(
      product
    );

  if (
    inferredContest ===
    normalizedContest
  ) {
    return true;
  }

  /**
   * Fallback para produtos antigos.
   */
  return product.slug
    .toLowerCase()
    .startsWith(
      `${normalizedContest}-`
    );
}


/**
 * Lista somente apostilas públicas/ativas.
 */
export async function getActiveProducts(): Promise<
  Product[]
> {
  await initDatabase();

  const db = getDb();

  const rows = await db
    .select()
    .from(productsTable)
    .where(
      eq(
        productsTable.active,
        true
      )
    )
    .orderBy(
      desc(
        productsTable.updatedAt
      ),
      asc(
        productsTable.title
      )
    )
    .all();

  return rows.map(
    mapDatabaseProduct
  );
}


/**
 * Busca uma apostila ativa por slug.
 *
 * Produtos desativados nunca são retornados
 * para o storefront público.
 */
export async function getActiveProductBySlug(
  slug: string
): Promise<Product | null> {
  if (!slug?.trim()) {
    return null;
  }

  await initDatabase();

  const db = getDb();

  const row = await db
    .select()
    .from(productsTable)
    .where(
      eq(
        productsTable.slug,
        slug
      )
    )
    .get();

  if (
    !row ||
    row.active !== true
  ) {
    return null;
  }

  return mapDatabaseProduct(
    row
  );
}


/**
 * Retorna produtos relacionados.
 *
 * Priorizamos:
 *
 * 1. mesma categoria;
 * 2. mesma banca;
 * 3. ordem alfabética.
 */
export async function getRelatedProducts(
  currentSlug: string,
  limit = 2
): Promise<Product[]> {
  if (limit <= 0) {
    return [];
  }

  const allProducts =
    await getActiveProducts();

  const currentProduct =
    allProducts.find(
      (product) =>
        product.slug ===
        currentSlug
    );

  return allProducts
    .filter(
      (product) =>
        product.slug !==
        currentSlug
    )
    .sort(
      (a, b) => {
        if (!currentProduct) {
          return a.title.localeCompare(
            b.title,
            "pt-BR"
          );
        }

        const score = (
          product: Product
        ) => {
          let value = 0;

          if (
            product.category ===
            currentProduct.category
          ) {
            value += 2;
          }

          if (
            product.bank ===
            currentProduct.bank
          ) {
            value += 1;
          }

          return value;
        };

        const scoreDifference =
          score(b) -
          score(a);

        if (
          scoreDifference !== 0
        ) {
          return scoreDifference;
        }

        return a.title.localeCompare(
          b.title,
          "pt-BR"
        );
      }
    )
    .slice(
      0,
      limit
    );
}


/**
 * Lista apostilas públicas vinculadas a um concurso.
 */
export async function getProductsByContest(
  contestSlug: string
): Promise<Product[]> {
  const allProducts =
    await getActiveProducts();

  return allProducts.filter(
    (product) =>
      productMatchesContest(
        product,
        contestSlug
      )
  );
}


/**
 * Retorna os concursos encontrados nos produtos ativos.
 *
 * Será usado posteriormente pelo sitemap.
 */
export async function getActiveContestSlugs(): Promise<
  string[]
> {
  const allProducts =
    await getActiveProducts();

  return Array.from(
    new Set(
      allProducts
        .map(
          getContestSlugFromProduct
        )
        .filter(Boolean)
    )
  ).sort();
}