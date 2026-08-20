import type { Metadata } from "next";
import { SimulationResults } from "../../../../components/simulation-results";

export const metadata: Metadata = {
  title: "Resultado do simulado",
  description: "Veja sua pontuação e ranking.",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SimulationResultPage({ params }: PageProps) {
  const { id } = await params;
  return <SimulationResults simulationId={parseInt(id)} />;
}