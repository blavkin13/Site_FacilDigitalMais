import { readFile, watch } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { getDb } from "../db/index";
import { products as productsTable } from "../db/schema";
import { eq } from "drizzle-orm";

const PRODUCTS_JSON_PATH = join(process.cwd(), "data", "products.json");

// Carregar produtos do JSON para o banco de dados
export async function loadProductsToDb(): Promise<number> {
  if (!existsSync(PRODUCTS_JSON_PATH)) {
    console.log(`⚠️  Arquivo não encontrado: ${PRODUCTS_JSON_PATH}`);
    return 0;
  }

  try {
    const content = await readFile(PRODUCTS_JSON_PATH, "utf-8");
    const productsData = JSON.parse(content);
    const db = getDb();

    let created = 0;
    let updated = 0;

    for (const product of productsData) {
      const existing = await db
        .select()
        .from(productsTable)
        .where(eq(productsTable.slug, product.slug))
        .get();

      const productData = {
        ...product,
        highlights: product.highlights ? JSON.stringify(product.highlights) : null,
        syllabus: product.syllabus ? JSON.stringify(product.syllabus) : null,
        testimonial: product.testimonial ? JSON.stringify(product.testimonial) : null,
      };

      if (existing) {
        await db
          .update(productsTable)
          .set(productData)
          .where(eq(productsTable.slug, product.slug));
        updated++;
      } else {
        await db.insert(productsTable).values(productData);
        created++;
      }
    }

    console.log(`✅ Produtos carregados: ${created} criados, ${updated} atualizados`);
    return created + updated;
  } catch (error) {
    console.error("❌ Erro ao carregar produtos:", error);
    return 0;
  }
}

// Monitorar mudanças no arquivo (hot-reload)
export async function watchProductsJson(callback?: () => void): Promise<void> {
  if (!existsSync(PRODUCTS_JSON_PATH)) {
    console.log(`⚠️  Arquivo não encontrado para monitorar: ${PRODUCTS_JSON_PATH}`);
    return;
  }

  const { watch: fsWatch } = await import("fs");
  let timeout: NodeJS.Timeout | null = null;

  fsWatch(PRODUCTS_JSON_PATH, () => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(async () => {
      console.log(`🔄 Arquivo products.json alterado, recarregando...`);
      await loadProductsToDb();
      if (callback) callback();
    }, 1000);
  });

  console.log(`👀 Monitorando: ${PRODUCTS_JSON_PATH}`);
}

// Buscar produtos do banco
export async function getProductsFromDb() {
  const db = getDb();
  const products = await db.select().from(productsTable).all();
  return products.map((p) => ({
    ...p,
    highlights: p.highlights ? JSON.parse(p.highlights) : [],
    syllabus: p.syllabus ? JSON.parse(p.syllabus) : [],
    testimonial: p.testimonial ? JSON.parse(p.testimonial) : null,
  }));
}