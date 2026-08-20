"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductCard } from "./product-card";
import { products } from "../lib/products";

interface ContestLandingProps {
  contestSlug: string;
}

export function ContestLanding({ contestSlug }: ContestLandingProps) {
  const [loading, setLoading] = useState(true);
  const [contestProducts, setContestProducts] = useState<any[]>([]);
  const [contestName, setContestName] = useState("");

  useEffect(() => {
    // Filtrar produtos por slug do concurso
    // O slug do concurso está contido no slug do produto (ex: "transpetro-auxiliar-de-saude")
    const filtered = products.filter((p) =>
      p.slug.toLowerCase().includes(contestSlug.toLowerCase()) ||
      p.title.toLowerCase().includes(contestSlug.toLowerCase().replace(/-/g, " "))
    );

    setContestProducts(filtered);
    setContestName(contestSlug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()));
    setLoading(false);
  }, [contestSlug]);

  if (loading) {
    return (
      <main className="simple-page">
        <div className="container" style={{ padding: "4rem 1rem", textAlign: "center" }}>
          <p>Carregando...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="contest-page">
      <section className="contest-hero">
        <div className="container">
          <span className="eyebrow eyebrow-light">
            <i /> Concurso em foco
          </span>
          <h1>{contestName}</h1>
          <p>
            Tudo que você precisa para conquistar sua vaga neste concurso.
            Apostilas completas, atualizadas e no padrão da banca.
          </p>
          <div className="contest-stats">
            <div>
              <strong>{contestProducts.length}</strong>
              <small>apostilas disponíveis</small>
            </div>
            <div>
              <strong>100%</strong>
              <small>atualizadas</small>
            </div>
            <div>
              <strong>7 dias</strong>
              <small>garantia</small>
            </div>
          </div>
        </div>
      </section>

      <section className="container" style={{ padding: "3rem 1rem" }}>
        {contestProducts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem" }}>
            <h2>Nenhuma apostila encontrada para este concurso.</h2>
            <p>Em breve teremos materiais disponíveis.</p>
            <Link href="/apostilas" className="button button-primary">
              Ver todos os concursos →
            </Link>
          </div>
        ) : (
          <>
            <div className="section-heading split-heading" style={{ marginBottom: "2rem" }}>
              <div>
                <span className="eyebrow"><i /> Materiais disponíveis</span>
                <h2>Escolha sua apostila</h2>
              </div>
              <Link className="text-link" href="/apostilas">
                Ver todos os concursos <span>→</span>
              </Link>
            </div>
            <div className="product-grid">
              {contestProducts.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          </>
        )}
      </section>

      <section className="section container" style={{ padding: "2rem 1rem" }}>
        <div className="story-panel">
          <div className="story-mark">"</div>
          <div className="story-copy">
            <span className="eyebrow eyebrow-light"><i /> Dica de preparação</span>
            <blockquote>
              Foque nos temas mais cobrados pela banca, resolva muitas questões
              anteriores e mantenha uma rotina de estudos consistente.
            </blockquote>
            <p>
              <strong>Facil Digital+</strong>
              <span>conteúdo pensado para a sua aprovação</span>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}