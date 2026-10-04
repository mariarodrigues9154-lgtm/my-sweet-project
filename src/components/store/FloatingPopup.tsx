import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, X } from "lucide-react";

import { Stars } from "@/components/store/Stars";

import { getRecentPurchases, type RealPurchase } from "@/lib/popups.functions";
import { brl } from "@/lib/format";
import {
  fillPopupText,
  popupEnabledFor,
  popupMatchesProduct,
  resolvePopupSettings,
  truncateText,
  type Product,
  type ResolvedPopupSettings,
  type StoreSettings,
} from "@/lib/product-types";

export type PopupCard = { key: string; image: string | null; title: string; message: string; secondary: string; badge: string; rating?: number; initials?: string };

type Ctx = { storeName: string; product: (Pick<Product, "id" | "name" | "price"> & { reviews?: Product["reviews"] }) | null; products: Array<{ id: string; name: string; price?: number }> };

/** Monta os cartões a partir das configurações e das compras reais. */
export function buildPopupCards(s: ResolvedPopupSettings, ctx: Ctx, purchases: RealPurchase[]): PopupCard[] {
  const cards: PopupCard[] = [];
  const useManual = s.source === "manual" || s.source === "both" || s.source === "manual_reviews";
  const useReviews = s.source === "reviews" || s.source === "manual_reviews";
  const useReal = s.source === "real" || s.source === "both";
  if (useManual) {
    for (const item of s.items) {
      if (!popupMatchesProduct(item, ctx.product?.id ?? null)) continue;
      const linked = item.use_current_product && ctx.product
        ? ctx.product
        : ctx.products.find((p) => p.id === item.product_id) ?? (item.product_id && item.product_name ? { id: item.product_id, name: item.product_name } : null);
      const vars = { produto: linked?.name, loja: ctx.storeName, preco: linked && "price" in linked && linked.price != null ? brl(Number(linked.price)) : "", cidade: item.location, nome: item.name };
      const head = [item.name?.trim(), item.location?.trim()].filter(Boolean).join(" — ");
      const title = fillPopupText(item.title, vars) || head;
      const message = fillPopupText(item.message, vars);
      if (!title && !message) continue;
      cards.push({ key: item.id, image: item.image || null, title, message, secondary: fillPopupText(item.secondary, vars), badge: "" });
    }
  }
  if (useReviews && ctx.product) {
    const list = (ctx.product.reviews ?? []).filter((r) => r && !r.hidden && (r.text?.trim() || r.name?.trim()) && (!s.review_confirmed_only || r.confirmed));
    for (const [i, r] of list.slice(0, 30).entries()) {
      const city = s.review_show_location ? ((s.review_use_order_location && r.order_city) || r.city || "").trim() : "";
      const state = s.review_show_location ? ((s.review_use_order_location && r.order_state) || r.state || "").trim() : "";
      const nota = Number(r.rating) > 0 ? String(Math.round(Number(r.rating))) : "";
      const vars = { nome: r.name?.trim(), produto: ctx.product.name, loja: ctx.storeName, nota, avaliacao: truncateText(r.text ?? "", s.review_max_chars), cidade: city, estado: state, data: r.date?.trim(), preco: "" };
      const title = fillPopupText(s.review_title, vars);
      const message = fillPopupText(s.review_message, vars);
      if (!title && !message) continue;
      const loc = [city, state].filter(Boolean).join(", ");
      const initials = (r.name ?? "").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
      cards.push({ key: `rev-${i}`, image: r.avatar || null, title, message, secondary: [fillPopupText(s.review_secondary, vars), loc].filter(Boolean).join(" · "), badge: r.confirmed ? "Compra confirmada" : "", rating: Number(r.rating) > 0 ? Number(r.rating) : undefined, initials: initials || "?" });
    }
  }
  if (useReal) {
    for (const [i, p] of purchases.entries()) {
      const vars = { produto: p.product, loja: ctx.storeName, preco: "", cidade: p.city, nome: p.name };
      cards.push({ key: `real-${i}`, image: p.image, title: fillPopupText(s.real_title, vars), message: fillPopupText(s.real_message, vars), secondary: timeAgo(p.paid_at), badge: s.real_badge });
    }
  }
  return cards;
}

