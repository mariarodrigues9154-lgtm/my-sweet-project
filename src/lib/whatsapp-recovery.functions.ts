import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !data) throw new Error("Acesso restrito ao administrador.");
}

const SECRET_KEYS = ["access_token", "client_token", "instance_token", "api_key"] as const;

export const getWhatsappRecovery = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ store_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("store_whatsapp_settings").select("*").eq("store_id", data.store_id).maybeSingle();
    const secrets = (row?.secret_data ?? {}) as Record<string, string>;
    const start = new Date(); start.setUTCHours(3, 0, 0, 0); if (start.getTime() > Date.now()) start.setUTCDate(start.getUTCDate() - 1); // meia-noite de Brasília
    const since = start.toISOString();
    const [{ data: logs }, { count: pending }] = await Promise.all([
      supabaseAdmin.from("whatsapp_pix_reminders").select("id, order_id, step, status, detail, phone_masked, pix_status, created_at, orders(order_number, customer, status, paid_at)").eq("store_id", data.store_id).neq("status", "ignorado").order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("orders").select("id", { count: "exact", head: true }).eq("store_id", data.store_id).eq("status", "aguardando_pagamento").gte("created_at", since),
    ]);
    const { data: todaySent } = await supabaseAdmin.from("whatsapp_pix_reminders").select("order_id, updated_at, orders(paid_at)").eq("store_id", data.store_id).eq("status", "enviada").gte("updated_at", since);
    const recovered = new Set((todaySent ?? []).filter((l) => { const p = (l.orders as { paid_at?: string } | null)?.paid_at; return p && new Date(p) > new Date(l.updated_at as string); }).map((l) => l.order_id)).size;
    return {
      settings: {
        enabled: row?.enabled ?? false,
        provider: (row?.provider as string) ?? "meta",
        sender: (row?.sender as string) ?? "",
        message: (row?.message as string) || "Olá, {nome}! 👋\nVimos que o pagamento via PIX do seu pedido #{pedido} ainda está pendente.\nValor: {valor}\nVocê pode continuar de onde parou por aqui: {link_pagamento}",
        delays: ((row?.delays as number[]) ?? [15, 60, 180]).concat([15, 60, 180]).slice(0, 3),
        max_reminders: (row?.max_reminders as number) ?? 1,
        public_data: (row?.public_data ?? {}) as Record<string, string>,
        secrets_set: Object.fromEntries(SECRET_KEYS.map((k) => [k, Boolean(secrets[k])])),
      },
      summary: { pending: pending ?? 0, sent: todaySent?.length ?? 0, recovered },
      logs: (logs ?? []).map((l) => {
        const o = l.orders as { order_number?: string; customer?: { name?: string } } | null;
        return { id: l.id, order_number: o?.order_number ?? "", customer: o?.customer?.name ?? "", phone: l.phone_masked, step: l.step, status: l.status, detail: l.detail, pix_status: l.pix_status, at: l.created_at };
      }),
    };
  });

export const saveWhatsappRecovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      store_id: z.string().uuid(),
      enabled: z.boolean(),
      provider: z.enum(["meta", "zapi", "evolution"]),
      sender: z.string().trim().max(40),
      message: z.string().max(2000),
      delays: z.array(z.number().int().min(1).max(10080)).min(1).max(3),
      max_reminders: z.number().int().min(1).max(3),
      public_data: z.record(z.string(), z.string().max(2000)),
      secrets: z.record(z.string(), z.string().max(1000)).transform((s) =>
        Object.fromEntries(Object.entries(s).filter(([k]) => (SECRET_KEYS as readonly string[]).includes(k)))),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("store_whatsapp_settings").select("secret_data, enabled").eq("store_id", data.store_id).maybeSingle();
    const secret_data = { ...((row?.secret_data ?? {}) as Record<string, string>) };
    for (const [k, v] of Object.entries(data.secrets)) if (v.trim()) secret_data[k] = v.trim();
    const payload = {
      store_id: data.store_id, enabled: data.enabled, provider: data.provider, sender: data.sender, message: data.message,
      delays: data.delays, max_reminders: data.max_reminders, public_data: data.public_data, secret_data,
      ...(row && row.enabled === data.enabled ? {} : { updated_at: new Date().toISOString() }),
    };
    const { error } = await supabaseAdmin.from("store_whatsapp_settings").upsert(payload as never, { onConflict: "store_id" });
    if (error) return { ok: false as const, error: "Não foi possível salvar." };
    return { ok: true as const };
  });

