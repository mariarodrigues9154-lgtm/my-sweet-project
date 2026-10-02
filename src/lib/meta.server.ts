/**
 * Meta Conversions API (server-side). O token de acesso nunca sai do servidor
 * e nunca é registrado em logs.
 */

const GRAPH = "https://graph.facebook.com/v21.0";
const TEST_CODE_TTL_MS = 24 * 60 * 60 * 1000;

export type MetaRow = {
  enabled: boolean;
  pixel_id: string | null;
  track_pending: boolean;
  capi_token: string | null;
  test_event_code: string | null;
  test_event_code_set_at: string | null;
};

export async function loadMetaSettings(storeId: string): Promise<MetaRow | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("store_meta_settings" as never)
    .select("enabled, pixel_id, track_pending, capi_token, test_event_code, test_event_code_set_at")
    .eq("store_id", storeId)
    .maybeSingle();
  return (data as MetaRow | null) ?? null;
}

/** Código de teste só vale por 24h após salvo, para não ficar ativo em produção. */
export function activeTestCode(row: MetaRow): string | null {
  if (!row.test_event_code || !row.test_event_code_set_at) return null;
  return Date.now() - new Date(row.test_event_code_set_at).getTime() < TEST_CODE_TTL_MS ? row.test_event_code : null;
}

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const onlyDigits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

async function hashed(value: string) { return value ? [await sha256(value)] : undefined; }