function timeAgo(iso: string): string {
  const min = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `há ${min} minuto${min > 1 ? "s" : ""}`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} hora${h > 1 ? "s" : ""}`;
  const d = Math.round(h / 24);
  return `há ${d} dia${d > 1 ? "s" : ""}`;
}

const POS: Record<ResolvedPopupSettings["position"], string> = {
  "bottom-left": "left-3 bottom-[84px]",
  "bottom-right": "right-3 bottom-[84px]",
  "top-left": "left-3 top-[72px]",
  "top-right": "right-3 top-[72px]",
};

/** Cartão visual — usado na loja e na prévia do painel. */
export function PopupCardView({ card, shown, settings, onClose, className = "" }: { card: PopupCard; shown: boolean; settings: ResolvedPopupSettings; onClose?: () => void; className?: string }) {
  const fromBottom = settings.position.startsWith("bottom");
  const anim = settings.animation;
  const hidden =
    anim === "none" ? "hidden" : anim === "fade" ? "opacity-0" : anim === "slide" ? (fromBottom ? "translate-y-6" : "-translate-y-6") : `opacity-0 ${fromBottom ? "translate-y-6" : "-translate-y-6"}`;
  return (
    <div
      role="status"
      className={`pointer-events-auto relative flex w-[min(290px,calc(100vw-24px))] items-center gap-2.5 rounded-xl bg-card p-2.5 pr-7 shadow-[0_6px_24px_-6px_hsl(0_0%_0%/0.25)] ring-1 ring-border transition-all duration-500 ease-out ${shown ? "translate-y-0 opacity-100" : hidden} ${className}`}
    >
      {card.image ? (
        <img src={card.image} alt="" loading="lazy" className="size-10 shrink-0 rounded-full object-cover" onError={(e) => { const el = e.currentTarget; if (card.initials) { el.replaceWith(Object.assign(document.createElement("div"), { className: "grid size-10 shrink-0 place-items-center rounded-full bg-muted text-[12px] font-bold text-muted-foreground", textContent: card.initials })); } else el.style.display = "none"; }} />
      ) : card.initials ? (
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-[12px] font-bold text-muted-foreground">{card.initials}</div>
      ) : null}
      <div className="min-w-0 flex-1 leading-tight">
        {card.title && <p className="truncate text-[12px] font-extrabold text-foreground">{card.title}</p>}
        {card.rating != null && <Stars rating={card.rating} size={11} />}
        {card.message && <p className="line-clamp-2 text-[11px] text-muted-foreground">{card.message}</p>}
        {(card.badge || card.secondary) && (
          <div className="mt-0.5 flex items-center gap-1.5">
            {card.badge && <span className="inline-flex items-center gap-0.5 rounded bg-success px-1 py-px text-[9.5px] font-bold text-success-foreground"><BadgeCheck size={10} />{card.badge}</span>}
            {card.secondary && <span className="truncate text-[10px] text-muted-foreground">{card.secondary}</span>}
          </div>
        )}
      </div>
      {settings.show_close && onClose && (
        <button type="button" aria-label="Fechar" onClick={onClose} className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-surface">
          <X size={12} />
        </button>
      )}
    </div>
  );
}

/** Popup flutuante da loja: carrega uma vez e gira as notificações no navegador. */
export function FloatingPopup({ store, product, products = [] }: { store: StoreSettings; product: Product | null; products?: Array<{ id: string; name: string; price?: number }> }) {
  const settings = useMemo(() => resolvePopupSettings(store.checkout?.popups), [store.checkout?.popups]);
  const enabled = popupEnabledFor(settings, product?.sections?.popup_mode);
  const fetchReal = useServerFn(getRecentPurchases);
  const [purchases, setPurchases] = useState<RealPurchase[]>([]);
  const [current, setCurrent] = useState<PopupCard | null>(null);
  const [shown, setShown] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!enabled || !(settings.source === "real" || settings.source === "both") || !store.id) return;
    let alive = true;
    const t = setTimeout(() => void fetchReal({ data: { storeId: store.id } }).then((r) => alive && setPurchases(r)).catch(() => {}), 1500);
    return () => { alive = false; clearTimeout(t); };
  }, [enabled, settings.source, store.id, fetchReal]);

  const allProducts = useMemo(() => (product ? [{ id: product.id, name: product.name, price: product.price }, ...products] : products), [product, products]);
  const cards = useMemo(
    () => (enabled ? buildPopupCards(settings, { storeName: store.name, product, products: allProducts }, purchases) : []),
    [enabled, settings, store.name, product, allProducts, purchases],
  );

  useEffect(() => {
    const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
    clear();
    setShown(false);
    setCurrent(null);
    if (!cards.length) return;
    let index = 0;
    const order = settings.order === "random" ? [...cards].sort(() => Math.random() - 0.5) : cards;
    const showNext = () => {
      const card = order[index % order.length]!;
      index++;
      setCurrent(card);
      timers.current.push(setTimeout(() => setShown(true), 30));
      timers.current.push(setTimeout(() => setShown(false), settings.visible * 1000));
      timers.current.push(setTimeout(showNext, (settings.visible + settings.interval) * 1000));
    };
    timers.current.push(setTimeout(showNext, settings.delay * 1000));
    return clear;
  }, [cards, settings.order, settings.visible, settings.interval, settings.delay]);

  if (!enabled || !current) return null;
  return (
    <div className={`pointer-events-none fixed z-40 ${POS[settings.position]}`}>
      <PopupCardView card={current} shown={shown} settings={settings} onClose={() => setShown(false)} />
    </div>
  );
}
