import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Clock, Gift, ShieldCheck, Star, Truck } from "lucide-react";

import { brl } from "@/lib/format";
import type { ResolvedExitOffer } from "@/lib/exit-offer";

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/** Detecta tentativa de saída (mouse saindo pelo topo no computador, botão voltar no celular). */
export function useExitIntent(active: boolean, key: string) {
  const [open, setOpen] = useState(false);
  const leaving = useRef(false);
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const seenKey = `exit-offer:${key}`;
    if (sessionStorage.getItem(seenKey)) return;
    const trigger = () => {
      if (sessionStorage.getItem(seenKey)) return false;
      sessionStorage.setItem(seenKey, "1");
      setOpen(true);
      return true;
    };
    const onMouse = (e: MouseEvent) => { if (!e.relatedTarget && e.clientY <= 0) trigger(); };
    history.pushState({ exitOffer: true }, "");
    const onPop = () => {
      if (leaving.current) return;
      if (trigger()) history.pushState({ exitOffer: true }, "");
      else history.back();
    };
    document.addEventListener("mouseout", onMouse);
    window.addEventListener("popstate", onPop);
    return () => { document.removeEventListener("mouseout", onMouse); window.removeEventListener("popstate", onPop); };
  }, [active, key]);
  const decline = () => {
    setOpen(false);
    if (history.state?.exitOffer) { leaving.current = true; history.go(-2); }
  };
  return { open, close: () => setOpen(false), decline };
}

export type ExitOfferProduct = { name: string; image?: string | undefined; variant?: string | undefined; quantity: number; rating?: number | null | undefined; warranty?: string | null | undefined };

/** Prazo real da oferta: salvo na sessão para não reiniciar ao reabrir. */
function useOfferDeadline(key: string, minutes: number) {
  const [left, setLeft] = useState(minutes * 60);
  useEffect(() => {
    const k = `exit-offer-deadline:${key}`;
    let end = Number(sessionStorage.getItem(k));
    if (!end) { end = Date.now() + minutes * 60000; sessionStorage.setItem(k, String(end)); }
    const tick = () => setLeft(Math.max(0, Math.round((end - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [key, minutes]);
  return left;
}

export function ExitOfferPopup({ offer, oldPrice, newPrice, product, offerKey = "", onAccept, onDecline }: { offer: ResolvedExitOffer; oldPrice: number; newPrice: number; product?: ExitOfferProduct; offerKey?: string; onAccept: () => void; onDecline: () => void }) {
  const left = useOfferDeadline(offerKey, offer.timer_minutes);
  const timerText = offer.timer_text.includes("{MM:SS}") ? offer.timer_text.split("{MM:SS}") : [offer.timer_text + " ", ""];
  const decline = offer.decline_text.replace("{preco}", brl(oldPrice));
  const savings = Math.max(0, Number((oldPrice - newPrice).toFixed(2)));
  const benefits = [
    { icon: Truck, label: "Frete grátis", tone: "text-success" },
    { icon: ShieldCheck, label: "Pagamento seguro", tone: "text-foreground" },
    ...(product?.warranty ? [{ icon: BadgeCheck, label: "Garantia", tone: "text-foreground" }] : []),
  ];
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-foreground/60 p-3 backdrop-blur-[2px] animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-label={offer.title}>
      <div className="relative max-h-[calc(100dvh-24px)] w-full max-w-[380px] overflow-y-auto rounded-[24px] bg-card px-5 pb-4 pt-5 text-center shadow-[0_24px_60px_-24px_hsl(0_0%_0%/0.45)] animate-in fade-in zoom-in-95 duration-300 ease-out">
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-primary">
          <Gift size={12} strokeWidth={2.6} className="gift-swing" /> {offer.badge}
        </span>
        <h2 className="mt-3 text-[20px] font-extrabold leading-[1.2] text-foreground">{offer.title}</h2>
        <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">{offer.text}</p>

        {product && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-surface p-2.5 text-left">
            {product.image && <img src={product.image} alt={product.name} className="size-14 shrink-0 rounded-xl bg-card object-contain" />}
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-foreground">{product.name}</p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {product.variant ? `${product.variant} · ` : ""}Qtd: {product.quantity}
                {product.rating ? <span className="ml-1 inline-flex items-center gap-0.5 text-foreground"><Star size={10} className="fill-star text-star" />{product.rating.toFixed(1)}</span> : null}
              </p>
            </div>
          </div>
        )}

        <div className="mt-3">
          <p className="text-[13px] font-medium text-muted-foreground line-through tnum">{brl(oldPrice)}</p>
          <p className="text-[34px] font-extrabold leading-none tracking-tight text-primary tnum">{brl(newPrice)}</p>
          {savings > 0 && <span className="mt-2 inline-block rounded-full bg-success-soft px-2.5 py-0.5 text-[11.5px] font-bold text-success">Você economiza {brl(savings)}</span>}
        </div>

        {offer.timer_enabled && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11.5px] font-semibold text-primary">
            <Clock size={12} />
            <span>{timerText[0]}<strong className="tnum">{mmss(left)}</strong>{timerText[1]}</span>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-border pt-3">
          {benefits.map(({ icon: Icon, label, tone }) => (
            <span key={label} className={`inline-flex items-center gap-1 text-[11px] font-semibold ${tone}`}><Icon size={13} />{label}</span>
          ))}
        </div>

        <button type="button" onClick={onAccept} className="mt-4 w-full rounded-2xl bg-primary px-4 py-3.5 text-[15px] font-extrabold uppercase tracking-wide text-primary-foreground shadow-[0_10px_24px_-12px_var(--primary)] transition hover:brightness-110 active:scale-[0.98]">
          {offer.button_text}
        </button>
        <button type="button" onClick={onDecline} className="mt-2.5 w-full py-1 text-[12px] font-medium text-muted-foreground hover:text-foreground">{decline}</button>
      </div>
    </div>
  );
}
