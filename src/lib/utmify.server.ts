/**
 * Envio de vendas para a UTMify (docs.utmify.com.br/envio-de-vendas).
 * O token da API fica só no servidor e nunca é registrado em logs.
 */
const ENDPOINT = "https://api.utmify.com.br/api-credentials/orders";

export type UtmifyRow = {
  enabled: boolean;
  api_token: string | null;
  utm_script_enabled: boolean;
  utm_script_src: string | null;
  pixel_enabled: boolean;
  pixel_id: string | null;
  pixel_script_src: string | null;
};

export const TRACKING_KEYS = ["src", "sck", "utm_source", "utm_campaign", "utm_medium", "utm_content", "utm_term"] as const;

export async function loadUtmifySettings(storeId: string): Promise<UtmifyRow | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("store_utmify_settings")
    .select("enabled, api_token, utm_script_enabled, utm_script_src, pixel_enabled, pixel_id, pixel_script_src")
    .eq("store_id", storeId)
    .maybeSingle();
  return (data as UtmifyRow | null) ?? null;
}

/** "YYYY-MM-DD HH:MM:SS" em UTC 0, como exige a API. */
export function utcStamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace("T", " ");
}

async function logUtmify(entry: { store_id: string; order_number?: string | null; status: string; ok: boolean; http_status?: number | null; error?: string | null; test_mode?: boolean }) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("utmify_logs").insert({ ...entry, error: entry.error?.slice(0, 500) ?? null } as never);
  } catch { /* histórico nunca bloqueia */ }
}

export async function postUtmify(token: string, body: Record<string, unknown>): Promise<{ ok: boolean; status: number; error?: string }> {
  let last: { ok: boolean; status: number; error?: string } = { ok: false, status: 0, error: "Sem resposta" };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", "x-api-token": token }, body: JSON.stringify(body) });
      if (res.ok) return { ok: true, status: res.status };
      last = { ok: false, status: res.status, error: (await res.text()).slice(0, 400) };
      if (res.status < 500 && res.status !== 429) return last; // erro definitivo: não repete
    } catch {
      last = { ok: false, status: 0, error: "Falha de conexão com a UTMify." };
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
  }
  return last;
}

type OrderRow = {
  id: string; order_number: string; store_id: string | null; status: string; created_at: string; paid_at: string | null;
  payment_method: string | null; transaction_id: string | null; product_id: string | null; quantity: number; unit_price: number; total: number;
  customer: Record<string, string> | null; product_snapshot: Record<string, unknown> | null; meta_attribution: Record<string, string> | null;
  tracking_params: Record<string, string> | null; utmify_sent_status: string | null; payment: Record<string, unknown> | null;
};

function targetStatus(o: OrderRow): "waiting_payment" | "paid" | "refunded" | null {
  if (o.status === "pago") return "paid";
  if (o.status === "reembolsado") return o.utmify_sent_status ? "refunded" : null;
  if (o.status === "aguardando_pagamento" && o.transaction_id && (o.payment_method ?? "pix") === "pix") return "waiting_payment";
  return null;
}

