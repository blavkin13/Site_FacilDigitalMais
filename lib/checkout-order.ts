import {
  randomUUID,
} from "node:crypto";

import {
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

import type {
  CartItemForMP,
} from "./mercadopago";


type AppDatabase =
  ReturnType<
    typeof getDb
  >;


export type CheckoutPaymentMethod =
  | "pix"
  | "card"
  | "boleto";


export interface CreatePendingCheckoutOrderInput {
  userId: number;
  items: unknown;
  paymentMethod: unknown;
  coupon?: unknown;
}


export interface PendingCheckoutOrder {
  order:
    typeof orders.$inferSelect;

  externalReference:
    string;

  paymentMethod:
    CheckoutPaymentMethod;

  coupon:
    string | null;

  subtotal:
    number;

  discount:
    number;

  total:
    number;

  mpItems:
    CartItemForMP[];
}


interface PreparedOrderItem {
  productId:
    number;

  slug:
    string;

  title:
    string;

  description:
    string;

  quantity:
    1;

  unitPrice:
    number;
}


export class CheckoutValidationError
  extends Error {
  readonly status =
    400;

  constructor(
    message: string
  ) {
    super(
      message
    );

    this.name =
      "CheckoutValidationError";
  }
}


function roundCurrency(
  value: number
): number {
  return Math.round(
    (
      value +
      Number.EPSILON
    ) *
      100
  ) / 100;
}


function normalizePaymentMethod(
  value: unknown
): CheckoutPaymentMethod {
  if (
    value !== "pix" &&
    value !== "card" &&
    value !== "boleto"
  ) {
    throw new CheckoutValidationError(
      "Forma de pagamento inválida."
    );
  }

  return value;
}


function normalizeCoupon(
  value: unknown
): string | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !==
    "string"
  ) {
    throw new CheckoutValidationError(
      "Cupom inválido."
    );
  }

  const normalized =
    value
      .trim()
      .toUpperCase();

  if (!normalized) {
    return null;
  }

  if (
    normalized !==
    "APROVA10"
  ) {
    throw new CheckoutValidationError(
      "Cupom inválido."
    );
  }

  return normalized;
}


function normalizeRequestedSlugs(
  items: unknown
): string[] {
  if (
    !Array.isArray(
      items
    ) ||
    items.length === 0
  ) {
    throw new CheckoutValidationError(
      "Carrinho vazio."
    );
  }

  const slugs:
    string[] = [];

  const seen =
    new Set<
      string
    >();

  for (
    const rawItem
    of items
  ) {
    if (
      !rawItem ||
      typeof rawItem !==
        "object" ||
      Array.isArray(
        rawItem
      )
    ) {
      throw new CheckoutValidationError(
        "Item do carrinho inválido."
      );
    }

    const item =
      rawItem as {
        slug?: unknown;
        quantity?: unknown;
      };

    if (
      typeof item.slug !==
      "string"
    ) {
      throw new CheckoutValidationError(
        "Produto inválido no carrinho."
      );
    }

    const slug =
      item.slug.trim();

    if (!slug) {
      throw new CheckoutValidationError(
        "Produto inválido no carrinho."
      );
    }

    /**
     * Apostilas são produtos digitais unitários.
     *
     * O navegador não possui autoridade para alterar
     * quantidade e, consequentemente, o valor final.
     */
    if (
      item.quantity !==
        undefined &&
      item.quantity !==
        1
    ) {
      throw new CheckoutValidationError(
        "Quantidade inválida para produto digital."
      );
    }

    if (
      seen.has(
        slug
      )
    ) {
      throw new CheckoutValidationError(
        "Produto duplicado no carrinho."
      );
    }

    seen.add(
      slug
    );

    slugs.push(
      slug
    );
  }

  return slugs;
}


function getProductPrice(
  paymentMethod:
    CheckoutPaymentMethod,
  product: {
    price: number;
    pixPrice:
      number | null;
  }
): number {
  const basePrice =
    Number(
      product.price
    );

  const pixPrice =
    product.pixPrice ===
    null
      ? null
      : Number(
          product.pixPrice
        );

  const selectedPrice =
    paymentMethod ===
      "pix" &&
    pixPrice !== null &&
    Number.isFinite(
      pixPrice
    ) &&
    pixPrice > 0
      ? pixPrice
      : basePrice;

  if (
    !Number.isFinite(
      selectedPrice
    ) ||
    selectedPrice <= 0
  ) {
    throw new CheckoutValidationError(
      "Produto possui preço inválido."
    );
  }

  return roundCurrency(
    selectedPrice
  );
}


