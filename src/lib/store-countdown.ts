import { useEffect, useState } from "react";

/** Cronômetro único da loja: duração em store_settings.checkout.offer_countdown, prazo real salvo no navegador. */
export type OfferCountdownSettings = { hours?: number; minutes?: number };

export const DEFAULT_COUNTDOWN = { hours: 18, minutes: 9 };

export function resolveCountdownSeconds(checkout: unknown): number {
  const raw = (checkout && typeof checkout === "object" ? (checkout as { offer_countdown?: OfferCountdownSettings }).offer_countdown : null) ?? {};
  const h = Number.isFinite(Number(raw.hours)) && raw.hours !== undefined ? Math.min(99, Math.max(0, Math.floor(Number(raw.hours)))) : DEFAULT_COUNTDOWN.hours;
  const m = Number.isFinite(Number(raw.minutes)) && raw.minutes !== undefined ? Math.min(59, Math.max(0, Math.floor(Number(raw.minutes)))) : DEFAULT_COUNTDOWN.minutes;
  const total = h * 3600 + m * 60;
  return total > 0 ? total : DEFAULT_COUNTDOWN.hours * 3600 + DEFAULT_COUNTDOWN.minutes * 60;
}

/** Segundos restantes até o prazo salvo (now em ms). Ao zerar, um novo ciclo começa a partir do prazo antigo. */
export function remainingSeconds(deadline: number, duration: number, now: number): { left: number; deadline: number } {
  let end = deadline;
  if (!end || end - now > duration * 1000) end = now + duration * 1000;
  while (end <= now) end += duration * 1000;
  return { left: Math.ceil((end - now) / 1000), deadline: end };
}

type StoreLike = { id?: string | null; checkout?: unknown } | null | undefined;
export type CountdownProduct = { id?: string | null; sections?: unknown } | null | undefined;

/** Duração própria do produto (sections.coupon_promo.countdown_*), ou null para usar a da loja. */
export function productCountdownSeconds(product: CountdownProduct): number | null {
  const cp = (product?.sections && typeof product.sections === "object" ? (product.sections as { coupon_promo?: { countdown_hours?: number; countdown_minutes?: number } }).coupon_promo : null) ?? null;
  if (!cp || (cp.countdown_hours === undefined && cp.countdown_minutes === undefined)) return null;
  return resolveCountdownSeconds({ offer_countdown: { hours: cp.countdown_hours ?? 0, minutes: cp.countdown_minutes ?? 0 } });
}

/** Um único prazo por produto (quando ele tem duração própria) ou por loja; persistido no navegador. */
export function useStoreCountdown(store: StoreLike, product?: CountdownProduct): number {
  const own = productCountdownSeconds(product);
  const duration = own ?? resolveCountdownSeconds(store?.checkout);
  const scope = own !== null && product?.id ? `product:${product.id}` : `store:${store?.id || "default"}`;
  const [left, setLeft] = useState(duration);
  useEffect(() => {
    const key = `countdown:${scope}:${duration}`;
    const tick = () => {
      let saved = 0;
      try { saved = Number(window.localStorage.getItem(key)) || 0; } catch { /* sem storage */ }
      const r = remainingSeconds(saved, duration, Date.now());
      if (r.deadline !== saved) { try { window.localStorage.setItem(key, String(r.deadline)); } catch { /* ignore */ } }
      setLeft(r.left);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [scope, duration]);
  return left;
}
