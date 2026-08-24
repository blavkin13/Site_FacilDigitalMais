import type {
  Metadata,
} from "next";

import {
  SimulationResults,
} from "../../../../../components/simulation-results";


export const metadata:
  Metadata =
  {
    title:
      "Resultado do simulado",

    description:
      "Veja sua pontuação, revisão e ranking.",
  };


interface PageProps {
  params:
    Promise<{
      id:
        string;

      resultId:
        string;
    }>;
}


export default async function SimulationPersistentResultPage({
  params,
}: PageProps) {
  const {
    id,
    resultId,
  } =
    await params;


  return (
    <SimulationResults
      simulationId={
        Number(
          id
        )
      }
      resultId={
        Number(
          resultId
        )
      }
    />
  );
}