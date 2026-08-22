import type {
  MetadataRoute,
} from "next";

import {
  getActiveContestSlugs,
  getActiveProducts,
} from "@/lib/product-repository";

import type {
  Product,
} from "@/lib/product-types";


export const dynamic =
  "force-dynamic";


function normalizeDate(
  value:
    string | null | undefined,
  fallback:
    string
): string {
  if (
    !value
  ) {
    return fallback;
  }


  const parsed =
    new Date(
      value
    );


  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return fallback;
  }


  return parsed
    .toISOString();
}


function getProductLastModified(
  product:
    Product,
  fallback:
    string
): string {
  const candidates = [
    product.publishedAt,
    product.updatedAt,
  ]
    .filter(
      (
        value
      ): value is string =>
        Boolean(
          value
        )
    )
    .map(
      (
        value
      ) =>
        new Date(
          value
        )
    )
    .filter(
      (
        date
      ) =>
        !Number.isNaN(
          date.getTime()
        )
    );


  if (
    candidates.length ===
    0
  ) {
    return fallback;
  }


  const latest =
    candidates.reduce(
      (
        current,
        candidate
      ) =>
        candidate.getTime() >
        current.getTime()
          ? candidate
          : current
    );


  return latest
    .toISOString();
}


function getContestLastModified(
  contestSlug:
    string,
  products:
    Product[],
  fallback:
    string
): string {
  const related =
    products.filter(
      (
        product
      ) =>
        product.contestSlug ===
        contestSlug
    );


  if (
    related.length ===
    0
  ) {
    return fallback;
  }


  const dates =
    related.map(
      (
        product
      ) =>
        getProductLastModified(
          product,
          fallback
        )
    );


  return dates
    .reduce(
      (
        latest,
        candidate
      ) =>
        new Date(
          candidate
        ).getTime() >
        new Date(
          latest
        ).getTime()
          ? candidate
          : latest
    );
}


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
    new Date()
      .toISOString();


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


  const productRoutes:
    MetadataRoute.Sitemap =
    products.map(
      (
        product
      ) => ({
        url:
          `${baseUrl}/apostilas/${product.slug}`,

        lastModified:
          getProductLastModified(
            product,
            currentDate
          ),

        changeFrequency:
          "weekly",

        priority:
          0.8,
      })
    );


  const contestRoutes:
    MetadataRoute.Sitemap =
    contestSlugs.map(
      (
        contestSlug
      ) => ({
        url:
          `${baseUrl}/concurso/${contestSlug}`,

        lastModified:
          getContestLastModified(
            contestSlug,
            products,
            currentDate
          ),

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