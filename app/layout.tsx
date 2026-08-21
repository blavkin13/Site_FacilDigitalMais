import type { Metadata } from "next";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { ShopProvider } from "../components/shop-provider";
import { AuthProvider } from "../components/auth-provider";
import "./globals.css";
import "./extra.css";

export const metadata: Metadata = {
  title: { default: "Aprova Digital — Apostilas para Concursos", template: "%s | Facil Digital+" },
  description: "Apostilas completas, questões comentadas e simulados para transformar seu edital em um plano de aprovação.",
  metadataBase: new URL("https://aprova-digital-apostilas.facildigitalmais.chatgpt.site"),
  openGraph: {
    title: "Aprova Digital — Apostilas para Concursos",
    description: "Estude com direção. Conquiste a sua vaga.",
    images: [{ url: "/og.png", width: 1672, height: 941, alt: "Facil Digital+ — Estude com direção. Conquiste a sua vaga." }],
  },
  twitter: { card: "summary_large_image", title: "Aprova Digital — Apostilas para Concursos", description: "Estude com direção. Conquiste a sua vaga.", images: ["/og.png"] },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body>
        <AuthProvider>
          <ShopProvider>
            <SiteHeader />
            {children}
            <SiteFooter />
          </ShopProvider>
        </AuthProvider>
      </body>
    </html>
  );
}