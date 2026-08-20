"use client";
import Link from "next/link";
import { useState } from "react";
import { formatPrice } from "../lib/products";
import { useShop } from "./shop-provider";

export function SiteHeader() {
  const { cart, remove, open, setOpen } = useShop(); const [menu, setMenu] = useState(false);
  const total = cart.reduce((sum, item) => sum + item.price, 0);
  return <>
    <div className="announcement"><span>⚡</span> Acesso imediato ao material digital após a confirmação do pagamento.</div>
    <header className="site-header"><div className="container nav-wrap">
      <Link className="brand" href="/" aria-label="Facil Digital+ início"><span className="brand-mark">F+</span><span><b>Facil</b> Digital<em>+</em><small>EDUCAÇÃO QUE APROVA</small></span></Link>
      <button className="menu-button" onClick={() => setMenu(!menu)} aria-label="Abrir menu" aria-expanded={menu}>☰</button>
      <nav className={menu ? "main-nav open" : "main-nav"} aria-label="Principal"><Link href="/apostilas">Apostilas</Link><Link href="/simulados">Simulados</Link><Link href="/editais">Editais</Link><Link href="/#como-funciona">Como funciona</Link></nav>
      <div className="nav-actions"><Link href="/minha-conta" className="account-link"><span>♙</span><small>Olá! Entre ou</small><b>acesse sua conta</b></Link><button className="cart-button" onClick={() => setOpen(true)} aria-label={`Carrinho com ${cart.length} itens`}>▱<b>{cart.length}</b></button></div>
    </div></header>
    {open && <div className="cart-backdrop" role="presentation" onMouseDown={() => setOpen(false)}><aside className="cart-drawer" role="dialog" aria-modal="true" aria-label="Seu carrinho" onMouseDown={(e) => e.stopPropagation()}><header><div><span>SEU CARRINHO</span><h2>{cart.length ? `${cart.length} ${cart.length === 1 ? 'material' : 'materiais'}` : 'Ainda vazio'}</h2></div><button onClick={() => setOpen(false)} aria-label="Fechar carrinho">×</button></header>{cart.length ? <><div className="cart-items">{cart.map((item) => <article key={item.slug}><div className={`tiny-cover ${item.coverClass}`} /><div><strong>{item.title}</strong><small>Digital • acesso imediato</small><b>{formatPrice(item.price)}</b></div><button onClick={() => remove(item.slug)} aria-label={`Remover ${item.title}`}>×</button></article>)}</div><footer><p><span>Subtotal</span><strong>{formatPrice(total)}</strong></p><small>Pagamento seguro • garantia de 7 dias</small><Link href="/checkout" className="button button-primary" onClick={() => setOpen(false)}>Ir para o checkout →</Link></footer></> : <div className="empty-cart"><span>▤</span><p>Seus próximos materiais aparecerão aqui.</p><Link href="/apostilas" className="button button-primary" onClick={() => setOpen(false)}>Explorar apostilas</Link></div>}</aside></div>}
  </>;
}
