"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export function CheckoutSuccess() {
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "true";

  return (
    <main className="checkout-success-page">
      <div className="success-container">
        <span className="success-icon">✓</span>
        <small>{isDemo ? "COMPRA SIMULADA" : "PAGAMENTO CONFIRMADO"}</small>
        <h1>
          {isDemo
            ? "Compra de demonstração concluída!"
            : "Sua compra foi confirmada!"}
        </h1>
        <p>
          {isDemo
            ? "Em produção, esta tela aparecerá após a confirmação real do Mercado Pago."
            : "Seus materiais já estão disponíveis na sua biblioteca."}
        </p>

        <div className="success-actions">
          <Link href="/minha-conta" className="button button-primary">
            Acessar minha biblioteca →
          </Link>
          <Link href="/simulados" className="button button-ghost">
            Fazer simulados
          </Link>
        </div>

        <div className="success-info">
          <small>♢ Seus PDFs estão protegidos com seu CPF como senha e marca d'água.</small>
        </div>
      </div>
    </main>
  );
}