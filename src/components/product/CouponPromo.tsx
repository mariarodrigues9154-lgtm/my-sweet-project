import { useEffect, useState, type CSSProperties } from "react";
import { ChevronRight, Ticket, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/product/OfferBlock";
import { fillCouponText, resolveCouponPromo, type ResolvedCouponPromo } from "@/lib/coupon-promo";

type StoreLike = { id?: string | null; checkout?: unknown } | null | undefined;

const styleOf = (c: ResolvedCouponPromo): CSSProperties => ({
  ...(c.bg_color ? { backgroundColor: c.bg_color } : {}),
  ...(c.text_color ? { color: c.text_color } : {}),
  ...(c.border_color ? { borderColor: c.border_color } : {}),
});
const accentOf = (c: ResolvedCouponPromo): CSSProperties => (c.accent_color ? { color: c.accent_color } : {});

/** Visual do chip (usado no site e na prévia do painel). */
export function CouponChipView({ cfg }: { cfg: ResolvedCouponPromo }) {
  return (
    <span style={styleOf(cfg)} className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-primary/60 bg-primary-soft px-2 py-1 text-[13px] font-semibold leading-tight text-primary">
      <Ticket size={14} className="shrink-0" style={accentOf(cfg)} />
      <span className="min-w-0 truncate">{fillCouponText(cfg.chip_text, cfg)}</span>
      {cfg.show_arrow && <ChevronRight size={14} className="shrink-0 opacity-80" />}
    </span>
  );
}

/** Visual da barra (usado no site e na prévia do painel). */
export function CouponBarView({ cfg, timer, onClose }: { cfg: ResolvedCouponPromo; timer?: React.ReactNode; onClose?: () => void }) {
  const highlighted = fillCouponText(cfg.highlight_text, cfg);
  const secondary = fillCouponText(cfg.secondary_text, cfg);
  return (
    <div style={styleOf(cfg)} className="grid min-h-11 grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2 border-y border-primary/10 bg-primary-soft px-3 py-1.5 text-[12px] leading-[15px] text-muted-foreground">
      <Ticket size={18} fill="currentColor" strokeWidth={1.5} aria-hidden="true" className="shrink-0 -rotate-35 text-primary" style={accentOf(cfg)} />
      <span className="min-w-0 break-words [overflow-wrap:anywhere]">
        {highlighted && <strong className="font-bold text-primary" style={accentOf(cfg)}>{highlighted}</strong>}
        {highlighted && secondary ? " " : ""}{secondary}
      </span>
      <div className="flex shrink-0 items-center gap-0.5">
      {cfg.show_timer && timer && <strong className="whitespace-nowrap font-bold text-primary tnum" style={accentOf(cfg)}>{timer}</strong>}
      {cfg.show_close && (
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Fechar aviso" title="Fechar aviso" className="-mr-1 size-7 shrink-0 rounded-full text-muted-foreground/70 hover:bg-primary/10 hover:text-muted-foreground [&_svg]:size-3.5">
          <X />
        </Button>
      )}
      </div>
    </div>
  );
}

type ProductLike = { id?: string | null; sections?: unknown };

export function CouponChip({ product }: { product: ProductLike }) {
  const cfg = resolveCouponPromo(product.sections);
  if (!cfg.chip_enabled) return null;
  return <div className="bg-card px-3 pt-2.5"><CouponChipView cfg={cfg} /></div>;
}

export function CouponBar({ store, product }: { store: StoreLike; product: ProductLike }) {
  const cfg = resolveCouponPromo(product.sections);
  const key = `coupon-bar-closed:${product.id || "default"}`;
  const [closed, setClosed] = useState(false);
  useEffect(() => { try { setClosed(sessionStorage.getItem(key) === "1"); } catch { /* ignore */ } }, [key]);
  if (!cfg.bar_enabled || closed) return null;
  return (
    <CouponBarView
      cfg={cfg}
      timer={<Countdown store={store} product={product} />}
      onClose={() => { setClosed(true); try { sessionStorage.setItem(key, "1"); } catch { /* ignore */ } }}
    />
  );
}
