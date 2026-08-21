import type {
  MetadataRoute,
} from "next";

import {
  getActiveContestSlugs,
  getActiveProducts,
} from "@/lib/product-repository";


/**
 * O sitemap precisa refletir novos produtos e concursos
 * publicados no painel administrativo sem exigir rebuild.
 */
export const dynamic =
  "force-dynamic";


export default async function sitemap(): Promise<
  MetadataRoute.Sitemap
> {
  const baseUrl = (
    process.env
      .NEXT_PUBLIC_BASE_URL ||
    "https://seusite.com.br"
  ).replace(
    /\/+$/,
    ""
  );


  const currentDate =
    new Date().toISOString();


  /**
   * Produtos e concursos são obtidos exclusivamente
   * através da camada SQLite.
   */
  const [
    products,
    contestSlugs,
  ] =
    await Promise.all([
      getActiveProducts(),
      getActiveContestSlugs(),
    ]);


  const staticRoutes:
    MetadataRoute.Sitemap =
    [
      {
        url:
          baseUrl,

        lastModified:
          currentDate,

        changeFrequency:
          "daily",

        priority:
          1,
      },

      {
        url:
          `${baseUrl}/apostilas`,

        lastModified:
          currentDate,

        changeFrequency:
          "daily",

        priority:
          0.9,
      },

      {
        url:
          `${baseUrl}/simulados`,

        lastModified:
          currentDate,

        changeFrequency:
          "weekly",

        priority:
          0.8,
      },

      {
        url:
          `${baseUrl}/editais`,

        lastModified:
          currentDate,

        changeFrequency:
          "weekly",

        priority:
          0.7,
      },

      {
        url:
          `${baseUrl}/login`,

        lastModified:
          currentDate,

        changeFrequency:
          "monthly",

        priority:
          0.5,
      },
    ];


  /**
   * Somente produtos ativos são retornados por
   * getActiveProducts().
   */
  const productRoutes:
    MetadataRoute.Sitemap =
    products.map(
      (product) => ({
        url:
          `${baseUrl}/apostilas/${product.slug}`,

        lastModified:
          currentDate,

        changeFrequency:
          "weekly",

        priority:
          0.8,
      })
    );


  /**
   * Concursos deixam de ser uma lista fixa.
   *
   * Eles são derivados dos produtos ativos atualmente
   * existentes no SQLite.
   */
  const contestRoutes:
    MetadataRoute.Sitemap =
    contestSlugs.map(
      (contestSlug) => ({
        url:
          `${baseUrl}/concurso/${contestSlug}`,

        lastModified:
          currentDate,

        changeFrequency:
          "weekly",

        priority:
          0.7,
      })
    );


  return [
    ...staticRoutes,
    ...productRoutes,
    ...contestRoutes,
  ];
}