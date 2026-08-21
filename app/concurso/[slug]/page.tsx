import type {
  Metadata,
} from "next";

import {
  notFound,
} from "next/navigation";

import {
  ContestLanding,
} from "../../../components/contest-landing";

import {
  getProductsByContest,
} from "../../../lib/product-repository";

import type {
  Product,
} from "../../../lib/product-types";


/**
 * A página de concurso precisa refletir imediatamente:
 *
 * - novas apostilas;
 * - produtos ativados;
 * - produtos desativados.
 *
 * Portanto, não deve ficar congelada no build.
 */
export const dynamic =
  "force-dynamic";


interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}


/**
 * Obtém o nome comercial do concurso a partir dos
 * produtos vinculados.
 *
 * Exemplo:
 *
 * Transpetro — Contabilidade
 *
 * →
 *
 * Transpetro
 *
 * O fallback converte o slug para uma apresentação
 * legível caso um produto legado não siga esse padrão.
 */
function getContestName(
  products: Product[],
  contestSlug: string
): string {
  const firstProduct =
    products[0];


  if (firstProduct) {
    const [
      organization,
    ] =
      firstProduct.title.split(
        /\s+[—–]\s+/
      );


    if (
      organization?.trim()
    ) {
      return organization.trim();
    }
  }


  return contestSlug
    .split("-")
    .filter(Boolean)
    .map(
      (word) =>
        word.charAt(0)
          .toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}


export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const {
    slug,
  } = await params;


  const products =
    await getProductsByContest(
      slug
    );


  /**
   * Concurso sem nenhuma apostila ativa não deve
   * ser indexado.
   */
  if (
    products.length === 0
  ) {
    return {
      title:
        "Concurso não encontrado",

      description:
        "Não há apostilas disponíveis para este concurso.",

      robots: {
        index: false,
        follow: false,
      },
    };
  }


  const contestName =
    getContestName(
      products,
      slug
    );


  return {
    title:
      `Apostilas para ${contestName}`,

    description:
      `Materiais completos e atualizados para o concurso ${contestName}.`,

    openGraph: {
      title:
        `Apostilas para ${contestName}`,

      description:
        `Prepare-se para o concurso ${contestName} com materiais completos da Facil Digital+.`,

      type:
        "website",
    },

    twitter: {
      card:
        "summary",

      title:
        `Apostilas para ${contestName}`,

      description:
        `Materiais completos para o concurso ${contestName}.`,
    },
  };
}


export default async function ContestPage({
  params,
}: PageProps) {
  const {
    slug,
  } = await params;


  const products =
    await getProductsByContest(
      slug
    );


  /**
   * Como os concursos são derivados das apostilas
   * publicadas, um slug sem produtos ativos não
   * representa uma página pública válida.
   */
  if (
    products.length === 0
  ) {
    notFound();
  }


  const contestName =
    getContestName(
      products,
      slug
    );


  return (
    <ContestLanding
      contestSlug={
        slug
      }
      contestName={
        contestName
      }
      products={
        products
      }
    />
  );
}