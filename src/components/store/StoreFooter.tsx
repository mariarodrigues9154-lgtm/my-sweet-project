import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import type { StoreSettings } from "@/lib/product-types";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DEFAULT_STORE_LOGO } from "./StoreHeader";

export function StoreFooter({ store }: { store: StoreSettings }) {
  const [privacyOpen, setPrivacyOpen] = useState(false);
  if (store.show_footer === false) return null;
  const loja = store.slug && store.slug !== "principal" ? store.slug : undefined;
  const privacyContent = store.policies?.privacy;
  return (
    <footer className="mt-2 bg-footer px-5 pb-24 pt-7 text-footer-foreground">
      {store.footer_logo_url ? (
        <img src={store.footer_logo_url} alt={store.name} loading="lazy" className="block h-12 w-auto max-w-[220px] object-contain object-left" />
      ) : (
        <img src={store.logo_url || DEFAULT_STORE_LOGO} alt={store.name} loading="lazy" className="block h-10 w-auto max-w-[200px] object-contain object-left brightness-0 invert" />
      )}
      <p className="mt-3 max-w-sm text-[12px] leading-relaxed text-footer-muted">{store.footer_text || store.tagline || "Compra protegida, atendimento seguro e entrega acompanhada do pedido até sua casa."}</p>
      <nav className="mt-6 grid gap-3 text-[12px] font-semibold sm:grid-cols-2">
        <button type="button" onClick={() => setPrivacyOpen(true)} className="text-left">Política de Privacidade</button>
        <Link to="/politica-de-reembolso" search={{ loja }}>Política de Reembolso</Link>
        <Link to="/termos-de-uso" search={{ loja }}>Termos de Uso</Link>
        <Link to="/politica-de-entrega" search={{ loja }}>Política de Entrega</Link>
      </nav>
      <div className="mt-5 border-t border-footer-border pt-4 text-[11px] text-footer-muted">
        © {new Date().getFullYear()} {store.name}. Todos os direitos reservados.
      </div>
      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent
          className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-[520px] flex-col gap-0 overflow-hidden rounded-xl bg-card p-0 [&>button]:hidden"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <DialogTitle className="text-[16px] font-extrabold text-foreground">Política de Privacidade</DialogTitle>
            <button
              type="button"
              onClick={() => setPrivacyOpen(false)}
              aria-label="Fechar"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-5">
            {privacyContent ? (
              <p className="whitespace-pre-wrap text-[13px] leading-6 text-muted-foreground">{privacyContent}</p>
            ) : (
              <p className="text-[13px] text-muted-foreground">Conteúdo ainda não informado pela loja.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </footer>
  );
}
