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


function currencyToCents(
  value: number,
  label:
    string
): number {
  if (
    !Number.isFinite(
      value
    )
  ) {
    throw new CheckoutValidationError(
      `${label} inválido.`
    );
  }


  const cents =
    Math.round(
      (
        value +
        Number.EPSILON
      ) *
        100
    );


  if (
    !Number.isSafeInteger(
      cents
    ) ||
    cents <= 0
  ) {
    throw new CheckoutValidationError(
      `${label} inválido.`
    );
  }


  return cents;
}


function centsToCurrency(
  cents: number
): number {
  return cents / 100;
}


function buildMercadoPagoItems(
  preparedItems:
    PreparedOrderItem[],
  discountCents:
    number
): CartItemForMP[] {
  const pricesInCents =
    preparedItems.map(
      (
        item
      ) =>
        currencyToCents(
          item.unitPrice,
          "Preço do produto"
        )
    );


  const subtotalCents =
    pricesInCents.reduce(
      (
        total,
        cents
      ) =>
        total +
        cents,
      0
    );


  if (
    !Number.isSafeInteger(
      discountCents
    ) ||
    discountCents < 0
  ) {
    throw new CheckoutValidationError(
      "Desconto inválido."
    );
  }


  /**
   * Checkout Pro precisa receber itens com valor
   * positivo.
   *
   * Como cada item do nosso carrinho digital possui
   * quantity = 1, precisamos preservar pelo menos
   * R$ 0,01 por item.
   */
  const maximumDiscount =
    subtotalCents -
    preparedItems.length;


  if (
    discountCents >
    maximumDiscount
  ) {
    throw new CheckoutValidationError(
      "Cupom não pode ser aplicado a este carrinho."
    );
  }


  if (
    discountCents ===
    0
  ) {
    return preparedItems.map(
      (
        item,
        index
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
          centsToCurrency(
            pricesInCents[
              index
            ]
          ),
      })
    );
  }


  /**
   * O desconto é distribuído proporcionalmente
   * pelos itens.
   *
   * Primeiro usamos a parcela inteira de centavos.
   * Os centavos restantes são distribuídos em ordem
   * estável do carrinho.
   *
   * Dessa forma:
   *
   * Σ itens Mercado Pago === orders.total
   *
   * exatamente em centavos.
   */
  const allocatedDiscounts =
    pricesInCents.map(
      (
        itemCents
      ) =>
        Math.floor(
          (
            discountCents *
            itemCents
          ) /
            subtotalCents
        )
    );


  let allocated =
    allocatedDiscounts.reduce(
      (
        total,
        cents
      ) =>
        total +
        cents,
      0
    );


  let remaining =
    discountCents -
    allocated;


  let index =
    0;


  while (
    remaining >
    0
  ) {
    const maximumForItem =
      pricesInCents[
        index
      ] -
      1;


    if (
      allocatedDiscounts[
        index
      ] <
      maximumForItem
    ) {
      allocatedDiscounts[
        index
      ] +=
        1;


      allocated +=
        1;


      remaining -=
        1;
    }


    index =
      (
        index +
        1
      ) %
      preparedItems.length;
  }


  const mercadoPagoItems =
    preparedItems.map(
      (
        item,
        itemIndex
      ) => {
        const finalCents =
          pricesInCents[
            itemIndex
          ] -
          allocatedDiscounts[
            itemIndex
          ];


        if (
          finalCents <=
          0
        ) {
          throw new CheckoutValidationError(
            "Desconto resultou em preço inválido."
          );
        }


        return {
          id:
            item.slug,

          title:
            item.title,

          description:
            item.description,

          quantity:
            1,

          unit_price:
            centsToCurrency(
              finalCents
            ),
        };
      }
    );


  const mercadoPagoTotalCents =
    mercadoPagoItems.reduce(
      (
        total,
        item
      ) =>
        total +
        currencyToCents(
          item.unit_price,
          "Preço Mercado Pago"
        ) *
          item.quantity,
      0
    );


  const expectedTotalCents =
    subtotalCents -
    discountCents;


  if (
    mercadoPagoTotalCents !==
    expectedTotalCents
  ) {
    throw new Error(
      "Falha interna ao distribuir desconto do checkout."
    );
  }


  return mercadoPagoItems;
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
  product: {
    price: number;
  }
): number {
  /**
   * O preço comercial é único independentemente
   * da forma de pagamento.
   *
   * PIX, cartão e boleto utilizam sempre
   * products.price como fonte de verdade.
   *
   * pix_price permanece apenas como campo legado
   * de compatibilidade e não participa do checkout.
   */
  const selectedPrice =
    Number(
      product.price
    );

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
   * - preço.
   *
   * O preço é único independentemente da forma
   * de pagamento.
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

  let subtotalCents =
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
        {
          price:
            product.price,
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

    subtotalCents +=
      currencyToCents(
        unitPrice,
        "Preço do produto"
      );
  }

  const discountCents =
    coupon ===
    "APROVA10"
      ? 1000
      : 0;


  /**
   * O cupom APROVA10 representa exatamente
   * R$ 10,00.
   *
   * Não reduzimos silenciosamente o desconto.
   * Se o carrinho não puder representar esse valor
   * mantendo todos os itens positivos, rejeitamos
   * a aplicação.
   */
  if (
    discountCents >
    subtotalCents -
      preparedItems.length
  ) {
    throw new CheckoutValidationError(
      "Cupom não pode ser aplicado a este carrinho."
    );
  }


  const totalCents =
    subtotalCents -
    discountCents;


  const subtotal =
    centsToCurrency(
      subtotalCents
    );


  const discount =
    centsToCurrency(
      discountCents
    );


  const total =
    centsToCurrency(
      totalCents
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

  const mpItems =
    buildMercadoPagoItems(
      preparedItems,
      discountCents
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