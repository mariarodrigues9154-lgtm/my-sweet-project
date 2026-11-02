/** Recuperação de PIX pendente via WhatsApp — somente servidor. */

export type WaProvider = "meta" | "zapi" | "evolution" | "plugsend";

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

/** Texto padrão quando a loja não escreveu uma mensagem própria. */
export const DEFAULT_RECOVERY_MESSAGE = "Oi, {nome}! Vi que seu Pix foi gerado, mas o pagamento ainda não foi concluído. Teve alguma dificuldade ou ficou com alguma dúvida? Se precisar, posso te ajudar.";

/**
 * Texto final do lembrete: o link de pagamento é sempre removido,
 * mesmo que um modelo antigo ainda use {link_pagamento}.
 */
export function recoveryText(message: string, vars: Record<string, string>): string {
  const text = fillTemplate(message || DEFAULT_RECOVERY_MESSAGE, { ...vars, link_pagamento: "" });
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
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
    const token = i.secrets["access_token"];
    const phoneId = i.pub["phone_number_id"];
    const template = i.pub["template_name"];
    if (!token || !phoneId || !template) throw new Error("Integração incompleta (token, ID do número ou modelo).");
    const names = (i.pub["template_vars"] || "nome,pedido,valor").split(",").map((s) => s.trim()).filter(Boolean);
    const components: unknown[] = [];
    if (names.length) components.push({ type: "body", parameters: names.map((n) => ({ type: "text", text: i.vars[n] || "-" })) });
    if (i.pub["template_button"] === "true") components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: i.token }] });
    const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(phoneId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: i.to, type: "template", template: { name: template, language: { code: i.pub["template_lang"] || "pt_BR" }, components } }),
    });
    if (!res.ok) throw new Error(`API do WhatsApp (${res.status}): ${await body(res)}`);
    const j = (await res.json()) as { messages?: Array<{ id?: string }> };
    return j.messages?.[0]?.id ?? null;
  }
  if (i.provider === "zapi") {
    const { instance_id: inst, instance_token: tok } = i.pub as Record<string, string>;
    const client = i.secrets["client_token"];
    const tokenSecret = i.secrets["instance_token"] || tok;
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
  if (i.provider === "plugsend") {
    const token = i.secrets["plugsend_token"];
    if (!token) throw new Error("Integração incompleta (token PlugSend).");
    const res = await fetch("https://plugsend.uazapi.com/send/text", {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify({ number: i.to, text: i.text, linkPreview: true }),
    });
    if (!res.ok) throw new Error(`PlugSend (${res.status}): ${await body(res)}`);
    const j = (await res.json().catch(() => ({}))) as { messageid?: string; id?: string };
    return j.messageid ?? j.id ?? null;
  }
  const base = (i.pub["base_url"] || "").replace(/\/+$/, "");
  const inst = i.pub["instance"];
  const key = i.secrets["api_key"];
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
  // Uma única rodada global a cada cinco minutos, inclusive se o provedor falhar.
  // A reserva atômica também impede dois cron jobs simultâneos de disparar juntos.
  if (!(await claimRecoveryDispatch(supabaseAdmin))) return { checked: 0, sent: 0 };
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
      // Só cobranças PIX: tentativas de cartão nunca entram na recuperação de PIX.
      .or("payment_method.eq.pix,payment_method.is.null")
      .not("transaction_id", "is", null)
      .gte("created_at", after)
      .lte("created_at", until)
      // Mais recentes primeiro: com muitos PIX pendentes, os novos nunca podem ficar de fora.
      .order("created_at", { ascending: false })
      .limit(500);
    const { data: store } = await supabaseAdmin.from("store_settings").select("name").eq("id", cfg.store_id).maybeSingle();
    // Reenvio de mensagens que falharam porque o WhatsApp estava desconectado: 1 por vez, com 5 min de intervalo.
    try {
      const retry = await retryDisconnected(supabaseAdmin, cfg, (store?.name as string) ?? "", now);
      if (retry) return { checked: checked + 1, sent: sent + (retry === "sent" ? 1 : 0) };
    } catch { return { checked, sent }; }
    if (!orders?.length) continue;
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

      // Mesma tentativa de compra: outro PIX do mesmo cliente pago (ou pendente mais novo) bloqueia este.
      const attempt = await checkAttempt(supabaseAdmin, cfg.store_id as string, o);
      if (attempt.action === "skip_paid") { await finish("nao_enviada", `Recuperação cancelada: cliente já pagou o pedido #${attempt.by.order_number ?? ""} da mesma tentativa de compra`, "PAID"); continue; }
      if (attempt.action === "skip_superseded") { await finish("ignorado", `Substituído pelo PIX mais recente #${attempt.by.order_number ?? ""} do mesmo cliente`, "PENDING"); continue; }
      // Trava de 24h: o mesmo cliente nunca recebe mais de uma mensagem de recuperação por dia.
      if (await messagedRecently(supabaseAdmin, cfg.store_id as string, o, now)) { await finish("ignorado", "Cliente já recebeu mensagem nas últimas 24h", "PENDING"); continue; }

      const pay = (o.payment ?? {}) as { copy_paste?: string; expiration_date?: string };
      const exp = (o.pix_expiration_date as string | null) ?? pay.expiration_date ?? null;
      const expired = !!exp && new Date(exp).getTime() <= now;
      const pub = (cfg.public_data ?? {}) as Record<string, string>;
      const snap = (o.product_snapshot ?? {}) as { title?: string };
      const name = String((o.customer as { name?: string })?.name ?? "").trim().split(/\s+/)[0] || "cliente";
      const vars = {
        nome: name,
        pedido: String(o.order_number),
        produto: snap.title ?? "",
        valor: Number(o.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        pix: expired ? "" : pay.copy_paste ?? "",
        nome_loja: (store?.name as string) ?? "",
      };
      const text = recoveryText(cfg.message as string, vars);
      try {
        const id = await sendWhatsApp({ provider: cfg.provider as WaProvider, secrets: (cfg.secret_data ?? {}) as Record<string, string>, pub, to: phone, text, vars, token: o.access_token as string });
        await finish("enviada", expired ? "PIX expirado — mensagem enviada sem link" : null, expired ? "EXPIRED" : "PENDING", { provider_message_id: id });
        sent++;
      } catch (e) {
        await finish("falha", (e instanceof Error ? e.message : "Falha na API do WhatsApp").slice(0, 500), "PENDING");
      }
      // Nunca continuar para outro cliente ou outra loja na mesma rodada.
      return { checked, sent };
    }
  }
  return { checked, sent };
}

