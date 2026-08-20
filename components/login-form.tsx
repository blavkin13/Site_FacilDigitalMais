"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "./auth-provider";

export function LoginForm() {
  const { login, register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/minha-conta";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Campos do formulário
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");

  // Máscara de CPF
  function formatCpf(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  // Máscara de telefone
  function formatPhone(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        const result = await login(email, password);
        if (result.success) {
          router.push(returnTo);
        } else {
          setError(result.error || "Erro ao fazer login.");
        }
      } else {
        // Validações de cadastro
        if (password !== confirmPassword) {
          setError("As senhas não coincidem.");
          setLoading(false);
          return;
        }

        if (password.length < 6) {
          setError("A senha deve ter pelo menos 6 caracteres.");
          setLoading(false);
          return;
        }

        const result = await register({ email, password, name, cpf, phone });
        if (result.success) {
          router.push(returnTo);
        } else {
          setError(result.error || "Erro ao cadastrar.");
        }
      }
    } catch {
      setError("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="container">
          <span className="eyebrow eyebrow-light">
            <i /> {mode === "login" ? "Acesse sua conta" : "Crie sua conta"}
          </span>
          <h1>
            {mode === "login"
              ? "Bom te ver de novo."
              : "Comece sua preparação hoje."}
          </h1>
          <p>
            {mode === "login"
              ? "Entre para acessar suas apostilas e simulados."
              : "Cadastre-se e tenha acesso a materiais exclusivos."}
          </p>
        </div>
      </section>

      <section className="container login-container">
        <div className="login-card">
          {/* Abas Login / Cadastro */}
          <div className="login-tabs">
            <button
              className={mode === "login" ? "active" : ""}
              onClick={() => { setMode("login"); setError(""); }}
            >
              Entrar
            </button>
            <button
              className={mode === "register" ? "active" : ""}
              onClick={() => { setMode("register"); setError(""); }}
            >
              Criar conta
            </button>
          </div>

          {/* Mensagem de erro */}
          {error && (
            <div className="login-error">
              <span>⚠</span> {error}
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit}>
            {mode === "register" && (
              <label>
                Nome completo *
                <input
                  type="text"
                  required
                  placeholder="Como no documento"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                />
              </label>
            )}

            <label>
              E-mail *
              <input
                type="email"
                required
                placeholder="voce@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </label>

            <label>
              Senha *
              <input
                type="password"
                required
                placeholder={mode === "login" ? "Sua senha" : "Mínimo 6 caracteres"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                minLength={6}
              />
            </label>

            {mode === "register" && (
              <>
                <label>
                  Confirmar senha *
                  <input
                    type="password"
                    required
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    minLength={6}
                  />
                </label>

                <label>
                  CPF
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(formatCpf(e.target.value))}
                    disabled={loading}
                  />
                  <small>Será usado como senha do PDF das apostilas.</small>
                </label>

                <label>
                  Telefone
                  <input
                    type="text"
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    disabled={loading}
                  />
                </label>
              </>
            )}

            <button
              type="submit"
              className="button button-primary login-submit"
              disabled={loading}
            >
              {loading
                ? "Aguarde..."
                : mode === "login"
                ? "Entrar →"
                : "Criar minha conta →"}
            </button>
          </form>

          {/* Link alternativo */}
          <div className="login-switch">
            {mode === "login" ? (
              <p>
                Ainda não tem conta?{" "}
                <button onClick={() => { setMode("register"); setError(""); }}>
                  Cadastre-se grátis
                </button>
              </p>
            ) : (
              <p>
                Já tem uma conta?{" "}
                <button onClick={() => { setMode("login"); setError(""); }}>
                  Fazer login
                </button>
              </p>
            )}
          </div>

          <div className="login-footer">
            <small>♢ Seus dados estão protegidos e nunca serão compartilhados.</small>
          </div>
        </div>
      </section>
    </main>
  );
}