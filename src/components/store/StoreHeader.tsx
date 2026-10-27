import { Link } from "@tanstack/react-router";
import { ArrowLeft, MoreHorizontal, Search, Share, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveProductHeader } from "@/lib/product-header";

import { VerifiedBadge, isStoreVerified } from "@/components/store/VerifiedBadge";
import { useCartCount } from "@/lib/checkout-store";
import type { Product, StoreSettings } from "@/lib/product-types";
import { useStoreFavicon } from "@/lib/store-favicon";
import { useMarkActiveStore } from "@/lib/pix-orders";
import { useUtmifyScripts } from "@/lib/utm-tracking";
import storeLogoAsset from "@/assets/logo-loja-trim.png.asset.json";

export const DEFAULT_STORE_LOGO = storeLogoAsset.url;

/** Link para a página da loja: a principal fica em /loja, as demais em /loja/{endereço}. */
export function StoreHomeLink({ store, className, children }: { store: StoreSettings; className?: string; children: React.ReactNode }) {
  if (!store.slug || store.slug === "principal") return <Link to="/loja" className={className}>{children}</Link>;
  return <Link to="/loja/$slug" params={{ slug: store.slug }} className={className}>{children}</Link>;
}

export function StoreLogo({ store, className = "" }: { store: StoreSettings; className?: string }) {
  useStoreFavicon(store.favicon_url);
  useUtmifyScripts(store.id || null);
  return (
    <img
      src={store.logo_url || DEFAULT_STORE_LOGO}
      alt={store.name}
      draggable={false}
      className={`block h-8 w-auto max-w-[170px] object-contain object-left ${className}`}
    />
  );
}

export function StoreHeader({ store, placement = "product", product }: { store: StoreSettings; placement?: "home" | "product"; product?: Product }) {
  useStoreFavicon(store.favicon_url);
  useUtmifyScripts(store.id || null);
  useMarkActiveStore(store.id || null);
  const cart = useCartCount();
  const showVerified = isStoreVerified(store);
  const special = product && placement === "product" ? resolveProductHeader(product, store) : null;

  if (special?.enabled) return (
    <header className="sticky top-0 z-30 border-b border-border bg-card" data-product-header="mobile">
      <div className="mx-auto flex h-12 max-w-[520px] items-center gap-1 px-2 sm:gap-2 sm:px-3">
        <Button asChild variant="ghost" size="icon" className="size-9 shrink-0 rounded-full [&_svg]:size-5">
          <StoreHomeLink store={store}>
            <ArrowLeft strokeWidth={1.8} />
            <span className="sr-only">Voltar para a loja</span>
          </StoreHomeLink>
        </Button>
        <div className="pointer-events-none flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-full bg-muted px-2.5 text-muted-foreground">
          <Search size={15} strokeWidth={1.8} className="shrink-0" aria-hidden="true" />
          <span className="truncate text-[12px]">{special.text}</span>
        </div>
        <div aria-hidden="true" className="pointer-events-none flex shrink-0 items-center text-foreground">
          <span className="grid size-8 place-items-center"><Share size={20} strokeWidth={1.8} /></span>
          <span className="grid size-8 place-items-center"><ShoppingCart size={20} strokeWidth={1.8} /></span>
          <span className="grid size-8 place-items-center"><MoreHorizontal size={22} /></span>
        </div>
      </div>
    </header>
  );

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
