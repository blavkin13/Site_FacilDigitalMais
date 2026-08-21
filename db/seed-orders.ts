import { initDatabase } from "./init";
import { getDb } from "./index";
import { orders, orderItems, products, users } from "./schema";
import { eq } from "drizzle-orm";

export async function seedTestOrders() {
  console.log("🌱 Iniciando seed de pedidos de teste...");

  await initDatabase();
  const db = getDb();

  // Buscar admin para associar pedidos
  const admin = await db
    .select()
    .from(users)
    .where(eq(users.email, "digicopiamix@facildigitalmais.com"))
    .get();

  if (!admin) {
    console.error("❌ Admin não encontrado. Execute 'npm run db:seed' primeiro.");
    return;
  }

  // Buscar produtos existentes
  const allProducts = await db.select().from(products).all();
  
  // Se não há produtos, criar um produto de teste básico
  let testProducts = allProducts;
  if (testProducts.length === 0) {
    console.log("📦 Criando produtos de teste...");
    const newProducts = await db
      .insert(products)
      .values([
        {
          slug: "transpetro-auxiliar-de-saude",
          title: "Transpetro — Auxiliar de Saúde",
          shortTitle: "Auxiliar de Saúde",
          category: "Saúde",
          bank: "Cesgranrio",
          level: "Técnico",
          pages: 684,
          questions: 820,
          oldPrice: 129.9,
          price: 79.9,
          pixPrice: 75.91,
          updated: "Agosto de 2026",
          cover: "https://via.placeholder.com/400x500/0a2a52/ffffff?text=Saude",
          coverClass: "health",
          description: "Preparação completa para Transpetro.",
          active: true,
        },
        {
          slug: "transpetro-contabilidade",
          title: "Transpetro — Contabilidade",
          shortTitle: "Contabilidade",
          category: "Estatais",
          bank: "Cesgranrio",
          level: "Superior",
          pages: 742,
          questions: 960,
          oldPrice: 149.9,
          price: 89.9,
          pixPrice: 85.41,
          updated: "Agosto de 2026",
          cover: "https://via.placeholder.com/400x500/0a2a52/ffffff?text=Contabilidade",
          coverClass: "accounting",
          description: "Preparação para Contabilidade.",
          active: true,
        },
        {
          slug: "transpetro-tecnico-ambiental",
          title: "Transpetro — Técnico Ambiental",
          shortTitle: "Técnico Ambiental",
          category: "Meio ambiente",
          bank: "Cesgranrio",
          level: "Técnico",
          pages: 618,
          questions: 780,
          oldPrice: 129.9,
          price: 79.9,
          pixPrice: 75.91,
          updated: "Agosto de 2026",
          cover: "https://via.placeholder.com/400x500/0a2a52/ffffff?text=Ambiental",
          coverClass: "environment",
          description: "Preparação para Técnico Ambiental.",
          active: true,
        },
      ])
      .returning();
    testProducts = newProducts;
  }

  // Verificar se já existem pedidos
  const existingOrders = await db.select().from(orders).all();
  if (existingOrders.length > 0) {
    console.log("ℹ️  Já existem pedidos no banco. Pulando seed.");
    return;
  }

  // Criar 2 pedidos de teste
  console.log("📝 Criando pedidos de teste...");

  // Pedido 1: Admin comprou 1 apostila
  const order1Result = await db
    .insert(orders)
    .values({
      userId: admin.id,
      status: "approved",
      paymentMethod: "pix",
      subtotal: testProducts[0].price,
      discount: 0,
      total: testProducts[0].pixPrice || testProducts[0].price,
    })
    .returning();

  if (order1Result[0] && testProducts[0]) {
    await db.insert(orderItems).values({
      orderId: order1Result[0].id,
      productId: testProducts[0].id,
      quantity: 1,
      unitPrice: testProducts[0].pixPrice || testProducts[0].price,
    });
    console.log(`  ✅ Pedido 1 criado: ${testProducts[0].title}`);
  }

  // Pedido 2: Admin comprou 2 apostilas
  if (testProducts.length >= 3) {
    const order2Subtotal = testProducts[1].price + testProducts[2].price;
    const order2Result = await db
      .insert(orders)
      .values({
        userId: admin.id,
        status: "approved",
        paymentMethod: "card",
        subtotal: order2Subtotal,
        discount: 10,
        total: order2Subtotal - 10,
        coupon: "APROVA10",
      })
      .returning();

    if (order2Result[0] && testProducts[1] && testProducts[2]) {
      await db.insert(orderItems).values([
        {
          orderId: order2Result[0].id,
          productId: testProducts[1].id,
          quantity: 1,
          unitPrice: testProducts[1].price,
        },
        {
          orderId: order2Result[0].id,
          productId: testProducts[2].id,
          quantity: 1,
          unitPrice: testProducts[2].price,
        },
      ]);
      console.log(`  ✅ Pedido 2 criado: ${testProducts[1].title} + ${testProducts[2].title}`);
    }
  }

  console.log("✅ Seed de pedidos concluído!");
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  seedTestOrders()
    .then(() => {
      console.log("✅ Seed de pedidos concluído!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Falha:", error);
      process.exit(1);
    });
}