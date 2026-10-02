import { MessageCircle, ShieldCheck } from "lucide-react";
import { PixIcon, VerifiedBadge, isStoreVerified } from "@/components/store/VerifiedBadge";

import { Button } from "@/components/ui/button";
import type { StoreSettings } from "@/lib/product-types";
import { StoreLogo } from "@/components/store/StoreHeader";

export function CheckoutHeader({ store }: { store: StoreSettings }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card">
      <div className="mx-auto grid h-[52px] max-w-[520px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4">
        <div className="flex min-w-0 items-center gap-1.5">
          <StoreLogo store={{ ...store, logo_url: store.checkout?.logo_url || store.logo_url }} />
          {isStoreVerified(store) && <VerifiedBadge size={18} />}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-success">
          <ShieldCheck size={20} strokeWidth={1.9} className="shrink-0" />
          <span className="flex flex-col text-left text-[10.5px] font-extrabold uppercase leading-[1.15] tracking-[0.03em]">
            <span>Pagamento</span>
            <span>100% seguro</span>
          </span>
        </div>
      </div>
    </header>
  );
}

export function CheckoutFooter({ store, onChat }: { store: StoreSettings; onChat: () => void }) {
  return (
    <>
      <footer className="mx-auto max-w-[520px] px-4 pb-28 pt-7 text-center text-muted-foreground">
        <p className="text-[11px]">Formas de pagamento</p>
        <p className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-foreground"><PixIcon size={16} /> Pix</p>
        <p className="mt-5 flex items-center justify-center gap-1 text-[11px]">
          © {new Date().getFullYear()} {store.name}
          {isStoreVerified(store) && <VerifiedBadge size={13} />}
        </p>
        <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-[11px] shadow-card-soft">
          <ShieldCheck size={14} className="text-success" /> Ambiente seguro
        </span>
      </footer>
      <Button
        type="button"
        size="icon"
        aria-label="Abrir atendimento"
        onClick={onChat}
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-3 z-40 size-12 rounded-full bg-foreground text-background shadow-sheet-up hover:bg-foreground/90"
      >
        <MessageCircle size={22} />
        <span className="absolute right-1 top-1 size-2.5 rounded-full border-2 border-foreground bg-success" />
      </Button>
    </>
  );
}