export const RETRY_GAP_MIN = 5;

export async function claimRecoveryDispatch(db: { rpc: (name: "claim_whatsapp_recovery_dispatch") => PromiseLike<{ data: unknown; error: unknown }> }): Promise<boolean> {
  const { data, error } = await db.rpc("claim_whatsapp_recovery_dispatch");
  return !error && data === true;
}

/** Reenvia o lembrete mais antigo (últimas 24h) que falhou por WhatsApp desconectado, se nada foi enviado nos últimos 5 min. */
async function retryDisconnected(db: any, cfg: any, storeName: string, now: number): Promise<"sent" | "failed" | false> {
  const gapSince = new Date(now - RETRY_GAP_MIN * 60000).toISOString();
  const { data: recent } = await db.from("whatsapp_pix_reminders").select("id").eq("status", "enviada").gte("updated_at", gapSince).limit(1);
  if (recent?.length) return false;
  const { data: rows } = await db
    .from("whatsapp_pix_reminders")
    .select("id, order_id")
    .eq("store_id", cfg.store_id)
    .eq("status", "falha")
    .ilike("detail", "%disconnect%")
    .gte("created_at", new Date(now - 24 * 3600000).toISOString())
    .order("created_at", { ascending: true })
    .limit(1);
  const row = rows?.[0];
  if (!row) return false;
  const finish = (status: string, detail: string | null, pix_status: string, extra: Record<string, unknown> = {}) =>
    db.from("whatsapp_pix_reminders").update({ status, detail, pix_status, updated_at: new Date().toISOString(), ...extra }).eq("id", row.id);
  // Trava: só quem conseguir trocar de "falha" para "reenviando" continua.
  const { data: claimed } = await db.from("whatsapp_pix_reminders").update({ status: "reenviando", updated_at: new Date().toISOString() }).eq("id", row.id).eq("status", "falha").select("id");
  if (!claimed?.length) return false;
  const { data: o } = await db
    .from("orders")
    .select("id, order_number, status, store_id, customer, product_snapshot, total, payment, payment_method, pix_expiration_date, access_token, created_at")
    .eq("id", row.order_id)
    .maybeSingle();
  if (!o || (o.payment_method && o.payment_method !== "pix")) { await finish("nao_enviada", "Pedido não é PIX", "UNKNOWN"); return false; }
  let status = o.status as string;
  try {
    const { checkOrderPaymentStatus } = await import("@/lib/payments/order-status.server");
    status = (await checkOrderPaymentStatus(o.order_number as string)).status;
  } catch { /* mantém */ }
  if (status === "pago" || status === "aprovado") { await finish("nao_enviada", "Pagamento confirmado antes do reenvio", "PAID"); return false; }
  if (status !== "aguardando_pagamento") { await finish("nao_enviada", `Pedido com status ${status}`, status.toUpperCase()); return false; }
  const phone = normalizeBrPhone((o.customer as { phone?: string })?.phone);
  if (!phone) { await finish("falha", "Telefone inválido", "PENDING"); return false; }
  const attempt = await checkAttempt(db, cfg.store_id as string, o);
  if (attempt.action === "skip_paid") { await finish("nao_enviada", `Recuperação cancelada: cliente já pagou o pedido #${attempt.by.order_number ?? ""} da mesma tentativa de compra`, "PAID"); return false; }
  if (attempt.action === "skip_superseded") { await finish("ignorado", `Substituído pelo PIX mais recente #${attempt.by.order_number ?? ""} do mesmo cliente`, "PENDING"); return false; }
  if (await messagedRecently(db, cfg.store_id as string, o, now)) { await finish("ignorado", "Cliente já recebeu mensagem nas últimas 24h", "PENDING"); return false; }
  const pay = (o.payment ?? {}) as { copy_paste?: string; expiration_date?: string };
  const exp = (o.pix_expiration_date as string | null) ?? pay.expiration_date ?? null;
  const expired = !!exp && new Date(exp).getTime() <= now;
  const pub = (cfg.public_data ?? {}) as Record<string, string>;
  const vars = {
    nome: String((o.customer as { name?: string })?.name ?? "").trim().split(/\s+/)[0] || "cliente",
    pedido: String(o.order_number),
    produto: ((o.product_snapshot ?? {}) as { title?: string }).title ?? "",
    valor: Number(o.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    pix: expired ? "" : pay.copy_paste ?? "",
    nome_loja: storeName,
  };
  const text = recoveryText(cfg.message as string, vars);
  try {
    const id = await sendWhatsApp({ provider: cfg.provider as WaProvider, secrets: (cfg.secret_data ?? {}) as Record<string, string>, pub, to: phone, text, vars, token: o.access_token as string });
    await finish("enviada", `Reenviada após reconexão${expired ? " — PIX expirado, mensagem sem link" : ""}`, expired ? "EXPIRED" : "PENDING", { provider_message_id: id });
    return "sent";
  } catch (e) {
    await finish("falha", (e instanceof Error ? e.message : "Falha na API do WhatsApp").slice(0, 500), "PENDING");
    return "failed";
  }
}

/** Busca outros pedidos da loja na janela da tentativa, reconfirma pendentes no gateway e decide. */
async function checkAttempt(db: any, storeId: string, o: { id: string; created_at: unknown; customer: unknown; order_number: unknown }) {
  const { decideAttempt, ATTEMPT_WINDOW_MIN } = await import("./pix-purchase-attempt");
  const since = new Date(new Date(o.created_at as string).getTime() - ATTEMPT_WINDOW_MIN * 60000).toISOString();
  const { data } = await db.from("orders").select("id, order_number, status, created_at, customer, payment_method").eq("store_id", storeId).gte("created_at", since).limit(500);
  // Cartão pendente (tentativa recusada/abandonada) não substitui um PIX; cartão pago continua cancelando a recuperação.
  const all = ((data ?? []) as Array<{ status: string; payment_method?: string | null }>).filter((r) => r.status !== "aguardando_pagamento" || !r.payment_method || r.payment_method === "pix");
  const target = { id: o.id, order_number: o.order_number as string, status: "aguardando_pagamento", created_at: o.created_at as string, customer: o.customer as never };
  const rows = all as unknown as Array<typeof target>;
  let decision = decideAttempt(target, rows);
  if (decision.action !== "send") return decision;
  // Última validação: outros PIX pendentes do mesmo cliente podem ter sido pagos e o aviso ainda não chegou.
  const { customerKeys } = await import("./pix-purchase-attempt");
  const keys = new Set(customerKeys(target.customer));
  const siblings = rows.filter((r) => r.id !== o.id && r.status === "aguardando_pagamento" && customerKeys(r.customer).some((k) => keys.has(k))).slice(0, 5);
  if (!siblings.length) return decision;
  const { checkOrderPaymentStatus } = await import("@/lib/payments/order-status.server");
  for (const s of siblings) {
    try { s.status = (await checkOrderPaymentStatus(s.order_number as string)).status; } catch { /* mantém */ }
  }
  decision = decideAttempt(target, rows);
  return decision;
}

/** Envios bem-sucedidos da loja nas últimas 24h, comparados pelo cliente (telefone/CPF/e-mail). */
async function messagedRecently(db: any, storeId: string, o: { id: string; customer: unknown }, now: number) {
  const { alreadyMessagedRecently, RECENT_MESSAGE_WINDOW_MIN } = await import("./pix-purchase-attempt");
  const since = new Date(now - RECENT_MESSAGE_WINDOW_MIN * 60000).toISOString();
  const { data, error } = await db
    .from("whatsapp_pix_reminders")
    .select("order_id, updated_at, orders(customer)")
    .eq("store_id", storeId)
    .eq("status", "enviada")
    .gte("updated_at", since)
    .limit(1000);
  if (error) return true; // na dúvida, não envia de novo
  const sent = (data ?? []).map((r: any) => ({ order_id: r.order_id, sent_at: r.updated_at, customer: r.orders?.customer ?? null }));
  return alreadyMessagedRecently({ id: o.id, customer: o.customer as never }, sent, now);
}
