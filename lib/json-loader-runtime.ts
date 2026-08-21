import {
  readFile,
} from "node:fs/promises";

import {
  existsSync,
} from "node:fs";

import {
  join,
} from "node:path";

import {
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
  type NewProduct,
} from "../db/schema";


const PRODUCTS_JSON_PATH =
  join(
    process.cwd(),
    "data",
    "products.json"
  );


type JsonRecord =
  Record<string, unknown>;


/**
 * ============================================================
 * HELPERS DE VALIDAÇÃO
 * ============================================================
 */

function isRecord(
  value: unknown
): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}


function optionalString(
  value: unknown
): string | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized || null;
}


function optionalNumber(
  value: unknown
): number | null {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value
    : null;
}


function serializeJsonField(
  value: unknown
): string | null {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  return JSON.stringify(
    value
  );
}


/**
 * Valida os campos mínimos que identificam
 * comercialmente uma apostila.
 */
function validateProductInput(
  product: unknown,
  index: number
): asserts product is JsonRecord {
  if (!isRecord(product)) {
    throw new Error(
      `Produto na posição ${index} deve ser um objeto JSON.`
    );
  }

  if (
    typeof product.slug !==
      "string" ||
    !product.slug.trim()
  ) {
    throw new Error(
      `Produto na posição ${index}: slug é obrigatório.`
    );
  }

  if (
    typeof product.title !==
      "string" ||
    !product.title.trim()
  ) {
    throw new Error(
      `Produto "${product.slug}": title é obrigatório.`
    );
  }

  if (
    typeof product.price !==
      "number" ||
    !Number.isFinite(
      product.price
    ) ||
    product.price <= 0
  ) {
    throw new Error(
      `Produto "${product.slug}": price deve ser um número maior que zero.`
    );
  }

  if (
    product.highlights !==
      undefined &&
    product.highlights !==
      null &&
    !Array.isArray(
      product.highlights
    )
  ) {
    throw new Error(
      `Produto "${product.slug}": highlights deve ser um array.`
    );
  }

  if (
    product.syllabus !==
      undefined &&
    product.syllabus !==
      null &&
    !Array.isArray(
      product.syllabus
    )
  ) {
    throw new Error(
      `Produto "${product.slug}": syllabus deve ser um array.`
    );
  }

  if (
    product.testimonial !==
      undefined &&
    product.testimonial !==
      null &&
    !isRecord(
      product.testimonial
    )
  ) {
    throw new Error(
      `Produto "${product.slug}": testimonial deve ser um objeto.`
    );
  }
}


/**
 * Converte o objeto JSON somente para campos
 * existentes em db/schema.ts.
 *
 * Não utilizamos:
 *
 *   ...product
 *
 * porque arquivos externos não devem conseguir
 * enviar propriedades arbitrárias diretamente
 * para o ORM.
 */
function mapJsonProductToDatabase(
  product: JsonRecord
): NewProduct {
  return {
    slug:
      String(
        product.slug
      ).trim(),

    title:
      String(
        product.title
      ).trim(),

    shortTitle:
      optionalString(
        product.shortTitle
      ),

    category:
      optionalString(
        product.category
      ),

    bank:
      optionalString(
        product.bank
      ),

    level:
      optionalString(
        product.level
      ),

    pages:
      optionalNumber(
        product.pages
      ),

    questions:
      optionalNumber(
        product.questions
      ),

    oldPrice:
      optionalNumber(
        product.oldPrice
      ),

    price:
      Number(
        product.price
      ),

    pixPrice:
      optionalNumber(
        product.pixPrice
      ),

    updated:
      optionalString(
        product.updated
      ),

    cover:
      optionalString(
        product.cover
      ),

    coverClass:
      optionalString(
        product.coverClass
      ),

    kicker:
      optionalString(
        product.kicker
      ),

    description:
      optionalString(
        product.description
      ),

    highlights:
      serializeJsonField(
        product.highlights
      ),

    syllabus:
      serializeJsonField(
        product.syllabus
      ),

    testimonial:
      serializeJsonField(
        product.testimonial
      ),

    mpLink:
      optionalString(
        product.mpLink
      ),

    pdfPath:
      optionalString(
        product.pdfPath
      ),

    active:
      typeof product.active ===
      "boolean"
        ? product.active
        : true,
  };
}


