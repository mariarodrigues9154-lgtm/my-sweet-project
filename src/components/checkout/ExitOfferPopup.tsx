import { useEffect, useRef, useState } from "react";
import { Clock, Gift } from "lucide-react";

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

export function ExitOfferPopup({ offer, oldPrice, newPrice, onAccept, onDecline }: { offer: ResolvedExitOffer; oldPrice: number; newPrice: number; onAccept: () => void; onDecline: () => void }) {
  const [left, setLeft] = useState(offer.timer_minutes * 60);
  useEffect(() => {
    const t = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const aggressive = offer.style === "aggressive";
  const timerText = offer.timer_text.includes("{MM:SS}") ? offer.timer_text.split("{MM:SS}") : [offer.timer_text + " ", ""];
  const decline = offer.decline_text.replace("{preco}", brl(oldPrice));
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-foreground/55 p-3 animate-in fade-in" role="dialog" aria-modal="true" aria-label={offer.title}>
      <div className={`relative w-full max-w-[420px] rounded-[22px] bg-card px-5 pb-5 pt-6 text-center shadow-[0_24px_60px_-20px_hsl(0_0%_0%/0.5)] animate-in zoom-in-95 ${aggressive ? "border-[3px] border-accent" : "border border-border"}`}>
        <div className="flex items-center justify-center gap-2">
          <Gift size={46} strokeWidth={2.4} className="shrink-0 text-accent" />
          <span className="rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-accent">🔥 {offer.badge}</span>
        </div>
        <h2 className="mt-3 text-[21px] font-extrabold uppercase leading-[1.15] text-foreground sm:text-[23px]">
          {aggressive && "🚨 "}{offer.title}{aggressive && " 🚨"}
        </h2>
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted-foreground">{offer.text}</p>
        {offer.timer_enabled && (
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-1.5 text-[12px] font-bold text-destructive">
            <Clock size={13} />
            <span>{timerText[0]}<strong className="tnum">{mmss(left)}</strong>{timerText[1]}</span>
          </div>
        )}
        <div className="mt-4 rounded-2xl border-2 border-dashed border-accent/40 bg-accent/5 px-3 py-3.5">
          <p className="text-[13px] font-semibold text-muted-foreground line-through">De {brl(oldPrice)}</p>
          <p className="mt-0.5 flex items-baseline justify-center gap-2">
            <span className="text-[14px] font-bold text-muted-foreground">Por apenas</span>
            <strong className="text-[32px] font-extrabold leading-none text-accent tnum">{brl(newPrice)}</strong>
          </p>
        </div>
        <button type="button" onClick={onAccept} className="mt-4 w-full rounded-xl bg-accent px-4 py-4 text-[15px] font-extrabold uppercase leading-snug text-accent-foreground shadow-[0_10px_24px_-10px_var(--accent)] transition active:scale-[0.98]">
          ✅ {offer.button_text}
        </button>
        <button type="button" onClick={onDecline} className="mt-3 text-[11.5px] font-semibold text-muted-foreground underline underline-offset-2">{decline}</button>
      </div>
    </div>
  );
}
