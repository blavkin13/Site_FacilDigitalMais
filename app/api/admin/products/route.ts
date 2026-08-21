import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db/index";
import { products } from "../../../../db/schema";
import { validateSession } from "../../../../lib/auth";
import { initDatabase } from "../../../../db/init";

// GET - Listar produtos (admin)
export async function GET(request: NextRequest) {
  try {
    await initDatabase();
    const db = getDb();

    const token = request.cookies.get("fd-session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const user = await validateSession(token);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const allProducts = await db.select().from(products).all();

    return NextResponse.json({ products: allProducts });
  } catch (error) {
    console.error("Erro ao listar produtos:", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

// POST - Criar produto
export async function POST(request: NextRequest) {
  try {
    await initDatabase();
    const db = getDb();

    const token = request.cookies.get("fd-session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const user = await validateSession(token);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const body = await request.json();

    // Validação mínima
    if (!body.slug || !body.title || !body.price) {
      return NextResponse.json(
        { error: "Campos obrigatórios: slug, title, price." },
        { status: 400 }
      );
    }

    // Serializar campos JSON
    const productData = {
      ...body,
      highlights: body.highlights ? JSON.stringify(body.highlights) : null,
      syllabus: body.syllabus ? JSON.stringify(body.syllabus) : null,
      testimonial: body.testimonial ? JSON.stringify(body.testimonial) : null,
    };

    const result = await db.insert(products).values(productData).returning();

    return NextResponse.json({ success: true, product: result[0] }, { status: 201 });
  } catch (error: any) {
    console.error("Erro ao criar produto:", error);
    if (error.message?.includes("UNIQUE constraint")) {
      return NextResponse.json(
        { error: "Já existe um produto com este slug." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

// PATCH - Atualizar produto
export async function PATCH(request: NextRequest) {
  try {
    await initDatabase();
    const db = getDb();

    const token = request.cookies.get("fd-session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const user = await validateSession(token);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "ID do produto é obrigatório." }, { status: 400 });
    }

    // Serializar campos JSON se presentes
    if (updates.highlights) {
      updates.highlights = JSON.stringify(updates.highlights);
    }
    if (updates.syllabus) {
      updates.syllabus = JSON.stringify(updates.syllabus);
    }
    if (updates.testimonial) {
      updates.testimonial = JSON.stringify(updates.testimonial);
    }

    await db
      .update(products)
      .set({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(products.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao atualizar produto:", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}

// DELETE - Deletar produto (desativar)
export async function DELETE(request: NextRequest) {
  try {
    await initDatabase();
    const db = getDb();

    const token = request.cookies.get("fd-session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const user = await validateSession(token);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID do produto é obrigatório." }, { status: 400 });
    }

    // Soft delete: apenas desativar
    await db
      .update(products)
      .set({ active: false, updatedAt: new Date().toISOString() })
      .where(eq(products.id, parseInt(id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao deletar produto:", error);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}