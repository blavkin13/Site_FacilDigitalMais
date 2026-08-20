import type { Metadata } from "next";
import { SimulationList } from "../../components/simulation-list";

export const metadata: Metadata = {
  title: "Simulados",
  description: "Pratique no estilo das principais bancas.",
};

export default function Simulados() {
  return <SimulationList />;
}