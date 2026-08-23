import {
  and,
  eq,
} from "drizzle-orm";

import {
  getDb,
} from "../db/index";

import {
  initDatabase,
} from "../db/init";

import {
  orderItems,
  orders,
  simulationProducts,
  simulations,
} from "../db/schema";


export type SimulationAccessDenialReason =
  | "invalid_input"
  | "simulation_not_found"
  | "simulation_inactive"
  | "no_related_product"
  | "no_approved_purchase";


export type SimulationAccessDecision =
  | {
      allowed:
        true;

      simulationId:
        number;

      relatedProductIds:
        number[];
    }
  | {
      allowed:
        false;

      simulationId:
        number;

      reason:
        SimulationAccessDenialReason;

      relatedProductIds:
        number[];
    };


function isValidId(
  value:
    number
): boolean {
  return (
    Number.isInteger(
      value
    ) &&
    value >
      0
  );
}


/**
 * Resolve a autorização comercial de um aluno
 * para UM simulado específico.
 *
 * Regra:
 *
 * user
 *   ↓
 * orders.user_id
 *   ↓
 * orders.status = approved
 *   ↓
 * order_items.product_id
 *   ↓
 * simulation_products.product_id
 *   ↓
 * simulation
 *
 *
 * Portanto:
 *
 * - possuir qualquer pedido NÃO basta;
 * - pedido pending NÃO basta;
 * - pedido rejected NÃO basta;
 * - pedido refunded NÃO basta;
 * - comprar outro produto NÃO basta.
 */
export async function resolveSimulationAccess(
  userId:
    number,
  simulationId:
    number
): Promise<SimulationAccessDecision> {
  if (
    !isValidId(
      userId
    ) ||
    !isValidId(
      simulationId
    )
  ) {
    return {
      allowed:
        false,

      simulationId,

      reason:
        "invalid_input",

      relatedProductIds:
        [],
    };
  }


  await initDatabase();

  const db =
    getDb();


  const simulation =
    await db
      .select({
        id:
          simulations.id,

        active:
          simulations.active,
      })
      .from(
        simulations
      )
      .where(
        eq(
          simulations.id,
          simulationId
        )
      )
      .get();


  if (
    !simulation
  ) {
    return {
      allowed:
        false,

      simulationId,

      reason:
        "simulation_not_found",

      relatedProductIds:
        [],
    };
  }


  if (
    simulation.active !==
    true
  ) {
    return {
      allowed:
        false,

      simulationId,

      reason:
        "simulation_inactive",

      relatedProductIds:
        [],
    };
  }


  const relatedProducts =
    await db
      .select({
        productId:
          simulationProducts
            .productId,
      })
      .from(
        simulationProducts
      )
      .where(
        eq(
          simulationProducts
            .simulationId,
          simulationId
        )
      )
      .all();


  const relatedProductIds =
    relatedProducts.map(
      (
        relation
      ) =>
        relation.productId
    );


  /**
   * Simulado publicado sem produto relacionado
   * nunca deve ser liberado por acidente.
   */
  if (
    relatedProductIds.length ===
    0
  ) {
    return {
      allowed:
        false,

      simulationId,

      reason:
        "no_related_product",

      relatedProductIds,
    };
  }


  const approvedPurchase =
    await db
      .select({
        orderId:
          orders.id,

        productId:
          orderItems.productId,
      })
      .from(
        simulationProducts
      )
      .innerJoin(
        orderItems,
        eq(
          orderItems.productId,
          simulationProducts
            .productId
        )
      )
      .innerJoin(
        orders,
        eq(
          orders.id,
          orderItems.orderId
        )
      )
      .where(
        and(
          eq(
            simulationProducts
              .simulationId,
            simulationId
          ),

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


  if (
    !approvedPurchase
  ) {
    return {
      allowed:
        false,

      simulationId,

      reason:
        "no_approved_purchase",

      relatedProductIds,
    };
  }


  return {
    allowed:
      true,

    simulationId,

    relatedProductIds,
  };
}


/**
 * Retorna apenas os simulados atualmente liberados
 * para um usuário.
 *
 * Será utilizado pela listagem pública na segunda
 * parte da Fase 4.1.
 */
export async function getAccessibleSimulationIdsForUser(
  userId:
    number
): Promise<number[]> {
  if (
    !isValidId(
      userId
    )
  ) {
    return [];
  }


  await initDatabase();

  const db =
    getDb();


  const rows =
    await db
      .selectDistinct({
        simulationId:
          simulationProducts
            .simulationId,
      })
      .from(
        simulationProducts
      )
      .innerJoin(
        orderItems,
        eq(
          orderItems.productId,
          simulationProducts
            .productId
        )
      )
      .innerJoin(
        orders,
        eq(
          orders.id,
          orderItems.orderId
        )
      )
      .innerJoin(
        simulations,
        eq(
          simulations.id,
          simulationProducts
            .simulationId
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
            simulations.active,
            true
          )
        )
      )
      .all();


  return rows.map(
    (
      row
    ) =>
      row.simulationId
  );
}