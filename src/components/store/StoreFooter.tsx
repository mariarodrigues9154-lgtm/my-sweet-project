import { Link } from "@tanstack/react-router";
import type { StoreSettings } from "@/lib/product-types";
import { DEFAULT_STORE_LOGO } from "./StoreHeader";

export function StoreFooter({ store }: { store: StoreSettings }) {
  const loja = store.slug && store.slug !== "principal" ? store.slug : undefined;
  return (
    <footer className="mt-2 bg-footer px-5 pb-24 pt-7 text-footer-foreground">
      {store.footer_logo_url ? (
        <img src={store.footer_logo_url} alt={store.name} loading="lazy" className="block h-12 w-auto max-w-[220px] object-contain object-left" />
      ) : (
        <img src={store.logo_url || DEFAULT_STORE_LOGO} alt={store.name} loading="lazy" className="block h-10 w-auto max-w-[200px] object-contain object-left brightness-0 invert" />
      )}
      <p className="mt-3 max-w-sm text-[12px] leading-relaxed text-footer-muted">{store.footer_text || store.tagline || "Compra protegida, atendimento seguro e entrega acompanhada do pedido até sua casa."}</p>
      <nav className="mt-6 grid gap-3 text-[12px] font-semibold sm:grid-cols-2">
        <Link to="/politica-de-privacidade" search={{ loja }}>Política de Privacidade</Link>
        <Link to="/politica-de-reembolso" search={{ loja }}>Política de Reembolso</Link>
        <Link to="/termos-de-uso" search={{ loja }}>Termos de Uso</Link>
        <Link to="/politica-de-entrega" search={{ loja }}>Política de Entrega</Link>
      </nav>
      <div className="mt-5 border-t border-footer-border pt-4 text-[11px] text-footer-muted">
        © {new Date().getFullYear()} {store.name}. Todos os direitos reservados.
      </div>
    </footer>
  );
}