import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !data) throw new Error("Acesso restrito ao administrador.");
}

const storeInput = z.object({ store_id: z.string().uuid() });
export const DELIVERY_STATUSES = ["aguardando_postagem", "postado", "em_transito", "saiu_para_entrega", "entregue", "devolvido", "problema"] as const;

export const getStoreMagnus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => storeInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row } = await context.supabase.from("store_magnus_settings").select("enabled, api_token").eq("store_id", data.store_id).maybeSingle();
    return { enabled: !!row?.enabled, token_configured: !!row?.api_token };
  });

export const saveStoreMagnus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => storeInput.extend({ enabled: z.boolean(), api_token: z.string().trim().max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: cur } = await context.supabase.from("store_magnus_settings").select("api_token").eq("store_id", data.store_id).maybeSingle();
    const token = data.api_token || cur?.api_token || null;
    if (data.enabled && !token) return { ok: false as const, error: "Cole o token da Magnus Frete para ativar." };
    const { error } = await context.supabase.from("store_magnus_settings")
      .upsert({ store_id: data.store_id, enabled: data.enabled, api_token: token, updated_at: new Date().toISOString() });
    if (error) return { ok: false as const, error: "Não foi possível salvar." };
    return { ok: true as const };
  });

/** Pedidos pagos da loja (30 dias) com a situação do envio. */
export const listStoreShipments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => storeInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const { data: orders } = await context.supabase.from("orders")
      .select("id, order_number, paid_at, created_at, total, customer, product_snapshot")
      .eq("store_id", data.store_id).eq("status", "pago").gte("created_at", since)
      .order("created_at", { ascending: false }).limit(200);
    const ids = (orders ?? []).map((o: { id: string }) => o.id);
    const { data: ships } = ids.length
      ? await context.supabase.from("order_shipments").select("order_id, send_status, tracking_code, delivery_status, error, attempts, sent_at, updated_at").in("order_id", ids)
      : { data: [] };
    const byOrder = new Map((ships ?? []).map((s: { order_id: string }) => [s.order_id, s]));
    return (orders ?? []).map((o: any) => ({
      id: o.id as string, order_number: o.order_number as string, paid_at: (o.paid_at ?? o.created_at) as string, total: Number(o.total),
      customer: String(o.customer?.name ?? ""), product: String(o.product_snapshot?.title ?? ""),
      shipment: (byOrder.get(o.id) ?? null) as null | { send_status: string; tracking_code: string | null; delivery_status: string; error: string | null; attempts: number; sent_at: string | null },
    }));
  });

async function orderOfStore(context: { supabase: any }, orderId: string, storeId: string) {
  const { data } = await context.supabase.from("orders").select("id, status").eq("id", orderId).eq("store_id", storeId).maybeSingle();
  if (!data) throw new Error("Pedido não pertence a esta loja.");
  return data as { id: string; status: string };
}

export const sendMagnusShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => storeInput.extend({ order_id: z.string().uuid(), force: z.boolean().default(false) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    await orderOfStore(context, data.order_id, data.store_id);
    const { syncMagnusOrder } = await import("./magnus.server");
    return syncMagnusOrder(data.order_id, { retry: true, force: data.force });
  });

export const sendPendingMagnus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => storeInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const { data: orders } = await context.supabase.from("orders").select("id").eq("store_id", data.store_id).eq("status", "pago").gte("created_at", since).limit(200);
    const ids = (orders ?? []).map((o: { id: string }) => o.id);
    const { data: ships } = ids.length ? await context.supabase.from("order_shipments").select("order_id").in("order_id", ids) : { data: [] };
    const done = new Set((ships ?? []).map((s: { order_id: string }) => s.order_id));
    const { syncMagnusOrder } = await import("./magnus.server");
    let sent = 0, failed = 0;
    for (const id of ids.filter((i: string) => !done.has(i))) { const r = await syncMagnusOrder(id); r.ok ? sent++ : failed++; }
    return { sent, failed };
  });

/** Edição manual: código informado à mão e/ou status de entrega. */
export const updateShipment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => storeInput.extend({
    order_id: z.string().uuid(),
    tracking_code: z.string().trim().max(60).regex(/^[A-Za-z0-9\-]*$/, "Código inválido").optional(),
    delivery_status: z.enum(DELIVERY_STATUSES).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const order = await orderOfStore(context, data.order_id, data.store_id);
    if (order.status !== "pago") throw new Error("Só pedidos pagos recebem rastreio.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cur } = await supabaseAdmin.from("order_shipments").select("id, store_id, send_status").eq("order_id", order.id).maybeSingle();
    if (cur && cur.store_id !== data.store_id) throw new Error("Envio vinculado a outra loja.");
    if (cur?.send_status === "enviando") throw new Error("Envio em andamento, aguarde.");
    const patch: Record<string, unknown> = {};
    if (data.delivery_status) patch["delivery_status"] = data.delivery_status;
    if (data.tracking_code) {
      const { data: dup } = await supabaseAdmin.from("order_shipments").select("order_id").eq("tracking_code", data.tracking_code.toUpperCase()).neq("order_id", order.id).limit(1);
      if (dup?.length) throw new Error("Este código já está em outro pedido.");
      Object.assign(patch, { tracking_code: data.tracking_code.toUpperCase(), error: null });
      if (!cur || cur.send_status !== "enviado") patch["send_status"] = "manual";
    }
    if (!Object.keys(patch).length) return { ok: true };
    if (cur) await supabaseAdmin.from("order_shipments").update(patch).eq("id", cur.id);
    else {
      if (!data.tracking_code) throw new Error("Informe o código de rastreio.");
      await supabaseAdmin.from("order_shipments").insert({ order_id: order.id, store_id: data.store_id, provider: "manual", ...patch } as never);
    }
    return { ok: true };
  });
