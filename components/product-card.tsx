"use client";

import Link from "next/link";

import type {
  Product,
} from "../lib/product-types";

import {
  useShop,
} from "./shop-provider";


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


export function ProductCard({
  product,
}: {
  product: Product;
}) {
  const {
    add,
  } =
    useShop();


  return (
    <article className="product-card">
      <Link
        href={`/apostilas/${product.slug}`}
        className={`cover-art ${product.coverClass}`}
        style={{
          backgroundImage:
            `linear-gradient(180deg, transparent 30%, rgba(5,20,45,.88) 100%), url(${product.cover})`,
        }}
      >
        <span className="cover-brand">
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
            {product.bank} •{" "}
            {product.level}
          </i>
        </div>

        <b className="cover-badge">
          ATUALIZADA
        </b>
      </Link>


      <div className="product-card-body">
        <div className="product-tags">
          <span>
            {product.bank}
          </span>

          <span>
            {product.level}
          </span>
        </div>

        <Link
          href={`/apostilas/${product.slug}`}
        >
          <h3>
            {product.title}
          </h3>
        </Link>


        <p className="product-meta">
          <span>
            ▤ {product.pages} páginas
          </span>

          <span>
            ✓ {product.questions} questões
          </span>
        </p>


        <div className="rating">
          <span>
            ★★★★★
          </span>

          <small>
            4,9 (127 avaliações)
          </small>
        </div>


        <div className="product-buy">
          <div>
            <del>
              {formatPrice(
                product.oldPrice
              )}
            </del>

            <strong>
              {formatPrice(
                product.price
              )}
            </strong>

            <small>
              ou 12x no cartão
            </small>
          </div>

          <button
            type="button"
            onClick={
              () =>
                add(
                  product
                )
            }
            aria-label={`Adicionar ${product.title} ao carrinho`}
          >
            ＋
          </button>
        </div>


        <Link
          className="card-link"
          href={`/apostilas/${product.slug}`}
        >
          Conhecer a apostila{" "}
          <span>→</span>
        </Link>
      </div>
    </article>
  );
}