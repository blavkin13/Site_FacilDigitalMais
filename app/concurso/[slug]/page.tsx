import { notFound } from "next/navigation";
import { ContestLanding } from "../../../components/contest-landing";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  return {
    title: `Apostilas para ${slug.replace(/-/g, " ")}`,
    description: `Materiais completos para o concurso ${slug}.`,
  };
}

export default async function ContestPage({ params }: PageProps) {
  const { slug } = await params;
  return <ContestLanding contestSlug={slug} />;
}