export function createPendingCheckoutOrder(
  db: AppDatabase,
  input:
    CreatePendingCheckoutOrderInput
): PendingCheckoutOrder {
  if (
    !Number.isInteger(
      input.userId
    ) ||
    input.userId <= 0
  ) {
    throw new CheckoutValidationError(
      "Usuário inválido."
    );
  }

  const paymentMethod =
    normalizePaymentMethod(
      input.paymentMethod
    );

  const coupon =
    normalizeCoupon(
      input.coupon
    );

  const requestedSlugs =
    normalizeRequestedSlugs(
      input.items
    );

  /**
   * O banco é a autoridade sobre:
   *
   * - existência do produto;
   * - publicação/atividade;
   * - preço;
   * - preço PIX.
   *
   * Nenhum preço recebido do navegador é utilizado.
   */
  const databaseProducts =
    db
      .select()
      .from(
        products
      )
      .all();

  const productsBySlug =
    new Map(
      databaseProducts.map(
        (
          product
        ) => [
          product.slug,
          product,
        ]
      )
    );

  const preparedItems:
    PreparedOrderItem[] =
      [];

  let subtotal =
    0;

  for (
    const slug
    of requestedSlugs
  ) {
    const product =
      productsBySlug.get(
        slug
      );

    if (
      !product ||
      !product.active
    ) {
      throw new CheckoutValidationError(
        `Produto indisponível: ${slug}.`
      );
    }

    const unitPrice =
      getProductPrice(
        paymentMethod,
        {
          price:
            product.price,

          pixPrice:
            product.pixPrice,
        }
      );

    preparedItems.push(
      {
        productId:
          product.id,

        slug:
          product.slug,

        title:
          product.title,

        description:
          product.description ||
          "Apostila digital",

        quantity:
          1,

        unitPrice,
      }
    );

    subtotal =
      roundCurrency(
        subtotal +
          unitPrice
      );
  }

  const discount =
    coupon ===
    "APROVA10"
      ? 10
      : 0;

  const total =
    Math.max(
      0,
      roundCurrency(
        subtotal -
          discount
      )
    );

  /**
   * Referência pública imprevisível.
   *
   * Não depende de:
   *
   * - timestamp;
   * - ID sequencial;
   * - Math.random().
   */
  const externalReference =
    `FD-${randomUUID()}`;

  /**
   * Pedido e itens são persistidos dentro da mesma
   * transação SQLite.
   *
   * Se qualquer item falhar, o pedido inteiro é
   * revertido.
   */
  const order =
    db.transaction(
      (
        tx
      ) => {
        const inserted =
          tx
            .insert(
              orders
            )
            .values(
              {
                userId:
                  input.userId,

                status:
                  "pending",

                paymentMethod,

                externalReference,

                subtotal,

                discount,

                total,

                coupon,
              }
            )
            .returning()
            .all();

        const createdOrder =
          inserted[0];

        if (
          !createdOrder
        ) {
          throw new Error(
            "Falha ao criar pedido."
          );
        }

        for (
          const item
          of preparedItems
        ) {
          tx
            .insert(
              orderItems
            )
            .values(
              {
                orderId:
                  createdOrder.id,

                productId:
                  item.productId,

                quantity:
                  1,

                unitPrice:
                  item.unitPrice,
              }
            )
            .run();
        }

        return createdOrder;
      }
    );

  const mpItems:
    CartItemForMP[] =
      preparedItems.map(
        (
          item
        ) => ({
          id:
            item.slug,

          title:
            item.title,

          description:
            item.description,

          quantity:
            1,

          unit_price:
            item.unitPrice,
        })
      );

  return {
    order,

    externalReference,

    paymentMethod,

    coupon,

    subtotal,

    discount,

    total,

    mpItems,
  };
}


export function attachPaymentPreference(
  db: AppDatabase,
  orderId: number,
  preferenceId: string
): void {
  const normalized =
    preferenceId.trim();

  if (!normalized) {
    throw new Error(
      "Mercado Pago não retornou preference_id."
    );
  }

  const result =
    db
      .update(
        orders
      )
      .set(
        {
          preferenceId:
            normalized,
        }
      )
      .where(
        eq(
          orders.id,
          orderId
        )
      )
      .run();

  if (
    result.changes !==
    1
  ) {
    throw new Error(
      "Pedido não encontrado ao persistir preference_id."
    );
  }
}