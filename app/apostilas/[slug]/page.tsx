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


export const dynamic =
  "force-dynamic";


interface ProductPageProps {
  params:
    Promise<{
      slug:
        string;
    }>;
}


export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const {
    slug,
  } =
    await params;


  const product =
    await getActiveProductBySlug(
      slug
    );


  if (
    !product
  ) {
    return {
      title:
        "Apostila não encontrada",

      robots: {
        index:
          false,

        follow:
          false,
      },
    };
  }


  const title =
    product.seoTitle ||
    product.title;


  const description =
    product.seoDescription ||
    product.description;


  return {
    title,

    description,

    robots: {
      index:
        true,

      follow:
        true,
    },

    openGraph: {
      title,

      description,

      type:
        "website",

      images:
        product.cover
          ? [
              {
                url:
                  product.cover,

                alt:
                  product.title,
              },
            ]
          : [],
    },

    twitter: {
      card:
        "summary_large_image",

      title,

      description,

      images:
        product.cover
          ? [
              product.cover,
            ]
          : [],
    },
  };
}


export default async function ProductPage({
  params,
}: ProductPageProps) {
  const {
    slug,
  } =
    await params;


  const product =
    await getActiveProductBySlug(
      slug
    );


  if (
    !product
  ) {
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