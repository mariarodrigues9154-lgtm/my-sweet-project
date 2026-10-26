/**
 * Integração Magnus Frete (API Externa): envia pedidos pagos e recebe o código de rastreio.
 * A API NÃO é idempotente — cada POST cria um envio. Por isso:
 *  - order_shipments.order_id é UNIQUE (um envio por pedido, trava atômica);
 *  - erro de rede/timeout/5xx vira "incerto" e nunca é reenviado automaticamente.
 * O token fica só no servidor e nunca é registrado em logs.
 */
export const MAGNUS_ENDPOINT = "https://wzxfbejykayahnfdkdbl.supabase.co/functions/v1/api-external";

type Json = Record<string, unknown>;
export type MagnusOrder = {
  id: string; order_number: string; store_id: string | null; status: string;
  quantity: number; unit_price: number; total: number;
  customer: Json | null; address: Json | null; product_snapshot: Json | null;
};

const s = (v: unknown) => (v == null ? "" : String(v)).trim();
const digits = (v: unknown) => s(v).replace(/\D/g, "");

export function buildMagnusBody(o: MagnusOrder) {
  const c = o.customer ?? {};
  const a = o.address ?? {};
  const variants = (o.product_snapshot?.["variant_labels"] ?? {}) as Record<string, string>;
  const plan = Object.values(variants).filter(Boolean).join(" / ");
  const title = s(o.product_snapshot?.["title"]) || "Produto";
  const body: Json = {
    customer: {
      name: s(c["name"]),
      email: s(c["email"]),
      ...(digits(c["document"]) ? { document: digits(c["document"]) } : {}),
      ...(digits(c["phone"]) ? { phone: digits(c["phone"]) } : {}),
    },
    items: [{ name: plan ? `${title} (${plan})` : title, quantity: Math.max(1, Number(o.quantity) || 1), price: Number(Number(o.unit_price).toFixed(2)) }],
    total: Number(Number(o.total).toFixed(2)),
  };
  if (s(a["street"]) || s(a["cep"])) {
    body["address"] = {
      street: s(a["street"]), number: s(a["number"]), neighborhood: s(a["district"] ?? a["neighborhood"]),
      city: s(a["city"]), state: s(a["state"]).toUpperCase(), zipcode: digits(a["cep"] ?? a["zipcode"]),
      complement: s(a["complement"]),
    };
  }
  return body;
}

export type MagnusResult =
  | { kind: "ok"; status: number; tracking: string; pedidoId: string | null; envioId: string | null }
  | { kind: "rejected"; status: number; error: string } // certeza de que nada foi criado
  | { kind: "uncertain"; status: number; error: string }; // pode ter sido criado

export function magnusErrorMessage(status: number, text: string): string {
  if (status === 400) return "Token ausente na URL.";
  if (status === 401) return "Token inválido — confira em Integrações → API Externa no painel Magnus Frete.";
  if (status === 405) return "Método não aceito pela Magnus Frete.";
  if (status === 422) {
    try { const j = JSON.parse(text) as { details?: string[] }; if (j.details?.length) return `Dados recusados: ${j.details.join("; ")}`; } catch { /* texto cru */ }
    return "Dados do pedido recusados pela Magnus Frete.";
  }
  return `Magnus Frete respondeu ${status}.`;
}

