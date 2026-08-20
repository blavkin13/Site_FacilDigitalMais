import type { Metadata } from "next";
import { AdminDashboard } from "../../components/admin-dashboard";

export const metadata: Metadata = {
  title: "Painel Administrativo",
  description: "Dashboard do administrador.",
};

export default function AdminPage() {
  return <AdminDashboard />;
}