export function buildUtmifyBody(o: OrderRow, status: string, now = new Date().toISOString()) {
  const cents = (v: number) => Math.round(Number(v) * 100);
  const tp = o.tracking_params ?? {};
  const variants = (o.product_snapshot?.["variant_labels"] ?? {}) as Record<string, string>;
  const plan = Object.values(variants).join(" / ");
  const total = cents(o.total);
  return {
    orderId: o.order_number,
    platform: "AchadosTik",
    paymentMethod: o.payment_method === "card" ? "credit_card" : "pix",
    status,
    createdAt: utcStamp(o.created_at),
    approvedDate: status === "paid" || status === "refunded" ? utcStamp(o.paid_at ?? now) : null,
    refundedAt: status === "refunded" ? utcStamp(now) : null,
    customer: {
      name: String(o.customer?.["name"] ?? ""),
      email: String(o.customer?.["email"] ?? ""),
      phone: String(o.customer?.["phone"] ?? "").replace(/\D/g, "") || null,
      document: String(o.customer?.["document"] ?? "").replace(/\D/g, "") || null,
      country: "BR",
      ...(o.meta_attribution?.["ip"] ? { ip: o.meta_attribution["ip"] } : {}),
    },
    products: [{
      id: o.product_id ?? o.order_number,
      name: String(o.product_snapshot?.["title"] ?? "Produto"),
      planId: plan ? String(o.product_snapshot?.["sku"] ?? plan) : null,
      planName: plan || null,
      quantity: o.quantity,
      priceInCents: cents(o.unit_price),
    }],
    trackingParameters: Object.fromEntries(TRACKING_KEYS.map((k) => [k, tp[k] ? String(tp[k]) : null])),
    // A loja não informa a taxa do gateway: a doc orienta comissão = total nesse caso.
    commission: { totalPriceInCents: total, gatewayFeeInCents: 0, userCommissionInCents: total },
  };
}

/** Sincroniza o pedido com a UTMify. Idempotente: cada status é enviado uma única vez. */
export async function syncUtmifyOrder(orderId: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, store_id, status, created_at, paid_at, payment_method, transaction_id, product_id, quantity, unit_price, total, customer, product_snapshot, meta_attribution, tracking_params, utmify_sent_status, payment")
      .eq("id", orderId)
      .maybeSingle();
    const order = data as unknown as OrderRow | null;
    if (!order?.store_id) return;
    const status = targetStatus(order);
    if (!status || order.utmify_sent_status === status) return;
    // Nunca volta de "paid" para "waiting_payment".
    if (status === "waiting_payment" && order.utmify_sent_status) return;
    if (Date.now() - new Date(order.created_at).getTime() > 7 * 86400_000 && status !== "refunded") return;
    const settings = await loadUtmifySettings(order.store_id);
    if (!settings?.enabled || !settings.api_token) return;

    // Trava: só um processo envia este status.
    const previous = order.utmify_sent_status;
    let claim = supabaseAdmin.from("orders").update({ utmify_sent_status: status, utmify_sent_at: new Date().toISOString() } as never).eq("id", order.id);
    claim = previous ? claim.eq("utmify_sent_status", previous) : claim.is("utmify_sent_status", null);
    const { data: claimed } = await claim.select("id").maybeSingle();
    if (!claimed) return;

    const result = await postUtmify(settings.api_token, buildUtmifyBody(order, status));
    await logUtmify({ store_id: order.store_id, order_number: order.order_number, status, ok: result.ok, http_status: result.status || null, error: result.error ?? null });
    if (!result.ok) {
      await supabaseAdmin.from("orders").update({ utmify_sent_status: previous } as never).eq("id", order.id).eq("utmify_sent_status", status);
      console.warn("[utmify] falha", order.order_number, status, result.status);
    }
  } catch (error) {
    console.warn("[utmify] erro", error instanceof Error ? error.message : "desconhecido");
  }
}

export async function testUtmify(storeId: string, token: string) {
  const now = new Date().toISOString();
  const body = buildUtmifyBody({
    id: "teste", order_number: `TESTE-${Date.now()}`, store_id: storeId, status: "pago", created_at: now, paid_at: now, payment_method: "pix",
    transaction_id: "teste", product_id: "teste", quantity: 1, unit_price: 1, total: 1, customer: { name: "Teste Integração", email: "teste@example.com", phone: "11999999999", document: "" },
    product_snapshot: { title: "Produto de teste" }, meta_attribution: {}, tracking_params: { utm_source: "teste" }, utmify_sent_status: null, payment: {},
  }, "paid", now);
  const result = await postUtmify(token, { ...body, isTest: true });
  await logUtmify({ store_id: storeId, order_number: body.orderId, status: "paid", ok: result.ok, http_status: result.status || null, error: result.error ?? null, test_mode: true });
  return result;
}
