import type { Metadata } from "next";
import { StudentDashboard } from "../../components/student-dashboard";

export const metadata: Metadata = {
  title: "Área do aluno",
  description: "Biblioteca e desempenho do aluno.",
};

export default function StudentArea() {
  return <StudentDashboard />;
}