import Link from "next/link";

import { ProductCard } from "../components/product-card";

import {
  getActiveProducts,
} from "../lib/product-repository";


/**
 * A Home depende do catálogo do SQLite.
 *
 * Não deve ser pré-renderizada definitivamente no build,
 * porque novas apostilas poderão ser criadas posteriormente
 * pelo painel administrativo.
 */
export const dynamic =
  "force-dynamic";


const categoryStyles: Record<
  string,
  {
    icon: string;
    tone: string;
  }
> = {
  Estatais: {
    icon: "⚓",
    tone: "blue",
  },

  Saúde: {
    icon: "✚",
    tone: "mint",
  },

  Tribunais: {
    icon: "⚖",
    tone: "amber",
  },

  Administrativo: {
    icon: "▦",
    tone: "violet",
  },

  "Meio ambiente": {
    icon: "♻",
    tone: "mint",
  },
};


export default async function Home() {
  const products =
    await getActiveProducts();


  /**
   * As categorias e suas quantidades agora são derivadas
   * dos produtos realmente publicados.
   *
   * Eliminamos números fictícios como:
   *
   * "18 apostilas"
   * "24 apostilas"
   * etc.
   */
  const categoryCounts =
    products.reduce<
      Record<string, number>
    >(
      (
        accumulator,
        product
      ) => {
        accumulator[
          product.category
        ] =
          (
            accumulator[
              product.category
            ] || 0
          ) + 1;

        return accumulator;
      },
      {}
    );


  const categories =
    Object.entries(
      categoryCounts
    )
      .map(
        ([
          name,
          count,
        ]) => ({
          name,

          count,

          icon:
            categoryStyles[
              name
            ]?.icon ||
            "▤",

          tone:
            categoryStyles[
              name
            ]?.tone ||
            "blue",
        })
      )
      .sort(
        (a, b) =>
          a.name.localeCompare(
            b.name,
            "pt-BR"
          )
      );


  return (
    <main>
      <section className="hero-shell">
        <div className="hero-orbit hero-orbit-one" />

        <div className="hero-orbit hero-orbit-two" />

        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow eyebrow-light">
              <i /> Seu próximo capítulo começa aqui
            </span>

            <h1>
              Estude com direção.
              <br />

              <em>
                Conquiste a sua vaga.
              </em>
            </h1>

            <p>
              Conteúdo direto ao ponto, questões comentadas e
              um plano de estudo que transforma edital em
              aprovação.
            </p>

            <form
              action="/apostilas"
              className="hero-search"
            >
              <span aria-hidden="true">
                ⌕
              </span>

              <input
                name="busca"
                aria-label="Buscar concurso"
                placeholder="Digite o concurso dos seus sonhos"
              />

              <button type="submit">
                Encontrar apostila
              </button>
            </form>

            <div className="hero-proof">
              <div
                className="avatar-stack"
                aria-hidden="true"
              >
                <b>MR</b>
                <b>JC</b>
                <b>AL</b>
                <b>+8k</b>
              </div>

              <p>
                <strong>
                  4,9 ★
                </strong>{" "}
                por quem decidiu levar a aprovação a sério.
              </p>
            </div>
          </div>

          <div
            className="hero-visual"
            aria-label="Plataforma de estudos para concursos"
          >
            <div className="study-card study-card-main">
              <div className="card-topline">
                <span>
                  PLANO DA SEMANA
                </span>

                <strong>
                  72%
                </strong>
              </div>

              <h2>
                Você está no ritmo.
              </h2>

              <div className="progress">
                <i />
              </div>

              <div className="mini-subjects">
                <span>
                  Português <b>✓</b>
                </span>

                <span>
                  Conhecimentos Específicos{" "}
                  <b>18/24</b>
                </span>

                <span>
                  Simulado Cesgranrio{" "}
                  <b>sábado</b>
                </span>
              </div>
            </div>

            <div className="floating-note note-one">
              <span>✓</span>

              <div>
                <strong>
                  +12 acertos
                </strong>

                <small>
                  esta semana
                </small>
              </div>
            </div>

            <div className="floating-note note-two">
              <span>↗</span>

              <div>
                <strong>
                  Rumo aos 85%
                </strong>

                <small>
                  meta de desempenho
                </small>
              </div>
            </div>
          </div>
        </div>
      </section>


      <section className="trust-strip">
        <div className="container trust-grid">
          <span>
            <i>↻</i>
            <b>
              Atualização garantida
            </b>
            <small>
              até o próximo edital
            </small>
          </span>

          <span>
            <i>⌁</i>
            <b>
              Acesso imediato
            </b>
            <small>
              logo após a compra
            </small>
          </span>

          <span>
            <i>♢</i>
            <b>
              PDF protegido
            </b>
            <small>
              feito para você
            </small>
          </span>

          <span>
            <i>7</i>
            <b>
              Garantia de 7 dias
            </b>
            <small>
              risco zero
            </small>
          </span>
        </div>
      </section>


      <section className="section container">
        <div className="section-heading split-heading">
          <div>
            <span className="eyebrow">
              <i /> Escolha sua direção
            </span>

            <h2>
              Qual vaga tem o seu nome?
            </h2>
          </div>

          <Link
            className="text-link"
            href="/apostilas"
          >
            Ver todas as categorias{" "}
            <span>→</span>
          </Link>
        </div>


        {categories.length > 0 ? (
          <div className="category-grid">
            {categories.map(
              (category) => (
                <Link
                  key={
                    category.name
                  }
                  href={`/apostilas?categoria=${encodeURIComponent(
                    category.name.toLowerCase()
                  )}`}
                  className={`category-card ${category.tone}`}
                >
                  <b>
                    {category.icon}
                  </b>

                  <span>
                    <strong>
                      {category.name}
                    </strong>

                    <small>
                      {category.count}{" "}
                      {category.count ===
                      1
                        ? "apostila"
                        : "apostilas"}
                    </small>
                  </span>

                  <i>→</i>
                </Link>
              )
            )}
          </div>
        ) : (
          <div className="empty-results">
            <h3>
              Novas apostilas em preparação
            </h3>

            <p>
              Nosso catálogo está sendo atualizado.
            </p>
          </div>
        )}
      </section>


      <section className="section products-section">
        <div className="container">
          <div className="section-heading split-heading">
            <div>
              <span className="eyebrow">
                <i /> Seleção dos concurseiros
              </span>

              <h2>
                As apostilas mais procuradas
              </h2>

              <p>
                Materiais completos, revisados e pensados para
                o perfil de cada banca.
              </p>
            </div>

            <Link
              className="button button-ghost"
              href="/apostilas"
            >
              Explorar catálogo
            </Link>
          </div>


          {products.length > 0 ? (
            <div className="product-grid">
              {products.map(
                (product) => (
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
          ) : (
            <div className="empty-results">
              <h3>
                Nenhuma apostila publicada
              </h3>

              <p>
                Em breve teremos novos materiais disponíveis.
              </p>
            </div>
          )}
        </div>
      </section>


      <section className="section container story-section">
        <div className="story-panel">
          <div className="story-mark">
            “
          </div>

          <div className="story-copy">
            <span className="eyebrow eyebrow-light">
              <i /> Histórias que movem
            </span>

            <blockquote>
              “Eu parei de colecionar PDFs e comecei a estudar
              com um caminho claro. A aprovação deixou de
              parecer distante.”
            </blockquote>

            <p>
              <strong>
                Marina Rocha
              </strong>

              <span>
                aprovada em 2º lugar • área administrativa
              </span>
            </p>
          </div>

          <div className="story-stat">
            <strong>
              87%
            </strong>

            <span>
              foi a evolução de Marina nos simulados em 10
              semanas.
            </span>
          </div>
        </div>
      </section>


      <section
        className="section how-section"
        id="como-funciona"
      >
        <div className="container">
          <div className="section-heading centered">
            <span className="eyebrow">
              <i /> Simples de começar
            </span>

            <h2>
              Da escolha ao primeiro acerto
            </h2>
          </div>

          <div className="steps-grid">
            <article>
              <b>01</b>
              <span>⌕</span>

              <h3>
                Encontre seu concurso
              </h3>

              <p>
                Busque por órgão, cargo, banca ou área de
                interesse.
              </p>
            </article>

            <article>
              <b>02</b>
              <span>▤</span>

              <h3>
                Estude o que importa
              </h3>

              <p>
                Siga o material estruturado pelo edital, sem
                perder tempo.
              </p>
            </article>

            <article>
              <b>03</b>
              <span>✓</span>

              <h3>
                Teste seu progresso
              </h3>

              <p>
                Resolva questões e acompanhe sua evolução por
                disciplina.
              </p>
            </article>
          </div>

          <div className="center-actions">
            <Link
              href="/simulados"
              className="button button-primary"
            >
              Fazer simulado gratuito{" "}
              <span>→</span>
            </Link>
          </div>
        </div>
      </section>


      <section className="section container notices-section">
        <div className="section-heading split-heading">
          <div>
            <span className="eyebrow">
              <i /> Radar de oportunidades
            </span>

            <h2>
              Editais no seu horizonte
            </h2>
          </div>

          <Link
            className="text-link"
            href="/editais"
          >
            Acompanhar todos{" "}
            <span>→</span>
          </Link>
        </div>

        <div className="notice-grid">
          {[
            [
              "ABERTO",
              "Marinha do Brasil",
              "Praças — área técnica",
              "Inscrições até 12/09",
              "1.100 vagas",
            ],

            [
              "PREVISTO",
              "Transpetro",
              "Quadro de terra — nível médio",
              "Banca em definição",
              "salários até R$ 8,7 mil",
            ],

            [
              "ABERTO",
              "EBSERH",
              "Área assistencial",
              "Inscrições até 28/09",
              "545 vagas",
            ],
          ].map(
            (notice) => (
              <article
                key={
                  notice[1]
                }
              >
                <div>
                  <span
                    className={
                      notice[0] ===
                      "ABERTO"
                        ? "status-open"
                        : "status-soon"
                    }
                  >
                    {notice[0]}
                  </span>

                  <small>
                    {notice[4]}
                  </small>
                </div>

                <h3>
                  {notice[1]}
                </h3>

                <p>
                  {notice[2]}
                </p>

                <footer>
                  <span>
                    {notice[3]}
                  </span>

                  <Link href="/apostilas">
                    Ver material →
                  </Link>
                </footer>
              </article>
            )
          )}
        </div>
      </section>


      <section className="newsletter-section">
        <div className="container newsletter-grid">
          <div>
            <span className="eyebrow eyebrow-light">
              <i /> Radar Facil Digital+
            </span>

            <h2>
              O próximo edital não vai passar por você.
            </h2>

            <p>
              Receba alertas da sua área, dicas de estudo e
              novidades sem ruído.
            </p>
          </div>

          <form
            className="newsletter-form"
            action="/obrigado"
          >
            <input
              aria-label="Seu melhor e-mail"
              type="email"
              required
              placeholder="Seu melhor e-mail"
            />

            <select
              aria-label="Área de interesse"
              defaultValue=""
            >
              <option
                value=""
                disabled
              >
                Área de interesse
              </option>

              <option>
                Estatais
              </option>

              <option>
                Saúde
              </option>

              <option>
                Tribunais
              </option>
            </select>

            <button
              className="button button-accent"
              type="submit"
            >
              Quero receber alertas
            </button>

            <small>
              Ao continuar, você concorda com nossa Política
              de Privacidade.
            </small>
          </form>
        </div>
      </section>
    </main>
  );
}