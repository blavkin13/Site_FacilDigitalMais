"use client";
import { useMemo, useState } from "react";
import { ProductCard } from "./product-card";
import { products } from "../lib/products";

export function Catalog() {
  const [query,setQuery]=useState(""); const [level,setLevel]=useState("Todos"); const [category,setCategory]=useState("Todas");
  const filtered=useMemo(()=>products.filter(p=>(!query||p.title.toLowerCase().includes(query.toLowerCase())||p.bank.toLowerCase().includes(query.toLowerCase()))&&(level==="Todos"||p.level===level)&&(category==="Todas"||p.category===category)),[query,level,category]);
  function sync(key:string,value:string){const url=new URL(window.location.href);value==="Todos"||value==="Todas"||!value?url.searchParams.delete(key):url.searchParams.set(key,value.toLowerCase());window.history.replaceState({},"",url)}
  return <main className="catalog-page">
    <section className="catalog-hero"><div className="container"><span className="eyebrow eyebrow-light"><i /> Catálogo Facil Digital+</span><h1>O material certo para<br/>a vaga que você quer.</h1><p>Filtre, compare e escolha sua próxima preparação.</p></div></section>
    <section className="container catalog-layout">
      <aside className="filters"><div><span>FILTROS</span><button onClick={()=>{setQuery("");setLevel("Todos");setCategory("Todas");history.replaceState({},"",location.pathname)}}>Limpar</button></div><label>Busca<input value={query} onChange={e=>{setQuery(e.target.value);sync("busca",e.target.value)}} placeholder="Cargo, órgão ou banca"/></label><label>Nível<select value={level} onChange={e=>{setLevel(e.target.value);sync("nivel",e.target.value)}}><option>Todos</option><option>Técnico</option><option>Superior</option></select></label><label>Categoria<select value={category} onChange={e=>{setCategory(e.target.value);sync("categoria",e.target.value)}}><option>Todas</option><option>Saúde</option><option>Estatais</option><option>Meio ambiente</option></select></label><div className="filter-checks"><strong>Extras</strong><label><input type="checkbox"/> Mais vendidas</label><label><input type="checkbox"/> Atualizadas</label><label><input type="checkbox"/> Em promoção</label></div></aside>
      <div className="catalog-results"><header><div><span>{filtered.length} resultados</span><h2>Apostilas em destaque</h2></div><select aria-label="Ordenar produtos"><option>Mais relevantes</option><option>Menor preço</option><option>Mais vendidas</option></select></header>{filtered.length?<div className="product-grid catalog-products">{filtered.map(p=><ProductCard key={p.slug} product={p}/>)}</div>:<div className="empty-results"><span>⌕</span><h3>Nenhuma apostila encontrada</h3><p>Tente remover um filtro ou buscar por outro termo.</p></div>}</div>
    </section>
  </main>
}