export async function postMagnus(token: string, body: Json, fetchImpl: typeof fetch = fetch): Promise<MagnusResult> {
  let res: Response;
  try {
    res = await fetchImpl(`${MAGNUS_ENDPOINT}?token=${encodeURIComponent(token)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
    });
  } catch {
    return { kind: "uncertain", status: 0, error: "Sem resposta da Magnus Frete (tempo esgotado ou falha de conexão)." };
  }
  const text = await res.text().catch(() => "");
  if (res.ok) {
    try {
      const j = JSON.parse(text) as { success?: boolean; codigo_rastreio?: string; pedido_id?: string; envio_id?: string };
      if (j.success && j.codigo_rastreio) return { kind: "ok", status: res.status, tracking: String(j.codigo_rastreio).slice(0, 60), pedidoId: j.pedido_id ?? null, envioId: j.envio_id ?? null };
    } catch { /* cai abaixo */ }
    return { kind: "uncertain", status: res.status, error: "Resposta da Magnus Frete sem código de rastreio." };
  }
  if (res.status >= 400 && res.status < 500) return { kind: "rejected", status: res.status, error: magnusErrorMessage(res.status, text) };
  return { kind: "uncertain", status: res.status, error: magnusErrorMessage(res.status, text) };
}

/**
 * Envia o pedido pago à Magnus Frete uma única vez.
 * `retry` só reabre envios que falharam com certeza; `force` também reabre "incerto" (decisão do admin).
 */
export async function syncMagnusOrder(orderId: string, opts: { retry?: boolean; force?: boolean } = {}): Promise<{ ok: boolean; message: string }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("orders")
      .select("id, order_number, store_id, status, quantity, unit_price, total, customer, address, product_snapshot")
      .eq("id", orderId).maybeSingle();
    const order = data as unknown as MagnusOrder | null;
    if (!order?.store_id) return { ok: false, message: "Pedido não encontrado." };
    if (order.status !== "pago") return { ok: false, message: "Só pedidos com pagamento confirmado são enviados." };
    const { data: cfg } = await supabaseAdmin.from("store_magnus_settings").select("enabled, api_token").eq("store_id", order.store_id).maybeSingle();
    if (!cfg?.enabled || !cfg.api_token) return { ok: false, message: "Magnus Frete desativada ou sem token nesta loja." };

    // Trava atômica: um envio por pedido.
    const { data: inserted } = await supabaseAdmin.from("order_shipments")
      .upsert({ order_id: order.id, store_id: order.store_id, send_status: "enviando", attempts: 1 }, { onConflict: "order_id", ignoreDuplicates: true })
      .select("id").maybeSingle();
    let shipmentId = inserted?.id as string | undefined;
    if (!shipmentId) {
      const allowed = opts.force ? ["falhou", "incerto"] : opts.retry ? ["falhou"] : [];
      if (!allowed.length) return { ok: false, message: "Pedido já enviado ou em envio." };
      const { data: cur } = await supabaseAdmin.from("order_shipments").select("id, attempts, store_id").eq("order_id", order.id).maybeSingle();
      if (!cur || cur.store_id !== order.store_id) return { ok: false, message: "Envio vinculado a outra loja." };
      const { data: claimed } = await supabaseAdmin.from("order_shipments")
        .update({ send_status: "enviando", attempts: (cur.attempts ?? 0) + 1, error: null })
        .eq("id", cur.id).in("send_status", allowed).select("id").maybeSingle();
      if (!claimed) return { ok: false, message: "Este envio não pode ser reenviado agora." };
      shipmentId = claimed.id as string;
    }

    const r = await postMagnus(cfg.api_token, buildMagnusBody(order));
    if (r.kind === "ok") {
      await supabaseAdmin.from("order_shipments").update({
        send_status: "enviado", tracking_code: r.tracking, provider_order_id: r.pedidoId, provider_shipment_id: r.envioId,
        http_status: r.status, error: null, sent_at: new Date().toISOString(),
      }).eq("id", shipmentId);
      return { ok: true, message: `Rastreio ${r.tracking} gerado.` };
    }
    await supabaseAdmin.from("order_shipments").update({
      send_status: r.kind === "rejected" ? "falhou" : "incerto", http_status: r.status || null, error: r.error.slice(0, 500),
    }).eq("id", shipmentId);
    console.warn("[magnus] envio não concluído", order.order_number, r.kind, r.status);
    return { ok: false, message: r.error };
  } catch (e) {
    console.warn("[magnus] erro", e instanceof Error ? e.message : "desconhecido");
    return { ok: false, message: "Erro inesperado ao enviar para a Magnus Frete." };
  }
}
