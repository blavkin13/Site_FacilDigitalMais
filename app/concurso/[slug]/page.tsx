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


export const dynamic =
  "force-dynamic";


interface PageProps {
  params:
    Promise<{
      slug:
        string;
    }>;
}


function humanizeContestSlug(
  contestSlug:
    string
): string {
  return contestSlug
    .split(
      "-"
    )
    .filter(
      Boolean
    )
    .map(
      (
        word
      ) =>
        word
          .charAt(
            0
          )
          .toUpperCase() +
        word.slice(
          1
        )
    )
    .join(
      " "
    );
}


/**
 * Desde a Fase 3D a organização é um campo
 * editorial explícito.
 *
 * O repository ainda preenche organization por
 * fallback para produtos legados, preservando
 * compatibilidade com materiais antigos.
 */
function getContestName(
  products:
    Product[],
  contestSlug:
    string
): string {
  const productWithOrganization =
    products.find(
      (
        product
      ) =>
        Boolean(
          product.organization
            ?.trim()
        )
    );


  if (
    productWithOrganization
      ?.organization
      ?.trim()
  ) {
    return productWithOrganization
      .organization
      .trim();
  }


  return humanizeContestSlug(
    contestSlug
  );
}


export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const {
    slug,
  } =
    await params;


  const products =
    await getProductsByContest(
      slug
    );


  if (
    products.length ===
    0
  ) {
    return {
      title:
        "Concurso não encontrado",

      description:
        "Não há apostilas disponíveis para este concurso.",

      robots: {
        index:
          false,

        follow:
          false,
      },
    };
  }


  const contestName =
    getContestName(
      products,
      slug
    );


  const title =
    `Apostilas para ${contestName}`;


  const description =
    `Materiais completos e atualizados para o concurso ${contestName}.`;


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

      description:
        `Prepare-se para o concurso ${contestName} com materiais completos da Facil Digital+.`,

      type:
        "website",
    },

    twitter: {
      card:
        "summary",

      title,

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
  } =
    await params;


  const products =
    await getProductsByContest(
      slug
    );


  if (
    products.length ===
    0
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