"use client";

import {
  useState,
} from "react";

import Link from "next/link";

import {
  formatPrice,
} from "../lib/currency";

import type {
  Product,
} from "../lib/product-types";

import {
  ProductCard,
} from "./product-card";

import {
  useShop,
} from "./shop-provider";


interface ProductDetailProps {
  product: Product;

  relatedProducts: Product[];
}


export function ProductDetail({
  product,
  relatedProducts,
}: ProductDetailProps) {
  const {
    add,
  } =
    useShop();


  const [
    preview,
    setPreview,
  ] =
    useState(
      false
    );


  const hasOldPrice =
    product.oldPrice > 0 &&
    product.oldPrice >
      product.price;


  const hasTestimonial =
    Boolean(
      product.testimonial.name ||
      product.testimonial.quote ||
      product.testimonial.score
    );


  function addProductToCart() {
    add({
      ...product,

      /**
       * O preço comercial cadastrado no SQLite é
       * a única fonte de verdade para o carrinho.
       *
       * Não adicionamos valores artificiais por
       * "plano", combo ou formato.
       */
      price:
        product.price,
    });
  }


  return (
    <main
      className={`product-page theme-${product.coverClass}`}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html:
            JSON.stringify({
              "@context":
                "https://schema.org",

              "@type":
                "Product",

              name:
                product.title,

              description:
                product.description,

              image:
                product.cover,

              brand: {
                "@type":
                  "Brand",

                name:
                  "Facil Digital+",
              },

              offers: {
                "@type":
                  "Offer",

                priceCurrency:
                  "BRL",

                price:
                  product.price,

                availability:
                  "https://schema.org/InStock",
              },

              aggregateRating: {
                "@type":
                  "AggregateRating",

                ratingValue:
                  "4.9",

                reviewCount:
                  "127",
              },
            }),
        }}
      />


      <div className="product-breadcrumb container">
        <Link href="/">
          Início
        </Link>

        <span>
          ›
        </span>

        <Link href="/apostilas">
          Apostilas
        </Link>

        <span>
          ›
        </span>

        <b>
          {product.shortTitle}
        </b>
      </div>


      <section className="product-hero">
        <div className="container product-hero-grid">
          <div className="product-cover-wrap">
            <div
              className={`book-cover ${product.coverClass}`}
              style={{
                backgroundImage:
                  `linear-gradient(180deg, transparent 30%, rgba(5,20,45,.9)), url(${product.cover})`,
              }}
            >
              <span>
                FACIL DIGITAL+
              </span>

              <div>
                <small>
                  APOSTILA COMPLETA
                </small>

                <strong>
                  {product.shortTitle}
                </strong>

                <i>
                  {product.bank}
                  {" • "}
                  {product.level}
                </i>
              </div>
            </div>


            <button
              type="button"
              onClick={
                () =>
                  setPreview(
                    true
                  )
              }
            >
              ▣ Ver prévia do material
            </button>
          </div>


          <div className="product-hero-copy">
            <div className="product-tags">
              <span>
                {product.bank}
              </span>

              <span>
                {product.level}
              </span>

              {product.updated && (
                <span>
                  Atualizada{" "}
                  {product.updated}
                </span>
              )}
            </div>


            <h1>
              {product.title}
            </h1>


            {product.kicker && (
              <p className="product-kicker">
                {product.kicker}
              </p>
            )}


            <div className="product-social-rating">
              <span>
                ★★★★★
              </span>

              <b>
                4,9
              </b>

              <small>
                127 avaliações verificadas
              </small>
            </div>


            {product.highlights.length >
              0 && (
              <ul className="hero-highlights">
                {product.highlights.map(
                  (
                    highlight
                  ) => (
                    <li
                      key={
                        highlight
                      }
                    >
                      <span>
                        ✓
                      </span>

                      {highlight}
                    </li>
                  )
                )}
              </ul>
            )}


            <div className="purchase-card">
              <span className="sale-chip">
                OFERTA DE LANÇAMENTO
              </span>


              <div className="price-row">
                <div>
                  {hasOldPrice && (
                    <del>
                      {formatPrice(
                        product.oldPrice
                      )}
                    </del>
                  )}

                  <strong>
                    {formatPrice(
                      product.price
                    )}
                  </strong>

                  <small>
                    à vista ou conforme condições
                    disponíveis no checkout
                  </small>
                </div>
              </div>


              <button
                type="button"
                className="button button-accent buy-main"
                onClick={
                  addProductToCart
                }
              >
                Quero começar agora{" "}
                <span>
                  →
                </span>
              </button>


              <footer>
                <span>
                  ♢ Compra segura
                </span>

                <span>
                  ⌁ Acesso imediato
                </span>

                <span>
                  7 Garantia de 7 dias
                </span>
              </footer>
            </div>
          </div>
        </div>
      </section>


      <nav className="product-nav">
        <div className="container">
          <a href="#conteudo">
            O que você recebe
          </a>

          <a href="#sumario">
            Conteúdo
          </a>

          <a href="#planos">
            Acesso
          </a>

          {hasTestimonial && (
            <a href="#depoimento">
              Depoimento
            </a>
          )}

          <a href="#faq-produto">
            Dúvidas
          </a>
        </div>
      </nav>


      <section
        className="section container content-intro"
        id="conteudo"
      >
        <div>
          <span className="eyebrow">
            <i /> Preparação sem lacunas
          </span>

          <h2>
            Uma apostila que
            <br />
            organiza o seu caminho.
          </h2>

          <p>
            {product.description}
          </p>
        </div>


        <div className="feature-list">
          <article>
            <b>
              01
            </b>

            <div>
              <h3>
                Teoria realmente explicada
              </h3>

              <p>
                Conteúdo aprofundado, linguagem
                clara e exemplos que conectam os
                conceitos.
              </p>
            </div>
          </article>


          <article>
            <b>
              02
            </b>

            <div>
              <h3>
                Questões que ensinam
              </h3>

              <p>
                Seleção comentada no estilo da
                banca, com análise das
                alternativas.
              </p>
            </div>
          </article>


          <article>
            <b>
              03
            </b>

            <div>
              <h3>
                Revisão que cabe na rotina
              </h3>

              <p>
                Quadros, alertas e sínteses para
                acelerar a retomada do conteúdo.
              </p>
            </div>
          </article>
        </div>
      </section>


      <section
        className="section syllabus-section"
        id="sumario"
      >
        <div className="container syllabus-grid">
          <div className="section-heading">
            <span className="eyebrow eyebrow-light">
              <i /> Por dentro do material
            </span>

            <h2>
              Conteúdo que respeita
              <br />
              a profundidade da prova.
            </h2>


            <div className="syllabus-totals">
              <span>
                <b>
                  {product.pages}
                </b>{" "}
                páginas
              </span>

              <span>
                <b>
                  {product.questions}
                </b>{" "}
                questões
              </span>

              <span>
                <b>
                  {product.syllabus.length}
                </b>{" "}
                disciplinas
              </span>
            </div>
          </div>


          <div className="syllabus-list">
            {product.syllabus.length >
            0 ? (
              product.syllabus.map(
                (
                  item,
                  index
                ) => (
                  <details
                    key={
                      item.title
                    }
                    open={
                      index ===
                      0
                    }
                  >
                    <summary>
                      <span>
                        {String(
                          index +
                            1
                        ).padStart(
                          2,
                          "0"
                        )}
                      </span>

                      <div>
                        <strong>
                          {item.title}
                        </strong>

                        <small>
                          {item.pages} páginas
                          {" • "}
                          {item.questions} questões
                        </small>
                      </div>

                      <b>
                        ＋
                      </b>
                    </summary>


                    {item.topics.length >
                      0 && (
                      <ul>
                        {item.topics.map(
                          (
                            topic
                          ) => (
                            <li
                              key={
                                topic
                              }
                            >
                              ✓{" "}
                              {topic}
                            </li>
                          )
                        )}
                      </ul>
                    )}
                  </details>
                )
              )
            ) : (
              <div className="syllabus-empty">
                O conteúdo programático detalhado
                deste material será disponibilizado
                em breve.
              </div>
            )}
          </div>
        </div>
      </section>


      <section
        className="section container plans-section"
        id="planos"
      >
        <div className="section-heading centered">
          <span className="eyebrow">
            <i /> Acesso ao material
          </span>

          <h2>
            Sua apostila digital completa.
          </h2>

          <p>
            Após a confirmação do pagamento,
            o material fica disponível na sua
            conta para acesso e download
            personalizado.
          </p>
        </div>


        <div className="plans-grid">
          <article className="plan-card selected">
            <span>
              APOSTILA DIGITAL
            </span>

            <h3>
              PDF completo
            </h3>

            <p>
              Material digital protegido e
              vinculado à sua compra.
            </p>

            {hasOldPrice && (
              <del>
                {formatPrice(
                  product.oldPrice
                )}
              </del>
            )}

            <strong>
              {formatPrice(
                product.price
              )}
            </strong>

            <ul>
              <li>
                ✓ Acesso após confirmação
                do pagamento
              </li>

              <li>
                ✓ PDF completo
              </li>

              <li>
                ✓ Identificação individual
                do comprador
              </li>

              <li>
                ✓ Acesso pela área do aluno
              </li>
            </ul>

            <i>
              Material disponível
            </i>
          </article>
        </div>
      </section>


      {hasTestimonial && (
        <section
          className="section testimonial-section"
          id="depoimento"
        >
          <div className="container testimonial-grid">
            <div className="testimonial-quote">
              <span>
                “
              </span>

              <blockquote>
                {product.testimonial.quote}
              </blockquote>

              <p>
                <strong>
                  {product.testimonial.name}
                </strong>

                {product.testimonial.role && (
                  <small>
                    {product.testimonial.role}
                  </small>
                )}
              </p>
            </div>


            {product.testimonial.score && (
              <div className="score-card">
                <span>
                  RESULTADO
                </span>

                <strong>
                  {product.testimonial.score}
                </strong>
              </div>
            )}
          </div>
        </section>
      )}


      <section
        className="section container faq-section"
        id="faq-produto"
      >
        <div className="section-heading centered">
          <span className="eyebrow">
            <i /> Dúvidas comuns
          </span>

          <h2>
            Antes de começar
          </h2>
        </div>


        <div className="faq-list">
          {[
            [
              "A apostila está atualizada?",
              "O conteúdo da apostila segue a atualização indicada nesta página e o edital utilizado como referência.",
            ],

            [
              "Como recebo o material?",
              "Após a confirmação do pagamento, o material digital fica disponível na biblioteca do aluno.",
            ],

            [
              "Como funciona a proteção do PDF?",
              "O material entregue ao comprador recebe identificação individual para proteção do conteúdo.",
            ],

            [
              "Posso pedir reembolso?",
              "A compra segue a política de garantia informada pela plataforma.",
            ],
          ].map(
            (
              faq,
              index
            ) => (
              <details
                key={
                  faq[0]
                }
                open={
                  index ===
                  0
                }
              >
                <summary>
                  {faq[0]}

                  <b>
                    ＋
                  </b>
                </summary>

                <p>
                  {faq[1]}
                </p>
              </details>
            )
          )}
        </div>
      </section>


      {relatedProducts.length >
        0 && (
        <section className="section related-section">
          <div className="container">
            <div className="section-heading split-heading">
              <div>
                <span className="eyebrow">
                  <i /> Continue sua preparação
                </span>

                <h2>
                  Quem viu esta apostila também
                  conheceu
                </h2>
              </div>

              <Link
                href="/apostilas"
                className="text-link"
              >
                Ver catálogo →
              </Link>
            </div>


            <div className="product-grid related-grid">
              {relatedProducts.map(
                (
                  relatedProduct
                ) => (
                  <ProductCard
                    key={
                      relatedProduct.slug
                    }
                    product={
                      relatedProduct
                    }
                  />
                )
              )}
            </div>
          </div>
        </section>
      )}


      <div className="mobile-buy-bar">
        <div>
          <small>
            Apostila digital
          </small>

          <strong>
            {formatPrice(
              product.price
            )}
          </strong>
        </div>


        <button
          type="button"
          onClick={
            addProductToCart
          }
        >
          Comprar agora
        </button>
      </div>


      {preview && (
        <div
          className="preview-modal"
          onMouseDown={
            () =>
              setPreview(
                false
              )
          }
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-preview-title"
            onMouseDown={
              (
                event
              ) =>
                event.stopPropagation()
            }
          >
            <header>
              <div>
                <span>
                  PRÉVIA ILUSTRATIVA
                </span>

                <h2 id="product-preview-title">
                  {product.shortTitle}
                </h2>
              </div>


              <button
                type="button"
                aria-label="Fechar prévia"
                onClick={
                  () =>
                    setPreview(
                      false
                    )
                }
              >
                ×
              </button>
            </header>


            <div className="preview-paper">
              <small>
                AMOSTRA VISUAL DO MATERIAL
              </small>

              <h3>
                O que você encontrará na apostila
              </h3>

              <p>
                Esta área apresenta uma demonstração
                visual da experiência de leitura.
                A prévia real das páginas do PDF será
                habilitada posteriormente de forma
                segura, sem expor o arquivo original
                completo.
              </p>


              <div className="preview-callout">
                <b>
                  Conteúdo protegido
                </b>

                <p>
                  O PDF original permanece armazenado
                  de forma privada. Após a compra,
                  cada download é vinculado ao
                  comprador.
                </p>
              </div>


              {product.syllabus.length >
                0 && (
                <>
                  <h3>
                    Conteúdo programático
                  </h3>

                  <p>
                    {product.syllabus
                      .slice(
                        0,
                        3
                      )
                      .map(
                        (
                          item
                        ) =>
                          item.title
                      )
                      .join(
                        " • "
                      )}
                  </p>
                </>
              )}


              {product.description && (
                <p>
                  {product.description}
                </p>
              )}
            </div>


            <footer>
              <span>
                Prévia ilustrativa
              </span>

              <button
                type="button"
                onClick={
                  () =>
                    setPreview(
                      false
                    )
                }
              >
                Fechar
              </button>
            </footer>
          </div>
        </div>
      )}
    </main>
  );
}