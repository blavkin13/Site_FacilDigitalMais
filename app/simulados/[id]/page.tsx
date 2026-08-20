import { notFound } from "next/navigation";
import { SimulationQuizClient } from "../../../components/simulation-quiz-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SimulationPage({ params }: PageProps) {
  const { id } = await params;
  return <SimulationQuizClient simulationId={parseInt(id)} />;
}