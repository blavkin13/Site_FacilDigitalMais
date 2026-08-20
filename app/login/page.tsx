import type { Metadata } from "next";
import { LoginForm } from "../../components/login-form";

export const metadata: Metadata = {
  title: "Entrar ou Cadastrar",
  description: "Acesse sua conta ou crie uma nova para começar a estudar.",
};

export default function LoginPage() {
  return <LoginForm />;
}