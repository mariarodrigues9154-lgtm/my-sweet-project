/** Recuperação de PIX pendente via WhatsApp — somente servidor. */

export type WaProvider = "meta" | "zapi" | "evolution";

export const DEFAULT_SITE = "https://www.achados-tik.shop";

/** Normaliza telefone brasileiro para 55 + DDD + número (só dígitos). Null se inválido. */
export function normalizeBrPhone(raw: unknown): string | null {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (!/^55\d{10,11}$/.test(d)) return null;
  const ddd = Number(d.slice(2, 4));
  if (ddd < 11 || ddd > 99) return null;
  return d;
}

export function maskPhoneTail(d: string | null): string {
  return d ? `****${d.slice(-4)}` : "—";
}

export function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k]! : m));
}

/** Minutos de espera de cada lembrete ativo (1 a 3). */
export function reminderDelays(delays: number[] | null | undefined, max: number): number[] {
  const n = Math.min(3, Math.max(1, Math.round(max || 1)));
  const base = [15, 60, 180];
  return Array.from({ length: n }, (_, i) => Math.max(1, Math.min(10080, Math.round(Number(delays?.[i] ?? base[i])))));
}

type SendInput = {
  provider: WaProvider;
  secrets: Record<string, string>;
  pub: Record<string, string>;
  to: string;
  text: string;
  vars: Record<string, string>;
  token: string;
};

async function body(res: Response) {
  const t = await res.text();
  return t.slice(0, 400);
}

/** Envia a mensagem pelo provedor da loja. Retorna id da mensagem ou lança erro com o motivo. */
export async function sendWhatsApp(i: SendInput): Promise<string | null> {
  if (i.provider === "meta") {
    const token = i.secrets.access_token;
    const phoneId = i.pub.phone_number_id;
    const template = i.pub.template_name;
    if (!token || !phoneId || !template) throw new Error("Integração incompleta (token, ID do número ou modelo).");
    const names = (i.pub.template_vars || "nome,pedido,valor").split(",").map((s) => s.trim()).filter(Boolean);
    const components: unknown[] = [];
    if (names.length) components.push({ type: "body", parameters: names.map((n) => ({ type: "text", text: i.vars[n] || "-" })) });
    if (i.pub.template_button === "true") components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: i.token }] });
    const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(phoneId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: i.to, type: "template", template: { name: template, language: { code: i.pub.template_lang || "pt_BR" }, components } }),
    });
    if (!res.ok) throw new Error(`API do WhatsApp (${res.status}): ${await body(res)}`);
    const j = (await res.json()) as { messages?: Array<{ id?: string }> };
    return j.messages?.[0]?.id ?? null;
  }
  if (i.provider === "zapi") {
    const { instance_id: inst, instance_token: tok } = i.pub as Record<string, string>;
    const client = i.secrets.client_token;
    const tokenSecret = i.secrets.instance_token || tok;
    if (!inst || !tokenSecret) throw new Error("Integração incompleta (instância ou token).");
    const res = await fetch(`https://api.z-api.io/instances/${encodeURIComponent(inst)}/token/${encodeURIComponent(tokenSecret)}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(client ? { "Client-Token": client } : {}) },
      body: JSON.stringify({ phone: i.to, message: i.text }),
    });
    if (!res.ok) throw new Error(`Z-API (${res.status}): ${await body(res)}`);
    const j = (await res.json().catch(() => ({}))) as { messageId?: string; zaapId?: string };
    return j.messageId ?? j.zaapId ?? null;
  }
  const base = (i.pub.base_url || "").replace(/\/+$/, "");
  const inst = i.pub.instance;
  const key = i.secrets.api_key;
  if (!/^https:\/\//.test(base) || !inst || !key) throw new Error("Integração incompleta (URL https, instância ou API key).");
  const res = await fetch(`${base}/message/sendText/${encodeURIComponent(inst)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key },
    body: JSON.stringify({ number: i.to, text: i.text }),
  });
  if (!res.ok) throw new Error(`Evolution API (${res.status}): ${await body(res)}`);
  const j = (await res.json().catch(() => ({}))) as { key?: { id?: string } };
  return j.key?.id ?? null;
}