/** Registra no histórico da loja; nunca grava token nem dados do cliente. */
export async function logMetaEvent(entry: { store_id: string; event_name: string; event_id?: string | null; order_number?: string | null; ok: boolean; http_status?: number | null; error?: string | null; test_mode?: boolean; source?: string }) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("meta_event_logs" as never).insert({ ...entry, error: entry.error ? entry.error.replace(/access_token=[^&\s"]+/g, "access_token=***").slice(0, 500) : null } as never);
  } catch { /* histórico nunca bloqueia o envio */ }
}

function metaErrorMessage(text: string): string {
  try {
    const e = (JSON.parse(text) as { error?: { message?: string; error_user_msg?: string; code?: number } }).error;
    if (e) return [e.error_user_msg || e.message, e.code ? `(código ${e.code})` : ""].filter(Boolean).join(" ");
  } catch { /* texto cru */ }
  return text;
}

export async function sendCapiEvent(row: MetaRow, event: Record<string, unknown>, log?: { store_id: string; order_number?: string }): Promise<{ ok: boolean; status: number; error?: string }> {
  const result = await sendCapiRaw(row, event);
  if (log) await logMetaEvent({ store_id: log.store_id, order_number: log.order_number ?? null, event_name: String(event["event_name"] ?? ""), event_id: (event["event_id"] as string) ?? null, ok: result.ok, http_status: result.status || null, error: result.error ?? null, test_mode: Boolean(activeTestCode(row)) });
  return result;
}

async function sendCapiRaw(row: MetaRow, event: Record<string, unknown>): Promise<{ ok: boolean; status: number; error?: string }> {
  if (!row.pixel_id || !row.capi_token) return { ok: false, status: 0, error: "Conversions API não configurada." };
  const body: Record<string, unknown> = { data: [event] };
  const test = activeTestCode(row);
  if (test) body["test_event_code"] = test;
  let res: Response;
  try { res = await fetch(`${GRAPH}/${encodeURIComponent(row.pixel_id)}/events?access_token=${encodeURIComponent(row.capi_token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }); } catch { return { ok: false, status: 0, error: "Falha de conexão com a Meta." }; }
  if (!res.ok) {
    const text = (await res.text()).slice(0, 600);
    return { ok: false, status: res.status, error: metaErrorMessage(text) };
  }
  return { ok: true, status: res.status };
}

/**
 * Envia Purchase uma única vez por pedido pago. A marcação no pedido é feita
 * antes do envio (trava atômica); se o envio falhar, a trava é desfeita para
 * uma nova tentativa na próxima confirmação.
 */
export async function sendPurchaseForOrder(orderId: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: base } = await supabaseAdmin.from("orders").select("order_number, store_id").eq("id", orderId).maybeSingle();
    if (!base?.store_id) return;
    const row = await loadMetaSettings(base.store_id as string);
    if (!row || !row.enabled || !row.pixel_id || !row.capi_token) return;

    const eventId = `purchase_${base.order_number}`;
    const { data: claimed } = await supabaseAdmin
      .from("orders")
      .update({ meta_purchase_sent_at: new Date().toISOString(), meta_purchase_event_id: eventId } as never)
      .eq("id", orderId)
      .eq("status", "pago")
      .is("meta_purchase_sent_at" as never, null)
      .select("order_number, total, quantity, unit_price, product_id, customer, address, meta_attribution, paid_at")
      .maybeSingle();
    if (!claimed) return;

    const order = claimed as unknown as {
      order_number: string; total: number; quantity: number; unit_price: number; product_id: string | null;
      customer: Record<string, string>; address: Record<string, string>; meta_attribution: Record<string, string>; paid_at: string | null;
    };
    const attr = order.meta_attribution ?? {};
    const [first, ...rest] = String(order.customer?.["name"] ?? "").trim().split(/\s+/);
    const phone = onlyDigits(order.customer?.["phone"]);
    const user_data: Record<string, unknown> = {
      em: await hashed(String(order.customer?.["email"] ?? "").trim().toLowerCase()),
      ph: await hashed(phone ? (phone.startsWith("55") ? phone : `55${phone}`) : ""),
      fn: await hashed(norm(first)),
      ln: await hashed(norm(rest.join(""))),
      ct: await hashed(norm(order.address?.["city"])),
      st: await hashed(norm(order.address?.["state"])),
      zp: await hashed(onlyDigits(order.address?.["cep"])),
      country: await hashed("br"),
      external_id: await hashed(order.order_number),
      ...(attr["ip"] ? { client_ip_address: attr["ip"] } : {}),
      ...(attr["ua"] ? { client_user_agent: attr["ua"] } : {}),
      ...(attr["fbp"] ? { fbp: attr["fbp"] } : {}),
      ...(attr["fbc"] ? { fbc: attr["fbc"] } : {}),
    };
    for (const key of Object.keys(user_data)) if (user_data[key] === undefined) delete user_data[key];

    const contentId = order.product_id ?? order.order_number;
    const result = await sendCapiEvent(row, {
      event_name: "Purchase",
      event_time: Math.floor(new Date(order.paid_at ?? Date.now()).getTime() / 1000),
      event_id: eventId,
      action_source: "website",
      ...(attr["url"] ? { event_source_url: attr["url"] } : {}),
      user_data,
      custom_data: {
        currency: "BRL",
        value: Number(order.total),
        content_type: "product",
        content_ids: [contentId],
        contents: [{ id: contentId, quantity: order.quantity, item_price: Number(order.unit_price) }],
        num_items: order.quantity,
        order_id: order.order_number,
      },
    }, { store_id: base.store_id as string, order_number: order.order_number });
    if (!result.ok) {
      console.error(`Meta CAPI Purchase falhou [${result.status}] pedido ${order.order_number}`);
      await supabaseAdmin.from("orders").update({ meta_purchase_sent_at: null } as never).eq("id", orderId);
    }
  } catch {
    console.error("Meta CAPI Purchase: erro inesperado");
  }
}

/** Dados de atribuição coletados do próprio pedido (cookies _fbp/_fbc, IP, navegador). */
export function attributionFromHeaders(get: (name: string) => string | undefined | null): Record<string, string> {
  const cookie = get("cookie") ?? "";
  const read = (name: string) => cookie.split(/;\s*/).find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
  const ip = (get("cf-connecting-ip") ?? get("x-forwarded-for") ?? "").split(",")[0]?.trim() ?? "";
  const out: Record<string, string> = {};
  const fbp = read("_fbp"); const fbc = read("_fbc"); const ua = get("user-agent") ?? ""; const url = get("referer") ?? "";
  if (fbp) out["fbp"] = fbp.slice(0, 200);
  if (fbc) out["fbc"] = fbc.slice(0, 300);
  if (ip) out["ip"] = ip.slice(0, 64);
  if (ua) out["ua"] = ua.slice(0, 400);
  if (url) out["url"] = url.slice(0, 500);
  return out;
}
