import type {
  Metadata,
} from "next";

import {
  Catalog,
} from "../../components/catalog";

import {
  getActiveProducts,
} from "../../lib/product-repository";


export const metadata: Metadata = {
  title:
    "Catálogo de apostilas",

  description:
    "Encontre apostilas por cargo, banca, nível e área.",
};


/**
 * O catálogo precisa refletir imediatamente produtos
 * ativados/desativados pelo administrador.
 */
export const dynamic =
  "force-dynamic";


type SearchParamValue =
  | string
  | string[]
  | undefined;


interface CatalogPageProps {
  searchParams: Promise<{
    busca?: SearchParamValue;
    nivel?: SearchParamValue;
    categoria?: SearchParamValue;
  }>;
}


function firstSearchParam(
  value: SearchParamValue
): string {
  if (
    Array.isArray(value)
  ) {
    return (
      value[0] || ""
    );
  }

  return value || "";
}


export default async function CatalogPage({
  searchParams,
}: CatalogPageProps) {
  const [
    products,
    resolvedSearchParams,
  ] =
    await Promise.all([
      getActiveProducts(),
      searchParams,
    ]);


  return (
    <Catalog
      products={
        products
      }
      initialQuery={
        firstSearchParam(
          resolvedSearchParams.busca
        )
      }
      initialLevel={
        firstSearchParam(
          resolvedSearchParams.nivel
        )
      }
      initialCategory={
        firstSearchParam(
          resolvedSearchParams.categoria
        )
      }
    />
  );
}