/** Envia uma mensagem de teste para um número informado pelo administrador. */
export const testWhatsappRecovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ store_id: z.string().uuid(), phone: z.string().max(30) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { normalizeBrPhone, sendWhatsApp, fillTemplate } = await import("./whatsapp-recovery.server");
    const to = normalizeBrPhone(data.phone);
    if (!to) return { ok: false, message: "Telefone inválido." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("store_whatsapp_settings").select("*").eq("store_id", data.store_id).maybeSingle();
    if (!row) return { ok: false, message: "Salve a configuração primeiro." };
    const vars = { nome: "Teste", pedido: "TESTE", produto: "Produto de teste", valor: "R$ 1,00", pix: "", link_pagamento: "https://www.achados-tik.shop", nome_loja: "Loja" };
    try {
      await sendWhatsApp({ provider: row.provider as never, secrets: row.secret_data as never, pub: row.public_data as never, to, text: fillTemplate(row.message as string, vars), vars, token: "teste" });
      return { ok: true, message: "Mensagem de teste enviada." };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Falha no envio." };
    }
  });

const DEFAULT_MANUAL = "Olá, {nome}! 👋\n\nVi que o pagamento via PIX do seu pedido #{pedido} ainda está pendente.\n\nValor: {valor}\n\nSe precisar continuar o pagamento, acesse:\n{link_pagamento}";

async function loadManualContext(orderId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: o } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, status, store_id, customer, product_snapshot, total, payment, pix_expiration_date, access_token")
    .eq("id", orderId)
    .maybeSingle();
  if (!o?.store_id) return null;
  const [{ data: cfg }, { data: store }] = await Promise.all([
    supabaseAdmin.from("store_whatsapp_settings").select("*").eq("store_id", o.store_id).maybeSingle(),
    supabaseAdmin.from("store_settings").select("name").eq("id", o.store_id).maybeSingle(),
  ]);
  const { DEFAULT_SITE, fillTemplate, normalizeBrPhone } = await import("./whatsapp-recovery.server");
  const pub = (cfg?.public_data ?? {}) as Record<string, string>;
  const pay = (o.payment ?? {}) as { copy_paste?: string; expiration_date?: string };
  const exp = (o.pix_expiration_date as string | null) ?? pay.expiration_date ?? null;
  const expired = !!exp && new Date(exp).getTime() <= Date.now();
  const site = (pub["site_url"] || DEFAULT_SITE).replace(/\/+$/, "");
  const name = String((o.customer as { name?: string })?.name ?? "").trim().split(/\s+/)[0] || "cliente";
  const vars = {
    nome: name,
    pedido: String(o.order_number),
    produto: ((o.product_snapshot ?? {}) as { title?: string }).title ?? "",
    valor: Number(o.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    pix: expired ? "" : pay.copy_paste ?? "",
    link_pagamento: `${site}/pix/${o.access_token}`,
    nome_loja: (store?.name as string) ?? "",
  };
  const text = fillTemplate(pub["manual_message"] || (cfg?.message as string) || DEFAULT_MANUAL, vars);
  return { o, cfg, pub, vars, text, expired, phone: normalizeBrPhone((o.customer as { phone?: string })?.phone), supabaseAdmin };
}

/** Pedidos PIX da loja com eventos de recuperação e histórico de WhatsApp (somente admin). */
export const listPixRecoveryOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ store_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: events } = await supabaseAdmin.from("pix_recovery_events").select("order_id, event_type, created_at").eq("store_id", data.store_id).limit(20000);
    const evIds = [...new Set((events ?? []).map((e) => e.order_id as string))];
    const cols = "id, order_number, status, customer, product_snapshot, total, payment, pix_expiration_date, created_at, paid_at, transaction_id";
    const { data: pending } = await supabaseAdmin.from("orders").select(cols).eq("store_id", data.store_id).eq("status", "aguardando_pagamento").not("transaction_id", "is", null).gte("created_at", since).order("created_at", { ascending: false }).limit(200);
    const map = new Map<string, any>((pending ?? []).map((o) => [o.id as string, o]));
    const missing = evIds.filter((id) => !map.has(id));
    for (let i = 0; i < missing.length; i += 200) {
      const { data: rows } = await supabaseAdmin.from("orders").select(cols).in("id", missing.slice(i, i + 200));
      for (const r of rows ?? []) map.set(r.id as string, r);
    }
    const ids = [...map.keys()];
    const logs: any[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const { data: rows } = await supabaseAdmin.from("whatsapp_pix_reminders").select("order_id, step, status, detail, updated_at").in("order_id", ids.slice(i, i + 200)).neq("status", "ignorado");
      logs.push(...(rows ?? []));
    }
    const now = Date.now();
    return [...map.values()].map((o) => {
      const ev = (events ?? []).filter((e) => e.order_id === o.id);
      const last = ev.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
      const wa = logs.filter((l) => l.order_id === o.id).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
      const pay = (o.payment ?? {}) as { expiration_date?: string };
      const exp = o.pix_expiration_date ?? pay.expiration_date ?? null;
      const paid = o.status === "pago" || o.status === "aprovado";
      const state = paid ? "pago" : o.status === "aguardando_pagamento" ? (exp && new Date(exp).getTime() <= now ? "expirado" : "pendente") : "outro";
      const phone = String((o.customer as { phone?: string })?.phone ?? "").replace(/\D/g, "");
      return {
        id: o.id as string,
        order_number: o.order_number as string,
        customer: String((o.customer as { name?: string })?.name ?? ""),
        phone: phone ? `(${phone.slice(-11, -9) || "--"}) *****-${phone.slice(-4)}` : "—",
        phone_digits_tail: phone.slice(-4),
        total: Number(o.total),
        product: ((o.product_snapshot ?? {}) as { title?: string }).title ?? "",
        created_at: o.created_at as string,
        state,
        events: [...new Set(ev.map((e) => e.event_type as string))],
        recovered: paid && ev.length > 0,
        last_action: last ? { type: last.event_type as string, at: last.created_at as string } : null,
        whatsapp: wa ? { status: wa.status as string, detail: (wa.detail as string | null) ?? null, at: wa.updated_at as string, manual: Number(wa.step) >= 100 } : null,
      };
    }).sort((a, b) => b.created_at.localeCompare(a.created_at));
  });

