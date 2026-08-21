"use client";

import {
  useMemo,
  useState,
} from "react";

import type {
  Product,
} from "../lib/product-types";

import {
  ProductCard,
} from "./product-card";


interface CatalogProps {
  products: Product[];

  initialQuery?: string;

  initialLevel?: string;

  initialCategory?: string;
}


function normalizeText(
  value: string
): string {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim();
}


function resolveOption(
  requestedValue: string,
  availableValues: string[],
  fallback: string
): string {
  if (
    !requestedValue.trim()
  ) {
    return fallback;
  }

  const normalizedRequested =
    normalizeText(
      requestedValue
    );

  return (
    availableValues.find(
      (value) =>
        normalizeText(
          value
        ) ===
        normalizedRequested
    ) || fallback
  );
}


export function Catalog({
  products,
  initialQuery = "",
  initialLevel = "",
  initialCategory = "",
}: CatalogProps) {
  const levels =
    useMemo(
      () =>
        Array.from(
          new Set(
            products
              .map(
                (product) =>
                  product.level
              )
              .filter(Boolean)
          )
        ).sort(
          (a, b) =>
            a.localeCompare(
              b,
              "pt-BR"
            )
        ),
      [
        products,
      ]
    );


  const categories =
    useMemo(
      () =>
        Array.from(
          new Set(
            products
              .map(
                (product) =>
                  product.category
              )
              .filter(Boolean)
          )
        ).sort(
          (a, b) =>
            a.localeCompare(
              b,
              "pt-BR"
            )
        ),
      [
        products,
      ]
    );


  const [
    query,
    setQuery,
  ] =
    useState(
      initialQuery
    );


  const [
    level,
    setLevel,
  ] =
    useState(
      () =>
        resolveOption(
          initialLevel,
          levels,
          "Todos"
        )
    );


  const [
    category,
    setCategory,
  ] =
    useState(
      () =>
        resolveOption(
          initialCategory,
          categories,
          "Todas"
        )
    );


  const filtered =
    useMemo(
      () => {
        const normalizedQuery =
          normalizeText(
            query
          );


        return products.filter(
          (product) => {
            const matchesQuery =
              !normalizedQuery ||
              normalizeText(
                product.title
              ).includes(
                normalizedQuery
              ) ||
              normalizeText(
                product.shortTitle
              ).includes(
                normalizedQuery
              ) ||
              normalizeText(
                product.bank
              ).includes(
                normalizedQuery
              ) ||
              normalizeText(
                product.category
              ).includes(
                normalizedQuery
              );


            const matchesLevel =
              level ===
                "Todos" ||
              product.level ===
                level;


            const matchesCategory =
              category ===
                "Todas" ||
              product.category ===
                category;


            return (
              matchesQuery &&
              matchesLevel &&
              matchesCategory
            );
          }
        );
      },
      [
        products,
        query,
        level,
        category,
      ]
    );


  function syncUrl(
    key: string,
    value: string
  ) {
    const url =
      new URL(
        window.location.href
      );


    if (
      value === "Todos" ||
      value === "Todas" ||
      !value.trim()
    ) {
      url.searchParams.delete(
        key
      );
    } else {
      url.searchParams.set(
        key,
        value.toLowerCase()
      );
    }


    window.history.replaceState(
      {},
      "",
      url
    );
  }


  function clearFilters() {
    setQuery("");
    setLevel("Todos");
    setCategory("Todas");

    window.history.replaceState(
      {},
      "",
      window.location.pathname
    );
  }


  return (
    <main className="catalog-page">
      <section className="catalog-hero">
        <div className="container">
          <span className="eyebrow eyebrow-light">
            <i /> Catálogo Facil Digital+
          </span>

          <h1>
            O material certo para
            <br />
            a vaga que você quer.
          </h1>

          <p>
            Filtre, compare e escolha sua próxima preparação.
          </p>
        </div>
      </section>


      <section className="container catalog-layout">
        <aside className="filters">
          <div>
            <span>
              FILTROS
            </span>

            <button
              type="button"
              onClick={
                clearFilters
              }
            >
              Limpar
            </button>
          </div>


          <label>
            Busca

            <input
              value={
                query
              }
              onChange={
                (event) => {
                  const value =
                    event.target.value;

                  setQuery(
                    value
                  );

                  syncUrl(
                    "busca",
                    value
                  );
                }
              }
              placeholder="Cargo, órgão ou banca"
            />
          </label>


          <label>
            Nível

            <select
              value={
                level
              }
              onChange={
                (event) => {
                  const value =
                    event.target.value;

                  setLevel(
                    value
                  );

                  syncUrl(
                    "nivel",
                    value
                  );
                }
              }
            >
              <option>
                Todos
              </option>

              {levels.map(
                (
                  availableLevel
                ) => (
                  <option
                    key={
                      availableLevel
                    }
                  >
                    {
                      availableLevel
                    }
                  </option>
                )
              )}
            </select>
          </label>


          <label>
            Categoria

            <select
              value={
                category
              }
              onChange={
                (event) => {
                  const value =
                    event.target.value;

                  setCategory(
                    value
                  );

                  syncUrl(
                    "categoria",
                    value
                  );
                }
              }
            >
              <option>
                Todas
              </option>

              {categories.map(
                (
                  availableCategory
                ) => (
                  <option
                    key={
                      availableCategory
                    }
                  >
                    {
                      availableCategory
                    }
                  </option>
                )
              )}
            </select>
          </label>


          <div className="filter-checks">
            <strong>
              Extras
            </strong>

            <label>
              <input
                type="checkbox"
              />{" "}
              Mais vendidas
            </label>

            <label>
              <input
                type="checkbox"
              />{" "}
              Atualizadas
            </label>

            <label>
              <input
                type="checkbox"
              />{" "}
              Em promoção
            </label>
          </div>
        </aside>


        <div className="catalog-results">
          <header>
            <div>
              <span>
                {filtered.length}{" "}
                {filtered.length ===
                1
                  ? "resultado"
                  : "resultados"}
              </span>

              <h2>
                Apostilas em destaque
              </h2>
            </div>

            <select aria-label="Ordenar produtos">
              <option>
                Mais relevantes
              </option>

              <option>
                Menor preço
              </option>

              <option>
                Mais vendidas
              </option>
            </select>
          </header>


          {filtered.length >
          0 ? (
            <div className="product-grid catalog-products">
              {filtered.map(
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
              <span>⌕</span>

              <h3>
                Nenhuma apostila encontrada
              </h3>

              <p>
                Tente remover um filtro ou buscar por outro
                termo.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}