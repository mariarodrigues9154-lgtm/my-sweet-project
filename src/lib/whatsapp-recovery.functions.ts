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
      delays: z.array(z.number().int().min(1).max(10080)).length(3),
      max_reminders: z.number().int().min(1).max(3),
      public_data: z.record(z.string(), z.string().max(300)),
      secrets: z.record(z.enum(SECRET_KEYS), z.string().max(1000)),
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