/** Prévia da mensagem manual com os dados reais do pedido. */
export const previewManualPixMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const c = await loadManualContext(data.order_id);
    if (!c) return { ok: false as const, error: "Pedido não encontrado." };
    if (!c.cfg) return { ok: false as const, error: "WhatsApp não configurado para esta loja." };
    return { ok: true as const, text: c.text, name: c.vars.nome, expired: c.expired, has_phone: !!c.phone };
  });

/** Envio manual (um pedido por vez) pelo WhatsApp da loja dona do pedido. Reconfirma o status antes. */
export const sendManualPixRecoveryMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const c = await loadManualContext(data.order_id);
    if (!c) return { ok: false as const, error: "Pedido não encontrado." };
    if (!c.cfg) return { ok: false as const, error: "WhatsApp não configurado para esta loja." };
    let status = c.o.status as string;
    try {
      const { checkOrderPaymentStatus } = await import("@/lib/payments/order-status.server");
      status = (await checkOrderPaymentStatus(c.o.order_number as string)).status;
    } catch { /* mantém */ }
    if (status === "pago" || status === "aprovado") return { ok: false as const, error: "Este pedido já foi pago. Mensagem de PIX pendente não enviada." };
    if (status !== "aguardando_pagamento") return { ok: false as const, error: `Pedido com status ${status}. Mensagem não enviada.` };
    if (c.expired) return { ok: false as const, error: "Este PIX expirou." };
    if (!c.phone) return { ok: false as const, error: "Telefone do cliente inválido." };
    const { maskPhoneTail, sendWhatsApp } = await import("./whatsapp-recovery.server");
    const { data: prev } = await c.supabaseAdmin.from("whatsapp_pix_reminders").select("step").eq("order_id", c.o.id).gte("step", 100);
    const step = 100 + Math.max(0, ...(prev ?? []).map((p) => Number(p.step) - 99));
    const { data: row } = await c.supabaseAdmin.from("whatsapp_pix_reminders")
      .insert({ store_id: c.o.store_id, order_id: c.o.id, step, phone_masked: maskPhoneTail(c.phone), detail: `manual_pix_recovery · admin ${context.userId}` })
      .select("id").maybeSingle();
    if (!row) return { ok: false as const, error: "Envio já em andamento. Tente novamente." };
    const at = new Date().toISOString();
    try {
      const id = await sendWhatsApp({ provider: c.cfg.provider as never, secrets: (c.cfg.secret_data ?? {}) as Record<string, string>, pub: c.pub, to: c.phone, text: c.text, vars: c.vars, token: c.o.access_token as string });
      await c.supabaseAdmin.from("whatsapp_pix_reminders").update({ status: "enviada", pix_status: "PENDING", provider_message_id: id, updated_at: at }).eq("id", row.id);
      return { ok: true as const, at };
    } catch (e) {
      const msg = (e instanceof Error ? e.message : "Falha no envio").slice(0, 500);
      await c.supabaseAdmin.from("whatsapp_pix_reminders").update({ status: "falha", detail: `manual_pix_recovery · ${msg}`, pix_status: "PENDING", updated_at: at }).eq("id", row.id);
      return { ok: false as const, error: "Falha no envio pelo WhatsApp. Tente novamente." };
    }
  });
