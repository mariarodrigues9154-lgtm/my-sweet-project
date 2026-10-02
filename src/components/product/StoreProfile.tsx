import { VerifiedBadge, isStoreVerified } from "@/components/store/VerifiedBadge";
import { useEffect, useState } from "react";
import { Heart, MessageCircle } from "lucide-react";

import { intBR } from "@/lib/format";
import type { Product, StoreSettings } from "@/lib/product-types";
import { DEFAULT_STORE_LOGO, StoreHomeLink } from "@/components/store/StoreHeader";

export function StoreProfile({
  store,
  product,
  onMessage,
}: {
  store: StoreSettings;
  product: Product;
  onMessage: () => void;
}) {
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    setFollowing(window.localStorage.getItem("loja:following") === "1");
  }, []);

  const toggleFollow = () => {
    setFollowing((current) => {
      window.localStorage.setItem("loja:following", current ? "0" : "1");
      return !current;
    });
  };

  return (
    <section className="mt-2 bg-card px-4 py-4">
      <div className={`grid items-center gap-3 ${store.show_visit !== false ? "grid-cols-[auto_minmax(0,1fr)_auto]" : "grid-cols-[auto_minmax(0,1fr)]"}`}>
        <img src={store.avatar_url || store.logo_url || DEFAULT_STORE_LOGO} alt={store.name} className={`size-12 shrink-0 rounded-full border border-border ${store.avatar_url ? "bg-card object-cover" : "bg-black object-contain p-1"}`} />
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-1 truncate text-[14px] font-extrabold">
            <span className="truncate">{store.name}</span>{isStoreVerified(store) && <VerifiedBadge size={15} />}
          </p>
          <p className="truncate text-[12px] text-muted-foreground">{intBR(store.sold_count || product.sold_count)} vendido(s)</p>
        </div>
        {store.show_visit !== false && (store.visit_clickable !== false
          ? <StoreHomeLink store={store} className="shrink-0 rounded-full border border-border px-4 py-2 text-[12px] font-bold">Visitar</StoreHomeLink>
          : <span className="shrink-0 cursor-default select-none rounded-full border border-border px-4 py-2 text-[12px] font-bold">Visitar</span>)}
      </div>

      {(store.show_follow || store.show_message) && <div className={`mt-3 grid gap-2 ${store.show_follow && store.show_message ? "grid-cols-2" : "grid-cols-1"}`}>
        {store.show_follow && (
        <button type="button" onClick={toggleFollow} className={`inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[12.5px] font-bold ${following ? "bg-primary-soft text-primary" : "bg-primary text-primary-foreground"}`}>
          <Heart size={15} fill={following ? "currentColor" : "none"} /> {following ? "Seguindo" : "Seguir"}
        </button>
        )}
        {store.show_message && (
        <button type="button" onClick={onMessage} className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-4 py-2.5 text-[12.5px] font-bold">
          <MessageCircle size={15} /> Mensagem
        </button>
        )}
      </div>}
    </section>
  );
}