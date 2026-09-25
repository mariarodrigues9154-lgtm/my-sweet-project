import { createFileRoute } from "@tanstack/react-router";
import { Search, Menu, Star, Heart, ExternalLink, ShieldCheck, Truck, BadgePercent, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/")({ component: LavadorasPage });

const products = [
  ["Lavadora Consul 12kg CWH12AB","Consul","R$ 1.799,00","R$ 2.199,00","18% OFF","4,8","1.284","https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=900&q=85","Amazon"],
  ["Lavadora Electrolux 13kg LED13","Electrolux","R$ 1.949,00","R$ 2.399,00","19% OFF","4,7","936","https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=900&q=85","Magazine Luiza"],
  ["Lavadora Brastemp 12kg BWK12","Brastemp","R$ 2.099,00","R$ 2.599,00","19% OFF","4,9","742","https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=900&q=85","Mercado Livre"],
  ["Lavadora Panasonic 12kg NA-F120B1","Panasonic","R$ 1.689,00","R$ 1.999,00","16% OFF","4,7","528","https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?auto=format&fit=crop&w=900&q=85","Casas Bahia"],
  ["Lavadora Midea 11kg MA510","Midea","R$ 1.579,00","R$ 1.899,00","17% OFF","4,6","391","https://images.unsplash.com/photo-1604335398980-ededcadcc37d?auto=format&fit=crop&w=900&q=85","Amazon"],
  ["Lavadora Colormaq 12kg LCA12","Colormaq","R$ 1.299,00","R$ 1.599,00","19% OFF","4,5","277","https://images.unsplash.com/photo-1610557892470-a56b9c1f2c8f?auto=format&fit=crop&w=900&q=85","Shopee"],
] as const;

function Card({p}:{p:typeof products[number]}) {
 const [fav,setFav]=useState(false);
 return <article className="product-card"><div className="product-image"><b>{p[4]}</b><button className={fav?"fav active":"fav"} onClick={()=>setFav(!fav)}><Heart size={18} fill={fav?"currentColor":"none"}/></button><img src={p[7]} alt={p[0]}/></div><div className="product-info"><small>{p[1]}</small><h3>{p[0]}</h3><div className="rating"><Star size={14} fill="currentColor"/><strong>{p[5]}</strong><span>({p[6]})</span></div><del>{p[3]}</del><div className="price">{p[2]}</div><em>à vista no Pix</em><button className="offer">Ver oferta <ExternalLink size={15}/></button><span className="store">Disponível em {p[8]}</span></div></article>;
}

function LavadorasPage(){
 const [search,setSearch]=useState(""); const [sort,setSort]=useState("Mais relevantes"); const [menu,setMenu]=useState(false);
 const filtered=useMemo(()=>{const q=search.toLowerCase();let a=products.filter(p=>p[0].toLowerCase().includes(q)||p[1].toLowerCase().includes(q));if(sort==="Menor preço")a=[...a].sort((x,y)=>Number(x[2].replace(/\D/g,""))-Number(y[2].replace(/\D/g,"")));if(sort==="Maior desconto")a=[...a].sort((x,y)=>Number(y[4].replace(/\D/g,""))-Number(x[4].replace(/\D/g,"")));return a},[search,sort]);
 return <div className="site"><div className="top-strip">Ofertas atualizadas todos os dias · Compare preços antes de comprar</div>
 <header><div className="header-inner"><button className="mobile-menu" onClick={()=>setMenu(!menu)}><Menu/></button><a className="logo" href="/"><i>A</i><strong>Achadinhos<span>Brasil</span></strong></a><nav className={menu?"open":""}><a href="/">Início</a><a href="#ofertas">Ofertas</a><a href="#categorias">Categorias</a><a href="#guias">Guias</a></nav><div className="search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="O que você está procurando?"/></div></div></header>
 <section className="hero"><div className="container"><div className="crumb"><a href="/">Início</a><span>/</span>Lavadoras</div><div className="hero-row"><div><label><BadgePercent size={15}/> OFERTAS SELECIONADAS</label><h1>Lavadoras</h1><p>Encontre as melhores lavadoras e máquinas de lavar com preços, descontos e ofertas atualizadas.</p></div><aside><Truck size={22}/><div><b>Economize na compra</b><span>Compare ofertas de grandes lojas</span></div></aside></div></div></section>
 <section className="trust"><div className="container trust-grid"><div><ShieldCheck/><b>Ofertas verificadas<small>Links revisados</small></b></div><div><BadgePercent/><b>Descontos reais<small>Preço antigo x atual</small></b></div><div><Truck/><b>Lojas confiáveis<small>Grandes varejistas</small></b></div></div></section>
 <main className="container catalog" id="ofertas"><div className="section-head"><div><h2>Ofertas em lavadoras</h2><p>{filtered.length} produtos encontrados</p></div><div className="controls"><button className="filter"><SlidersHorizontal size={16}/> Filtros</button><select value={sort} onChange={e=>setSort(e.target.value)}><option>Mais relevantes</option><option>Menor preço</option><option>Maior desconto</option></select></div></div>
 <div className="pills" id="categorias">{["Todas","12kg","13kg ou mais","Consul","Electrolux","Brastemp"].map((x,i)=><button className={i===0?"selected":""} key={x}>{x}</button>)}</div>
 <div className="grid">{filtered.map(p=><Card key={p[0]} p={p}/>)}</div>
 <section className="guide" id="guias"><h2>Como escolher uma lavadora?</h2><p>Compare capacidade, programas de lavagem, consumo de água e energia, dimensões e recursos extras antes de comprar.</p><div><article><b>Famílias pequenas</b><span>Modelos de 8kg a 11kg costumam atender bem.</span></article><article><b>Famílias maiores</b><span>12kg ou mais oferecem espaço para peças grandes.</span></article><article><b>Compare antes de comprar</b><span>Confira preço, frete, prazo e condições na loja.</span></article></div></section></main>
 <footer><div className="container foot"><div><a className="logo" href="/"><i>A</i><strong>Achadinhos<span>Brasil</span></strong></a><p>Seleção de ofertas para ajudar você a comprar melhor.</p></div><div><b>Navegação</b><a href="#ofertas">Ofertas</a><a href="#categorias">Categorias</a></div><div><b>Informações</b><a href="/">Sobre nós</a><a href="/">Contato</a><a href="/">Privacidade</a></div></div><div className="copy">© 2026 Achadinhos Brasil · Preços podem mudar sem aviso.</div></footer></div>;
}