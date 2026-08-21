import Link from "next/link";

import {
  ProductCard,
} from "./product-card";

import type {
  Product,
} from "../lib/products";

import {
  productMatchesContest,
} from "../lib/product-repository";


interface ContestLandingProps {
  contestSlug: string;

  contestName: string;

  products: Product[];
}


export function ContestLanding({
  contestSlug,
  contestName,
  products,
}: ContestLandingProps) {
  /**
   * A página já recebe do servidor somente os produtos
   * vinculados ao concurso.
   *
   * Mantemos esta validação defensiva para garantir que,
   * caso o componente seja reutilizado no futuro, nenhum
   * produto de outro concurso seja exibido acidentalmente.
   */
  const contestProducts =
    products.filter(
      (product) =>
        productMatchesContest(
          product,
          contestSlug
        )
    );


  return (
    <main className="contest-page">
      <section className="contest-hero">
        <div className="container">
          <span className="eyebrow eyebrow-light">
            <i /> Concurso em foco
          </span>

          <h1>
            {contestName}
          </h1>

          <p>
            Tudo que você precisa para conquistar sua vaga
            neste concurso. Apostilas completas, atualizadas
            e organizadas para o padrão da banca.
          </p>


          <div className="contest-stats">
            <div>
              <strong>
                {
                  contestProducts.length
                }
              </strong>

              <small>
                {contestProducts.length ===
                1
                  ? "apostila disponível"
                  : "apostilas disponíveis"}
              </small>
            </div>

            <div>
              <strong>
                100%
              </strong>

              <small>
                materiais publicados
              </small>
            </div>

            <div>
              <strong>
                7 dias
              </strong>

              <small>
                garantia
              </small>
            </div>
          </div>
        </div>
      </section>


      <section
        className="container"
        style={{
          padding:
            "3rem 1rem",
        }}
      >
        {contestProducts.length ===
        0 ? (
          <div
            style={{
              textAlign:
                "center",

              padding:
                "3rem",
            }}
          >
            <h2>
              Nenhuma apostila disponível para este concurso.
            </h2>

            <p>
              Consulte nosso catálogo para conhecer outros
              materiais.
            </p>

            <Link
              href="/apostilas"
              className="button button-primary"
            >
              Ver catálogo →
            </Link>
          </div>
        ) : (
          <>
            <div
              className="section-heading split-heading"
              style={{
                marginBottom:
                  "2rem",
              }}
            >
              <div>
                <span className="eyebrow">
                  <i /> Materiais disponíveis
                </span>

                <h2>
                  Escolha sua apostila
                </h2>
              </div>

              <Link
                className="text-link"
                href="/apostilas"
              >
                Ver todas as apostilas{" "}
                <span>→</span>
              </Link>
            </div>


            <div className="product-grid">
              {contestProducts.map(
                (
                  product
                ) => (
                  <ProductCard
                    key={
                      product.slug
                    }
                    product={
                      product
                    }
                  />
                )
              )}
            </div>
          </>
        )}
      </section>


      <section
        className="section container"
        style={{
          padding:
            "2rem 1rem",
        }}
      >
        <div className="story-panel">
          <div className="story-mark">
            “
          </div>

          <div className="story-copy">
            <span className="eyebrow eyebrow-light">
              <i /> Dica de preparação
            </span>

            <blockquote>
              Foque nos temas mais cobrados pela banca,
              resolva questões anteriores e mantenha uma
              rotina de estudos consistente.
            </blockquote>

            <p>
              <strong>
                Facil Digital+
              </strong>

              <span>
                conteúdo pensado para a sua preparação
              </span>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}