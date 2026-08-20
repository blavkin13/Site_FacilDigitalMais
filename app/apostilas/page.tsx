import type { Metadata } from "next";
import { Catalog } from "../../components/catalog";
export const metadata: Metadata = { title: "Catálogo de apostilas", description: "Encontre apostilas por cargo, banca, nível e área." };
export default function CatalogPage() { return <Catalog />; }
