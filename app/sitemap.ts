import type { MetadataRoute } from "next";
import { products } from "@/lib/products";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://seusite.com.br"
  ).replace(/\/+$/, "");

  const currentDate = new Date().toISOString();

  // Páginas estáticas públicas
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/apostilas`,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/simulados`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/editais`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  // Páginas de produtos
  const productRoutes: MetadataRoute.Sitemap = products.map(
    (product) => ({
      url: `${baseUrl}/apostilas/${product.slug}`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.8,
    })
  );

  // Páginas de concursos
  // Na Fase 1 esta lista também passará a ser derivada do banco.
  const contestRoutes: MetadataRoute.Sitemap = [
    "transpetro",
    "ebserh",
    "marinha",
  ].map((contest) => ({
    url: `${baseUrl}/concurso/${contest}`,
    lastModified: currentDate,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [
    ...staticRoutes,
    ...productRoutes,
    ...contestRoutes,
  ];
}