import { VerifiedBadge, isStoreVerified } from "@/components/store/VerifiedBadge";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { brl, intBR } from "@/lib/format";
import type { Product, StoreSettings } from "@/lib/product-types";
import { StoreChat } from "./StoreChat";
import { StoreFooter } from "./StoreFooter";
import { DEFAULT_STORE_LOGO, StoreHeader } from "./StoreHeader";

type StoreProduct = Pick<Product, "id" | "slug" | "name" | "title" | "subtitle" | "price" | "previous_price" | "media" | "shipping" | "sold_count" | "sort_order">;

export function StoreHub({ store, products }: { store: StoreSettings; products: StoreProduct[] }) {
  const [tab, setTab] = useState<"home" | "products">("home");
  const [following, setFollowing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  useEffect(() => setFollowing(window.localStorage.getItem("loja:following") === "1"), []);

  const featured = useMemo(() => {
    const selected = store.featured_product_ids
      .map((id) => products.find((product) => product.id === id))
      .filter((product): product is StoreProduct => Boolean(product));
    return selected.length ? selected : [...products].sort((a, b) => b.sold_count - a.sold_count).slice(0, 4);
  }, [products, store.featured_product_ids]);
  const firstImage = products.flatMap((product) => product.media).find((media) => media.type === "image")?.url;
  const cover = store.cover_url || firstImage;
  const banner = store.banner_url || firstImage;
  const sold = store.sold_count || products.reduce((sum, product) => sum + product.sold_count, 0);

  const toggleFollow = () => {
    setFollowing((current) => {
      window.localStorage.setItem("loja:following", current ? "0" : "1");
      return !current;
    });
  };

  return (
    <div className="min-h-screen bg-surface">
      <StoreHeader store={store} placement="home" />
      <main className="mx-auto max-w-[520px] overflow-hidden bg-card">
        {cover && <img src={cover} alt={`Capa da ${store.name}`} className="aspect-[2.1/1] w-full object-cover" />}

        <section className={`relative z-10 mx-4 rounded-2xl bg-card p-4 shadow-card-soft ${cover ? "-mt-14" : "mt-4"}`}>
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
            <img src={store.avatar_url || store.logo_url || DEFAULT_STORE_LOGO} alt={store.name} className="size-14 shrink-0 rounded-full border border-border bg-card object-contain p-1" />
            <div className="min-w-0">
              <h1 className="flex min-w-0 items-center gap-1 text-[15px] font-extrabold"><span className="truncate">{store.name}</span>{isStoreVerified(store) && <VerifiedBadge size={16} />}</h1>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{intBR(sold)} vendido(s)</p>
            </div>
            <div className="grid shrink-0 gap-2">
              {store.show_follow && <Button size="sm" className="h-9 min-w-28 rounded-full font-extrabold" variant={following ? "secondary" : "default"} onClick={toggleFollow}><Heart size={14} fill={following ? "currentColor" : "none"} />{following ? "Seguindo" : "Seguir"}</Button>}
              {store.show_message && <Button size="sm" variant="outline" className="h-9 min-w-28 rounded-full font-extrabold" onClick={() => setChatOpen(true)}><MessageCircle size={14} />Mensagem</Button>}
            </div>
          </div>
          {store.tagline && <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">{store.tagline}</p>}
        </section>

        <div className="mt-4 grid grid-cols-2 border-b border-border px-4" role="tablist" aria-label="Seções da loja">
          <button type="button" role="tab" aria-selected={tab === "home"} onClick={() => setTab("home")} className={`relative py-3 text-[14px] font-bold ${tab === "home" ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-foreground" : "text-muted-foreground"}`}>Página inicial</button>
          <button type="button" role="tab" aria-selected={tab === "products"} onClick={() => setTab("products")} className={`relative py-3 text-[14px] font-bold ${tab === "products" ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-foreground" : "text-muted-foreground"}`}>Produtos</button>
        </div>

        {tab === "home" ? (
          <div className="px-4 py-4">
            {banner && (store.banner_link ? <a href={store.banner_link}><img src={banner} alt="Destaque da loja" loading="lazy" className="aspect-[2.35/1] w-full rounded-xl object-cover" /></a> : <img src={banner} alt="Destaque da loja" loading="lazy" className="aspect-[2.35/1] w-full rounded-xl object-cover" />)}
            {store.indicators.some((item) => item.value || item.label) && <div className="mt-3 grid grid-cols-3 gap-2">{store.indicators.slice(0, 3).map((item, index) => <div key={`${item.label}-${index}`} className="min-w-0 rounded-lg border border-border bg-surface px-2 py-3 text-center"><p className="truncate text-[14px] font-extrabold">{item.value || "—"}</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{item.label}</p></div>)}</div>}
            <h2 className="mb-2 mt-4 text-[15px] font-extrabold">Mais vendidos da loja</h2>
            <ProductGrid products={featured} />
          </div>
        ) : (
          <div className="px-4 py-4"><h2 className="mb-3 text-[15px] font-extrabold">Todos os produtos</h2><ProductGrid products={products} /></div>
        )}
        <StoreFooter store={store} />
      </main>
      <StoreChat store={store} open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}

function ProductGrid({ products }: { products: StoreProduct[] }) {
  if (!products.length) return <p className="py-8 text-center text-[13px] text-muted-foreground">Nenhum produto disponível.</p>;
  return <div className="grid grid-cols-2 gap-2.5">{products.map((product) => {
    const image = product.media.find((item) => item.type === "image");
    const freeShipping = product.shipping.free || product.shipping.fee === 0;
    return <Link key={product.id} to="/produto/$slug" params={{ slug: product.slug }} className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <div className="aspect-square bg-surface">{image ? <img src={image.url} alt={image.alt || product.name} loading="lazy" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-[11px] text-muted-foreground">Sem imagem</div>}</div>
      <div className="p-2.5">
        <h3 className="line-clamp-2 min-h-9 text-[12px] font-bold leading-[18px]">{product.title}</h3>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5"><strong className="text-[16px] text-primary tnum">{brl(product.price)}</strong>{product.previous_price > product.price && <span className="text-[10px] text-muted-foreground line-through tnum">{brl(product.previous_price)}</span>}</div>
        {product.subtitle && <p className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">{product.subtitle}</p>}
        {freeShipping && <p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-success"><Truck size={11} /> Frete grátis</p>}
      </div>
    </Link>;
  })}</div>;
}