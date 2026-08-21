import type {
  Metadata,
} from "next";

import {
  notFound,
} from "next/navigation";

import {
  ProductDetail,
} from "../../../components/product-detail";

import {
  getActiveProductBySlug,
  getRelatedProducts,
} from "../../../lib/product-repository";


/**
 * A landing da apostila deve consultar o SQLite
 * em runtime.
 *
 * Isso permite que novos slugs criados pelo painel
 * administrativo funcionem sem rebuild da aplicação.
 */
export const dynamic =
  "force-dynamic";


interface ProductPageProps {
  params: Promise<{
    slug: string;
  }>;
}


/**
 * Metadata também é alimentada pelo produto ativo
 * existente no SQLite.
 */
export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const {
    slug,
  } = await params;


  const product =
    await getActiveProductBySlug(
      slug
    );


  if (!product) {
    return {
      title:
        "Apostila não encontrada",

      robots: {
        index: false,
        follow: false,
      },
    };
  }


  return {
    title:
      product.title,

    description:
      product.description,

    openGraph: {
      title:
        product.title,

      description:
        product.description,

      images: [
        {
          url:
            product.cover,
        },
      ],
    },

    twitter: {
      card:
        "summary_large_image",

      title:
        product.title,

      description:
        product.description,

      images: [
        product.cover,
      ],
    },
  };
}


export default async function ProductPage({
  params,
}: ProductPageProps) {
  const {
    slug,
  } = await params;


  /**
   * Somente produtos ativos são retornados pelo repository.
   *
   * Produto inexistente ou desativado:
   *
   *     → 404
   */
  const product =
    await getActiveProductBySlug(
      slug
    );


  if (!product) {
    notFound();
  }


  const relatedProducts =
    await getRelatedProducts(
      slug,
      2
    );


  return (
    <ProductDetail
      product={
        product
      }
      relatedProducts={
        relatedProducts
      }
    />
  );
}