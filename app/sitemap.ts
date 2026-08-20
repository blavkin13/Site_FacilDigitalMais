import { MetadataRoute } from "next";
import { products } from "./lib/products";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://seusite.com.br";
  const currentDate = new Date().toISOString();

  // Páginas estáticas
  const staticRoutes = [
    { url: baseUrl, lastModified: currentDate, changeFrequency: "daily" as const, priority: 1 },
    { url: `${baseUrl}/apostilas`, lastModified: currentDate, changeFrequency: "daily" as const, priority: 0.9 },
    { url: `${baseUrl}/simulados`, lastModified: currentDate, changeFrequency: "weekly" as const, priority: 0.8 },
    { url: `${baseUrl}/editais`, lastModified: currentDate, changeFrequency: "weekly" as const, priority: 0.7 },
    { url: `${baseUrl}/login`, lastModified: currentDate, changeFrequency: "monthly" as const, priority: 0.5 },
  ];

  // Páginas de produtos
  const productRoutes = products.map((product) => ({
    url: `${baseUrl}/apostilas/${product.slug}`,
    lastModified: currentDate,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Páginas de concursos (exemplo)
  const contestRoutes = ["transpetro", "ebserh", "marinha"].map((contest) => ({
    url: `${baseUrl}/concurso/${contest}`,
    lastModified: currentDate,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...productRoutes, ...contestRoutes];
}