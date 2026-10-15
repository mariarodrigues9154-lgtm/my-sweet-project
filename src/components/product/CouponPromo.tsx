import { useEffect, useState, type CSSProperties } from "react";
import { ChevronRight, Ticket, TicketPercent, X } from "lucide-react";

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
  return (
    <div style={styleOf(cfg)} className="flex min-h-11 items-center gap-2 border-y border-primary/20 bg-primary-soft px-3 py-2 text-[13px] leading-snug text-foreground">
      <TicketPercent size={17} className="shrink-0 text-primary" style={accentOf(cfg)} />
      <span className="min-w-0 flex-1">{fillCouponText(cfg.bar_text, cfg)}</span>
      {cfg.show_timer && timer && <strong className="shrink-0 font-bold text-primary tnum" style={accentOf(cfg)}>{timer}</strong>}
      {cfg.show_close && (
        <button type="button" onClick={onClose} aria-label="Fechar aviso" className="-mr-1 grid size-7 shrink-0 place-items-center rounded-full opacity-70 hover:opacity-100">
          <X size={15} />
        </button>
      )}
    </div>
  );
}

export function CouponChip({ store }: { store: StoreLike }) {
  const cfg = resolveCouponPromo(store?.checkout);
  if (!cfg.chip_enabled) return null;
  return <div className="bg-card px-3 pt-2.5"><CouponChipView cfg={cfg} /></div>;
}

export function CouponBar({ store }: { store: StoreLike }) {
  const cfg = resolveCouponPromo(store?.checkout);
  const key = `coupon-bar-closed:${store?.id || "default"}`;
  const [closed, setClosed] = useState(false);
  useEffect(() => { try { setClosed(sessionStorage.getItem(key) === "1"); } catch { /* ignore */ } }, [key]);
  if (!cfg.bar_enabled || closed) return null;
  return (
    <CouponBarView
      cfg={cfg}
      timer={<Countdown store={store} />}
      onClose={() => { setClosed(true); try { sessionStorage.setItem(key, "1"); } catch { /* ignore */ } }}
    />
  );
}
