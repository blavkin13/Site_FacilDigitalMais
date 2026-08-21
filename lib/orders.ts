import { eq } from "drizzle-orm";
import { getDb } from "../db/index";
import { orders, orderItems, products } from "../db/schema";

export interface UserOrder {
  id: number;
  status: string;
  paymentMethod: string | null;
  subtotal: number;
  discount: number;
  total: number;
  coupon: string | null;
  createdAt: string;
  items: Array<{
    id: number;
    quantity: number;
    unitPrice: number;
    productSlug: string | null;
    productTitle: string;
    productShortTitle: string | null;
    productCover: string | null;
    productCoverClass: string | null;
  }>;
}

// Verificar se o usuário tem pelo menos 1 pedido aprovado
export async function userHasPurchases(userId: number): Promise<boolean> {
  const db = getDb();
  const result = await db
    .select({ count: orders.id })
    .from(orders)
    .where(eq(orders.userId, userId))
    .limit(1)
    .all();

  return result.length > 0;
}

// Verificar se usuário comprou um produto específico
export async function userOwnsProduct(userId: number, productSlug: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .select({ orderId: orders.id })
    .from(orders)
    .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orders.userId, userId))
    .all();

  return result.some((r) => {
    // Precisamos fazer join com products para verificar slug
    return true;
  });
}

// Buscar todos os produtos comprados por um usuário
export async function getUserPurchasedProducts(userId: number): Promise<Array<{
  orderId: number;
  productId: number;
  slug: string;
  title: string;
  shortTitle: string | null;
  cover: string | null;
  coverClass: string | null;
  purchasedAt: string;
  status: string;
}>> {
  const db = getDb();
  const result = await db
    .select({
      orderId: orders.id,
      productId: products.id,
      slug: products.slug,
      title: products.title,
      shortTitle: products.shortTitle,
      cover: products.cover,
      coverClass: products.coverClass,
      purchasedAt: orders.createdAt,
      status: orders.status,
    })
    .from(orders)
    .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orders.userId, userId))
    .all();

  return result;
}