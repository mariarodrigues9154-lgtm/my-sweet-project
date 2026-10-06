import { StoreHomeLink } from "@/components/store/StoreHeader";
import { MessageCircle, ShoppingCart, Store } from "lucide-react";
import type { Product, StoreSettings } from "@/lib/product-types";
import { brl } from "@/lib/format";

export function BuyBar({
  product,
  store,
  onAddToCart,
  onBuyNow,
  onChat,
  chatBadge = 0,
}: {
  product: Product;
  store: StoreSettings;
  onAddToCart: () => void;
  onBuyNow: () => void;
  onChat: () => void;
  chatBadge?: number;
}) {
  const s = product.shipping ?? {};
  const shippingText = s.free || !s.fee ? "Frete grátis" : `Frete ${brl(s.fee)}`;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card">
      <div className="mx-auto flex max-w-[520px] items-center gap-2 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <StoreHomeLink store={store} className="flex w-9 shrink-0 flex-col items-center gap-0.5 text-[11px] font-normal text-foreground/80">
          <Store size={20} strokeWidth={1.6} />
          Loja
        </StoreHomeLink>
        <button type="button" onClick={onChat} className="relative flex w-9 shrink-0 flex-col items-center gap-0.5 text-[11px] font-normal text-foreground/80">
          <MessageCircle size={20} strokeWidth={1.6} />
          {chatBadge > 0 && <span className="absolute -top-1 right-0 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">{chatBadge}</span>}
          Chat
        </button>
        <button
          type="button"
          onClick={onAddToCart}
          aria-label="Carrinho"
          className="ml-1 grid h-11 w-[60px] shrink-0 place-items-center rounded-full bg-primary-soft text-primary active:scale-[0.98]"
        >
          <ShoppingCart size={22} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          onClick={onBuyNow}
          className="flex h-11 min-w-0 flex-1 flex-col items-center justify-center rounded-full bg-primary px-3 leading-tight text-primary-foreground active:scale-[0.99]"
        >
          <span className="text-[15px] font-medium">Comprar agora</span>
          <span className="truncate text-[11px] font-normal opacity-95">
            {brl(product.price)} | {shippingText}
          </span>
        </button>
      </div>
    </div>
  );
}
