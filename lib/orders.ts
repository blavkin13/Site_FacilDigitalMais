import {
  and,
  eq,
} from "drizzle-orm";

import {
  getDb,
} from "../db/index";

import {
  orderItems,
  orders,
  products,
} from "../db/schema";


export interface UserOrder {
  id:
    number;

  status:
    string;

  paymentMethod:
    string | null;

  subtotal:
    number;

  discount:
    number;

  total:
    number;

  coupon:
    string | null;

  createdAt:
    string;

  items:
    Array<{
      id:
        number;

      quantity:
        number;

      unitPrice:
        number;

      productSlug:
        string | null;

      productTitle:
        string;

      productShortTitle:
        string | null;

      productCover:
        string | null;

      productCoverClass:
        string | null;
    }>;
}


function isValidUserId(
  userId:
    number
): boolean {
  return (
    Number.isInteger(
      userId
    ) &&
    userId >
      0
  );
}


function normalizeProductSlug(
  productSlug:
    string
): string {
  return productSlug
    .trim();
}


/**
 * Retorna true somente quando o usuário possui
 * pelo menos um pedido financeiramente aprovado.
 *
 * pending / rejected / refunded / charged_back
 * nunca representam compra ativa.
 */
export async function userHasPurchases(
  userId:
    number
): Promise<boolean> {
  if (
    !isValidUserId(
      userId
    )
  ) {
    return false;
  }


  const db =
    getDb();


  const approvedOrder =
    await db
      .select({
        id:
          orders.id,
      })
      .from(
        orders
      )
      .where(
        and(
          eq(
            orders.userId,
            userId
          ),

          eq(
            orders.status,
            "approved"
          )
        )
      )
      .limit(
        1
      )
      .get();


  return Boolean(
    approvedOrder
  );
}


/**
 * Verifica entitlement comercial para um produto
 * específico.
 *
 * A propriedade exige simultaneamente:
 *
 * - usuário correto;
 * - pedido approved;
 * - order_item pertencente ao pedido;
 * - produto com o slug solicitado.
 *
 * Possuir outro produto, outro pedido ou um pedido
 * não aprovado nunca satisfaz esta função.
 */
export async function userOwnsProduct(
  userId:
    number,

  productSlug:
    string
): Promise<boolean> {
  if (
    !isValidUserId(
      userId
    )
  ) {
    return false;
  }


  const normalizedSlug =
    normalizeProductSlug(
      productSlug
    );


  if (
    !normalizedSlug
  ) {
    return false;
  }


  const db =
    getDb();


  const approvedPurchase =
    await db
      .select({
        orderId:
          orders.id,
      })
      .from(
        orders
      )
      .innerJoin(
        orderItems,
        eq(
          orders.id,
          orderItems.orderId
        )
      )
      .innerJoin(
        products,
        eq(
          orderItems.productId,
          products.id
        )
      )
      .where(
        and(
          eq(
            orders.userId,
            userId
          ),

          eq(
            orders.status,
            "approved"
          ),

          eq(
            products.slug,
            normalizedSlug
          )
        )
      )
      .limit(
        1
      )
      .get();


  return Boolean(
    approvedPurchase
  );
}


/**
 * Lista somente produtos cujo entitlement continua
 * ativo.
 *
 * Um produto associado exclusivamente a pedido:
 *
 * - pending;
 * - rejected;
 * - refunded;
 * - charged_back;
 *
 * não faz parte da biblioteca comercial ativa.
 */
export async function getUserPurchasedProducts(
  userId:
    number
): Promise<
  Array<{
    orderId:
      number;

    productId:
      number;

    slug:
      string;

    title:
      string;

    shortTitle:
      string | null;

    cover:
      string | null;

    coverClass:
      string | null;

    purchasedAt:
      string;

    status:
      string;
  }>
> {
  if (
    !isValidUserId(
      userId
    )
  ) {
    return [];
  }


  const db =
    getDb();


  return db
    .select({
      orderId:
        orders.id,

      productId:
        products.id,

      slug:
        products.slug,

      title:
        products.title,

      shortTitle:
        products.shortTitle,

      cover:
        products.cover,

      coverClass:
        products.coverClass,

      purchasedAt:
        orders.createdAt,

      status:
        orders.status,
    })
    .from(
      orders
    )
    .innerJoin(
      orderItems,
      eq(
        orders.id,
        orderItems.orderId
      )
    )
    .innerJoin(
      products,
      eq(
        orderItems.productId,
        products.id
      )
    )
    .where(
      and(
        eq(
          orders.userId,
          userId
        ),

        eq(
          orders.status,
          "approved"
        )
      )
    )
    .all();
}