/**
 * ============================================================
 * IMPORTAÇÃO JSON → SQLITE
 * ============================================================
 */

export async function loadProductsToDb(): Promise<number> {
  await initDatabase();

  if (
    !existsSync(
      PRODUCTS_JSON_PATH
    )
  ) {
    throw new Error(
      `Arquivo de produtos não encontrado: ${PRODUCTS_JSON_PATH}`
    );
  }

  const content =
    await readFile(
      PRODUCTS_JSON_PATH,
      "utf-8"
    );

  let parsed: unknown;

  try {
    parsed =
      JSON.parse(content);
  } catch (error) {
    throw new Error(
      `products.json contém JSON inválido: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      "products.json deve conter um array de produtos."
    );
  }

  const db = getDb();

  let created = 0;
  let updated = 0;

  for (
    let index = 0;
    index < parsed.length;
    index++
  ) {
    const product =
      parsed[index];

    validateProductInput(
      product,
      index
    );

    const productData =
      mapJsonProductToDatabase(
        product
      );

    const existing =
      await db
        .select()
        .from(
          productsTable
        )
        .where(
          eq(
            productsTable.slug,
            productData.slug
          )
        )
        .get();

    if (existing) {
      await db
        .update(
          productsTable
        )
        .set({
          ...productData,
          updatedAt:
            new Date()
              .toISOString(),
        })
        .where(
          eq(
            productsTable.slug,
            productData.slug
          )
        );

      updated++;
    } else {
      await db
        .insert(
          productsTable
        )
        .values(
          productData
        );

      created++;
    }
  }

  console.log(
    `✅ Produtos carregados: ${created} criados, ${updated} atualizados`
  );

  return (
    created +
    updated
  );
}


/**
 * ============================================================
 * HOT RELOAD DO JSON
 * ============================================================
 *
 * Mantido por compatibilidade com as fases antigas.
 *
 * Não será utilizado em produção quando o painel
 * administrativo assumir a criação de apostilas.
 */

export async function watchProductsJson(
  callback?: () => void
): Promise<void> {
  if (
    !existsSync(
      PRODUCTS_JSON_PATH
    )
  ) {
    console.log(
      `⚠️ Arquivo não encontrado para monitorar: ${PRODUCTS_JSON_PATH}`
    );

    return;
  }

  const {
    watch: fsWatch,
  } = await import(
    "node:fs"
  );

  let timeout:
    NodeJS.Timeout |
    null = null;

  fsWatch(
    PRODUCTS_JSON_PATH,
    () => {
      if (timeout) {
        clearTimeout(
          timeout
        );
      }

      timeout =
        setTimeout(
          async () => {
            try {
              console.log(
                "🔄 products.json alterado. Atualizando SQLite..."
              );

              await loadProductsToDb();

              callback?.();
            } catch (error) {
              console.error(
                "❌ Falha ao atualizar products.json:",
                error
              );
            }
          },
          1000
        );
    }
  );

  console.log(
    `👀 Monitorando: ${PRODUCTS_JSON_PATH}`
  );
}


/**
 * ============================================================
 * COMPATIBILIDADE
 * ============================================================
 *
 * Esta função permanece disponível porque testes e
 * ferramentas antigas do projeto ainda a utilizam.
 *
 * O storefront novo utilizará product-repository.ts.
 */

export async function getProductsFromDb() {
  await initDatabase();

  const db = getDb();

  const databaseProducts =
    await db
      .select()
      .from(
        productsTable
      )
      .all();

  return databaseProducts.map(
    (product) => ({
      ...product,

      highlights:
        product.highlights
          ? JSON.parse(
              product.highlights
            )
          : [],

      syllabus:
        product.syllabus
          ? JSON.parse(
              product.syllabus
            )
          : [],

      testimonial:
        product.testimonial
          ? JSON.parse(
              product.testimonial
            )
          : null,
    })
  );
}