/** Processa os lembretes vencidos de todas as lojas ativas. Idempotente (trava por pedido+lembrete). */
export async function runPixWhatsappRecovery(): Promise<{ checked: number; sent: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: configs } = await supabaseAdmin.from("store_whatsapp_settings").select("*").eq("enabled", true);
  let checked = 0;
  let sent = 0;
  for (const cfg of configs ?? []) {
    const delays = reminderDelays(cfg.delays as number[], cfg.max_reminders as number);
    const minDelay = Math.min(...delays);
    const now = Date.now();
    const since = new Date(now - (Math.max(...delays) + 24 * 60) * 60000).toISOString();
    const until = new Date(now - minDelay * 60000).toISOString();
    // Só pedidos criados depois que a recuperação foi ligada/salva (não dispara para pedidos antigos).
    const after = new Date(Math.max(new Date(since).getTime(), new Date(cfg.updated_at as string).getTime() - minDelay * 60000)).toISOString();
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, status, store_id, customer, product_snapshot, total, payment, pix_expiration_date, access_token, transaction_id, created_at")
      .eq("store_id", cfg.store_id)
      .eq("status", "aguardando_pagamento")
      .not("transaction_id", "is", null)
      .gte("created_at", after)
      .lte("created_at", until)
      .limit(50);
    if (!orders?.length) continue;
    const { data: store } = await supabaseAdmin.from("store_settings").select("name").eq("id", cfg.store_id).maybeSingle();
    const { data: logs } = await supabaseAdmin.from("whatsapp_pix_reminders").select("order_id, step").in("order_id", orders.map((o) => o.id));
    const done = new Set((logs ?? []).map((l) => `${l.order_id}:${l.step}`));

    for (const o of orders) {
      const age = (now - new Date(o.created_at as string).getTime()) / 60000;
      // Lembrete mais avançado já vencido e ainda não registrado (não manda vários atrasados de uma vez).
      let step = -1;
      for (let s = delays.length - 1; s >= 0; s--) if (age >= delays[s]! ) { step = s + 1; break; }
      if (step < 1 || done.has(`${o.id}:${step}`)) continue;
      // Trava contra duplicidade: a linha única (pedido, lembrete) só é criada uma vez.
      const phone = normalizeBrPhone((o.customer as { phone?: string })?.phone);
      const { data: lock, error: lockErr } = await supabaseAdmin
        .from("whatsapp_pix_reminders")
        .insert({ store_id: cfg.store_id, order_id: o.id, step, phone_masked: maskPhoneTail(phone) })
        .select("id")
        .maybeSingle();
      if (lockErr || !lock) continue;
      // Pula lembretes anteriores que ficaram para trás.
      for (let s = 1; s < step; s++) if (!done.has(`${o.id}:${s}`)) {
        await supabaseAdmin.from("whatsapp_pix_reminders").insert({ store_id: cfg.store_id, order_id: o.id, step: s, status: "ignorado", detail: "Substituído por lembrete posterior", phone_masked: maskPhoneTail(phone) });
      }
      checked++;
      const finish = (status: string, detail: string | null, pix_status: string, extra: Record<string, unknown> = {}) =>
        supabaseAdmin.from("whatsapp_pix_reminders").update({ status, detail, pix_status, updated_at: new Date().toISOString(), ...extra }).eq("id", lock.id);

      // Status real no provedor antes de enviar.
      let status = o.status as string;
      try {
        const { checkOrderPaymentStatus } = await import("@/lib/payments/order-status.server");
        status = (await checkOrderPaymentStatus(o.order_number as string)).status;
      } catch { /* mantém */ }
      if (status === "pago" || status === "aprovado") { await finish("nao_enviada", "Pagamento confirmado antes do prazo", "PAID"); continue; }
      if (status === "reembolsado") { await finish("nao_enviada", "Pedido reembolsado", "REFUNDED"); continue; }
      if (status !== "aguardando_pagamento") { await finish("nao_enviada", `Pedido com status ${status}`, status.toUpperCase()); continue; }
      if (!phone) { await finish("falha", "Telefone inválido", "PENDING"); continue; }

      const pay = (o.payment ?? {}) as { copy_paste?: string; expiration_date?: string };
      const exp = (o.pix_expiration_date as string | null) ?? pay.expiration_date ?? null;
      const expired = !!exp && new Date(exp).getTime() <= now;
      const pub = (cfg.public_data ?? {}) as Record<string, string>;
      const site = (pub.site_url || DEFAULT_SITE).replace(/\/+$/, "");
      const link = `${site}/pix/${o.access_token}`;
      const snap = (o.product_snapshot ?? {}) as { title?: string };
      const name = String((o.customer as { name?: string })?.name ?? "").trim().split(/\s+/)[0] || "cliente";
      const vars = {
        nome: name,
        pedido: String(o.order_number),
        produto: snap.title ?? "",
        valor: Number(o.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        pix: expired ? "" : pay.copy_paste ?? "",
        link_pagamento: link,
        nome_loja: (store?.name as string) ?? "",
      };
      const text = fillTemplate(cfg.message || "Olá, {nome}! Seu pedido #{pedido} ainda está aguardando pagamento. Valor: {valor}. Pague com PIX: {link_pagamento}", vars);
      try {
        const id = await sendWhatsApp({ provider: cfg.provider as WaProvider, secrets: (cfg.secret_data ?? {}) as Record<string, string>, pub, to: phone, text, vars, token: o.access_token as string });
        await finish("enviada", expired ? "PIX expirado — link para gerar nova cobrança" : null, expired ? "EXPIRED" : "PENDING", { provider_message_id: id });
        sent++;
      } catch (e) {
        await finish("falha", (e instanceof Error ? e.message : "Falha na API do WhatsApp").slice(0, 500), "PENDING");
      }
    }
  }
  return { checked, sent };
}
