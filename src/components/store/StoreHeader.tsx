import { Link } from "@tanstack/react-router";
import { MoreHorizontal, ShoppingCart } from "lucide-react";

import { VerifiedBadge, isStoreVerified } from "@/components/store/VerifiedBadge";
import { useCartCount } from "@/lib/checkout-store";
import type { StoreSettings } from "@/lib/product-types";
import { useStoreFavicon } from "@/lib/store-favicon";
import { useMarkActiveStore } from "@/lib/pix-orders";
import storeLogoAsset from "@/assets/logo-loja-trim.png.asset.json";

export const DEFAULT_STORE_LOGO = storeLogoAsset.url;

/** Link para a página da loja: a principal fica em /loja, as demais em /loja/{endereço}. */
export function StoreHomeLink({ store, className, children }: { store: StoreSettings; className?: string; children: React.ReactNode }) {
  if (!store.slug || store.slug === "principal") return <Link to="/loja" className={className}>{children}</Link>;
  return <Link to="/loja/$slug" params={{ slug: store.slug }} className={className}>{children}</Link>;
}

export function StoreLogo({ store, className = "" }: { store: StoreSettings; className?: string }) {
  useStoreFavicon(store.favicon_url);
  return (
    <img
      src={store.logo_url || DEFAULT_STORE_LOGO}
      alt={store.name}
      draggable={false}
      className={`block h-8 w-auto max-w-[170px] object-contain object-left ${className}`}
    />
  );
}

export function StoreHeader({ store, placement = "product" }: { store: StoreSettings; placement?: "home" | "product" }) {
  useStoreFavicon(store.favicon_url);
  useMarkActiveStore(store.id || null);
  const cart = useCartCount();
  const showVerified = isStoreVerified(store);
  void placement;

  return (
    <header className="sticky top-0 z-30 border-b border-foreground/[0.08] bg-card/95 backdrop-blur">
      <div className="mx-auto grid h-12 max-w-[520px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4">
        <StoreHomeLink store={store} className="flex min-w-0 items-center gap-1.5">
          <StoreLogo store={store} />
          {showVerified && <VerifiedBadge size={17} />}
        </StoreHomeLink>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            to="/pagamento"
            preload="intent"
            aria-label="Carrinho"
            className="relative grid size-9 place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <ShoppingCart size={20} strokeWidth={1.8} />
            {cart > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">
                {cart}
              </span>
            )}
          </Link>
          <span aria-hidden className="grid size-9 place-items-center text-foreground">
            <MoreHorizontal size={22} strokeWidth={2.2} />
          </span>
        </div>
      </div>
    </header>
  );
}
