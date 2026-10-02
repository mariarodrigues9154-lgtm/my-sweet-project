/**
 * Camada compartilhada de rastreamento Meta Pixel (navegador).
 * Cada evento vai só para o Pixel da loja (trackSingle), com event_id para
 * deduplicar com a Conversions API e trava local contra repetição.
 */
import { useEffect } from "react";

import { getStorePixel } from "./meta.functions";

type PixelConfig = { pixel_id: string; track_pending: boolean } | null;
type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue: unknown[]; loaded?: boolean; version?: string; push?: unknown };

const configs = new Map<string, Promise<PixelConfig>>();
const inited = new Set<string>();

function loadConfig(storeId: string) {
  let hit = configs.get(storeId);
  if (!hit) {
    hit = getStorePixel({ data: { store_id: storeId } }).catch(() => null);
    configs.set(storeId, hit);
  }
  return hit;
}

function fbq(): Fbq | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { fbq?: Fbq; _fbq?: Fbq };
  if (!w.fbq) {
    const n = function (...args: unknown[]) { if (n.callMethod) n.callMethod(...args); else n.queue.push(args); } as Fbq;
    n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
    w.fbq = n; w._fbq = n;
    const s = document.createElement("script");
    s.async = true; s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
  }
  return w.fbq;
}

function onceKey(key: string) { return `meta:sent:${key}`; }

export async function trackMeta(
  storeId: string | null | undefined,
  event: string,
  params: Record<string, unknown> = {},
  options: { eventId?: string; once?: string; custom?: boolean; pendingOnly?: boolean } = {},
) {
  if (!storeId || typeof window === "undefined") return;
  const config = await loadConfig(storeId);
  if (!config) return;
  if (options.pendingOnly && !config.track_pending) return;
  if (options.once) {
    const key = onceKey(`${config.pixel_id}:${options.once}`);
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, String(Date.now()));
  }
  const f = fbq();
  if (!f) return;
  if (!inited.has(config.pixel_id)) { f("init", config.pixel_id); inited.add(config.pixel_id); }
  const eventId = options.eventId ?? `${event}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  f(options.custom ? "trackSingleCustom" : "trackSingle", config.pixel_id, event, { ...("value" in params ? { currency: "BRL" } : {}), ...params }, { eventID: eventId });
}

/** PageView uma vez por montagem da página, apenas no Pixel da loja. */
export function useMetaPageView(storeId: string | null | undefined, extra?: () => void) {
  useEffect(() => {
    if (!storeId) return;
    void trackMeta(storeId, "PageView", {}).then(() => extra?.());
  }, [storeId]); // eslint-disable-line react-hooks/exhaustive-deps
}

type ProductLike = { id: string; title: string; price: number };

export function trackViewContent(storeId: string | null | undefined, product: ProductLike) {
  return trackMeta(storeId, "ViewContent", { content_ids: [product.id], content_name: product.title, content_type: "product", value: product.price });
}
export function trackAddToCart(storeId: string | null | undefined, product: ProductLike, quantity: number) {
  return trackMeta(storeId, "AddToCart", { content_ids: [product.id], content_name: product.title, content_type: "product", value: Number((product.price * quantity).toFixed(2)), quantity, contents: [{ id: product.id, quantity }] });
}
export function trackInitiateCheckout(storeId: string | null | undefined, product: ProductLike, quantity: number) {
  return trackMeta(storeId, "InitiateCheckout", { content_ids: [product.id], content_type: "product", num_items: quantity, value: Number((product.price * quantity).toFixed(2)), contents: [{ id: product.id, quantity }] });
}
export function trackAddPaymentInfo(storeId: string | null | undefined, product: ProductLike, quantity: number, total: number) {
  return trackMeta(storeId, "AddPaymentInfo", { content_ids: [product.id], content_type: "product", num_items: quantity, value: total, payment_method: "pix" });
}
/** PIX gerado (ainda não pago): evento personalizado, nunca Purchase. */
export function trackPaymentPending(storeId: string | null | undefined, orderNumber: string, total: number, productId: string | null | undefined) {
  return trackMeta(storeId, "PaymentPending", { order_id: orderNumber, value: total, content_ids: productId ? [productId] : [], payment_method: "pix" }, { custom: true, once: `pending_${orderNumber}`, eventId: `pending_${orderNumber}`, pendingOnly: true });
}
/** Purchase só na tela de pedido pago; mesmo event_id da Conversions API. */
export function trackPurchase(storeId: string | null | undefined, order: { order_number: string; total: number; quantity: number; unit_price: number; product_id?: string | null }) {
  const id = order.product_id ?? order.order_number;
  return trackMeta(storeId, "Purchase", { value: order.total, content_type: "product", content_ids: [id], contents: [{ id, quantity: order.quantity, item_price: order.unit_price }], num_items: order.quantity, order_id: order.order_number }, { once: `purchase_${order.order_number}`, eventId: `purchase_${order.order_number}` });
}
