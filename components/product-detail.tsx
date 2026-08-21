"use client";

import {
  useState,
} from "react";

import Link from "next/link";

import type {
  Product,
} from "../lib/product-types";

import {
  useShop,
} from "./shop-provider";

import {
  ProductCard,
} from "./product-card";


interface ProductDetailProps {
  product: Product;

  relatedProducts: Product[];
}


function formatPrice(
  value: number
): string {
  return value.toLocaleString(
    "pt-BR",
    {
      style:
        "currency",

      currency:
        "BRL",
    }
  );
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
    plan,
    setPlan,
  ] =
    useState<
      | "digital"
      | "impresso"
      | "combo"
    >(
      "combo"
    );


  const [
    preview,
    setPreview,
  ] =
    useState(
      false
    );


  const planPrice =
    plan === "digital"
      ? product.price
      : plan ===
          "impresso"
        ? product.price + 50
        : product.price + 30;


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

        <span>›</span>

        <Link href="/apostilas">
          Apostilas
        </Link>

        <span>›</span>

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
                  {
                    product.shortTitle
                  }
                </strong>

                <i>
                  {product.bank} •{" "}
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
              ▣ Ver prévia de 12 páginas
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

              <span>
                Atualizada{" "}
                {product.updated}
              </span>
            </div>


            <h1>
              {product.title}
            </h1>


            <p className="product-kicker">
              {product.kicker}
            </p>


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


            <div className="purchase-card">
              <span className="sale-chip">
                OFERTA DE LANÇAMENTO
              </span>


              <div className="price-row">
                <div>
                  <del>
                    {formatPrice(
                      product.oldPrice
                    )}
                  </del>

                  <strong>
                    {formatPrice(
                      planPrice
                    )}
                  </strong>

                  <small>
                    à vista ou em até 12x
                  </small>
                </div>


                <div>
                  <span>
                    NO PIX
                  </span>

                  <b>
                    {formatPrice(
                      planPrice *
                        0.95
                    )}
                  </b>

                  <small>
                    5% de desconto
                  </small>
                </div>
              </div>


              <button
                type="button"
                className="button button-accent buy-main"
                onClick={
                  () =>
                    add({
                      ...product,

                      price:
                        planPrice,
                    })
                }
              >
                Quero começar agora{" "}
                <span>→</span>
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
            Planos
          </a>

          <a href="#depoimento">
            Depoimento
          </a>

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
            <b>01</b>

            <div>
              <h3>
                Teoria realmente explicada
              </h3>

              <p>
                Conteúdo aprofundado, linguagem clara e
                exemplos que conectam os conceitos.
              </p>
            </div>
          </article>


          <article>
            <b>02</b>

            <div>
              <h3>
                Questões que ensinam
              </h3>

              <p>
                Seleção comentada no estilo da banca, com
                análise das alternativas.
              </p>
            </div>
          </article>


          <article>
            <b>03</b>

            <div>
              <h3>
                Revisão que cabe na rotina
              </h3>

              <p>
                Quadros, alertas e sínteses para acelerar a
                retomada do conteúdo.
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
                  {
                    product
                      .syllabus
                      .length
                  }
                </b>{" "}
                disciplinas
              </span>
            </div>
          </div>


          <div className="syllabus-list">
            {product.syllabus.map(
              (
                item,
                index
              ) => (
                <details
                  key={
                    item.title
                  }
                  open={
                    index === 0
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
                        {
                          item.title
                        }
                      </strong>

                      <small>
                        {
                          item.pages
                        }{" "}
                        páginas •{" "}
                        {
                          item.questions
                        }{" "}
                        questões
                      </small>
                    </div>

                    <b>＋</b>
                  </summary>

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
                </details>
              )
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
            <i /> Escolha seu formato
          </span>

          <h2>
            Seu material, do seu jeito.
          </h2>

          <p>
            Todos os planos incluem atualização gratuita até
            o próximo edital.
          </p>
        </div>


        <div className="plans-grid">
          {[
            {
              id:
                "digital",

              name:
                "Digital",

              price:
                product.price,

              desc:
                "PDF personalizado e protegido",

              items: [
                "Acesso imediato",
                "Leitura online",
                "Download com CPF",
              ],
            },

            {
              id:
                "impresso",

              name:
                "Impresso",

              price:
                product.price +
                50,

              desc:
                "Livro físico enviado para você",

              items: [
                "Acabamento premium",
                "Frete calculado no checkout",
                "Acesso ao PDF incluso",
              ],
            },

            {
              id:
                "combo",

              name:
                "Combo aprovação",

              price:
                product.price +
                30,

              desc:
                "Apostila + simulados da banca",

              items: [
                "PDF completo",
                "3 simulados inéditos",
                "Correção detalhada",
              ],
            },
          ].map(
            (
              option
            ) => (
              <button
                key={
                  option.id
                }
                type="button"
                onClick={
                  () =>
                    setPlan(
                      option.id as typeof plan
                    )
                }
                className={
                  plan ===
                  option.id
                    ? "plan-card selected"
                    : "plan-card"
                }
              >
                <span>
                  {option.id ===
                  "combo"
                    ? "MELHOR ESCOLHA"
                    : option.name.toUpperCase()}
                </span>

                <h3>
                  {option.name}
                </h3>

                <p>
                  {option.desc}
                </p>

                <strong>
                  {formatPrice(
                    option.price
                  )}
                </strong>

                <ul>
                  {option.items.map(
                    (
                      item
                    ) => (
                      <li
                        key={
                          item
                        }
                      >
                        ✓{" "}
                        {item}
                      </li>
                    )
                  )}
                </ul>

                <i>
                  {plan ===
                  option.id
                    ? "Selecionado"
                    : "Escolher plano"}
                </i>
              </button>
            )
          )}
        </div>
      </section>


      <section
        className="section testimonial-section"
        id="depoimento"
      >
        <div className="container testimonial-grid">
          <div className="testimonial-quote">
            <span>“</span>

            <blockquote>
              {
                product
                  .testimonial
                  .quote
              }
            </blockquote>

            <p>
              <strong>
                {
                  product
                    .testimonial
                    .name
                }
              </strong>

              <small>
                {
                  product
                    .testimonial
                    .role
                }
              </small>
            </p>
          </div>


          <div className="score-card">
            <span>
              RESULTADO REAL
            </span>

            <strong>
              {
                product
                  .testimonial
                  .score
              }
            </strong>

            <small>
              Relato fictício para demonstração visual.
            </small>
          </div>
        </div>
      </section>


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
                  index === 0
                }
              >
                <summary>
                  {faq[0]}

                  <b>＋</b>
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
                  Quem viu esta apostila também conheceu
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
            A partir de
          </small>

          <strong>
            {formatPrice(
              planPrice
            )}
          </strong>
        </div>

        <button
          type="button"
          onClick={
            () =>
              add({
                ...product,

                price:
                  planPrice,
              })
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
                  AMOSTRA GRATUITA
                </span>

                <h2>
                  {
                    product.shortTitle
                  }
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
                PÁGINA 04 • AMOSTRA
              </small>

              <h3>
                O que a banca costuma cobrar
              </h3>

              <p>
                A preparação eficiente começa pela leitura
                ativa do conteúdo, seguida de questões que
                ajudam a reconhecer o padrão de cobrança da
                banca.
              </p>

              <div className="preview-callout">
                <b>
                  Dica estratégica
                </b>

                <p>
                  Marque conceitos recorrentes e registre o
                  motivo de cada erro. Essa prática reduz a
                  repetição de falhas.
                </p>
              </div>

              <p>
                Esta visualização será substituída
                posteriormente pelas páginas reais liberadas
                pelo administrador.
              </p>
            </div>


            <footer>
              <span>
                4 / 12
              </span>

              <button
                type="button"
              >
                Próxima página →
              </button>
            </footer>
          </div>
        </div>
      )}
    </main>
  );
}