import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !data) throw new Error("Acesso restrito ao administrador.");
}

export type RefundRow = {
  id: string;
  amount_cents: number;
  reason: string | null;
  status: string;
  provider: string | null;
  provider_status: string | null;
  error: string | null;
  created_at: string;
};

export const listOrderRefunds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { order_number: string }) => z.object({ order_number: z.string().min(4).max(64) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status, total_amount_cents, total, payment_provider")
      .eq("order_number", data.order_number)
      .maybeSingle();
    if (!order) throw new Error("Pedido não encontrado.");
    const { data: rows } = await supabaseAdmin
      .from("order_refunds" as never)
      .select("id, amount_cents, reason, status, provider, provider_status, error, created_at")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false });
    const refunds = (rows ?? []) as unknown as RefundRow[];
    const totalCents = (order.total_amount_cents as number | null) ?? Math.round(Number(order.total) * 100);
    const committed = refunds.filter((r) => r.status !== "falhou").reduce((n, r) => n + r.amount_cents, 0);
    return { order_status: order.status as string, total_cents: totalCents, available_cents: Math.max(0, totalCents - committed), refunds };
  });

export const requestRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { order_number: string; amount_cents: number; reason?: string }) =>
    z.object({
      order_number: z.string().min(4).max(64),
      amount_cents: z.number().int().positive().max(100_000_000),
      reason: z.string().trim().max(300).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status, store_id, transaction_id, total, total_amount_cents, payment_provider")
      .eq("order_number", data.order_number)
      .maybeSingle();
    if (!order) return { ok: false as const, error: "Pedido não encontrado." };
    if (order.status !== "pago" && order.status !== "reembolso_parcial") return { ok: false as const, error: "Só é possível reembolsar pedidos pagos." };
    if (!order.transaction_id || !order.store_id) return { ok: false as const, error: "Pedido sem transação PIX registrada." };

    const { data: prev } = await supabaseAdmin.from("order_refunds" as never).select("amount_cents, status").eq("order_id", order.id);
    const totalCents = (order.total_amount_cents as number | null) ?? Math.round(Number(order.total) * 100);
    const committed = ((prev ?? []) as Array<{ amount_cents: number; status: string }>).filter((r) => r.status !== "falhou").reduce((n, r) => n + r.amount_cents, 0);
    if (((prev ?? []) as Array<{ status: string }>).some((r) => r.status === "processando" || r.status === "solicitado")) {
      return { ok: false as const, error: "Já existe um reembolso em andamento para este pedido." };
    }
    if (data.amount_cents > totalCents - committed) return { ok: false as const, error: "Valor maior que o disponível para reembolso." };

    const { data: created, error: insErr } = await supabaseAdmin
      .from("order_refunds" as never)
      .insert({ order_id: order.id, store_id: order.store_id, amount_cents: data.amount_cents, reason: data.reason ?? null, status: "processando", provider: order.payment_provider, requested_by: context.userId } as never)
      .select("id")
      .single();
    if (insErr || !created) return { ok: false as const, error: "Não foi possível registrar o reembolso." };
    const refundId = (created as { id: string }).id;

    const { loadStorePayment, toGatewayConfig } = await import("@/lib/payments/resolve.server");
    const { getProvider } = await import("@/lib/payments/providers.server");
    const settings = await loadStorePayment(order.store_id as string);
    const gateway = settings ? getProvider(settings.provider) : null;
    const update = (patch: Record<string, unknown>) => supabaseAdmin.from("order_refunds" as never).update(patch as never).eq("id", refundId);

    if (!settings || !gateway?.refund) {
      await update({ status: "manual", provider_status: "sem_api", error: "Faça o estorno no painel do provedor; a confirmação chega pelo aviso de pagamento." });
      return { ok: true as const, manual: true };
    }
    try {
      const result = await gateway.refund(toGatewayConfig(settings), order.transaction_id as string, data.amount_cents, refundId);
      if (!result.ok) {
        await update({ status: "falhou", error: result.error });
        return { ok: false as const, error: result.error };
      }
      await update({ status: result.done ? "concluido" : "processando", provider_refund_id: result.refund_id, provider_status: result.status });
      if (result.done) {
        const full = committed + data.amount_cents >= totalCents;
        await supabaseAdmin.from("orders").update({ status: full ? "reembolsado" : "reembolso_parcial" } as never).eq("id", order.id);
      }
      return { ok: true as const, manual: false };
    } catch {
      await update({ status: "falhou", error: "O provedor não respondeu." });
      return { ok: false as const, error: "O provedor não respondeu. Tente novamente." };
    }
  });

/** Reconsulta o provedor para reembolsos em andamento. */
export const refreshRefunds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { order_number: string }) => z.object({ order_number: z.string().min(4).max(64) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, status, store_id, transaction_id, total, total_amount_cents")
      .eq("order_number", data.order_number)
      .maybeSingle();
    if (!order?.transaction_id || !order.store_id) return { ok: true };
    const { data: rows } = await supabaseAdmin.from("order_refunds" as never).select("id, status").eq("order_id", order.id);
    const pending = ((rows ?? []) as Array<{ id: string; status: string }>).filter((r) => r.status === "processando" || r.status === "manual");
    // Pedido já marcado como reembolsado pelo aviso do provedor.
    if (order.status === "reembolsado") {
      for (const r of pending) await supabaseAdmin.from("order_refunds" as never).update({ status: "concluido" } as never).eq("id", r.id);
      return { ok: true };
    }
    if (pending.length === 0) return { ok: true };
    const { loadStorePayment, toGatewayConfig } = await import("@/lib/payments/resolve.server");
    const { getProvider } = await import("@/lib/payments/providers.server");
    const settings = await loadStorePayment(order.store_id as string);
    const gateway = settings ? getProvider(settings.provider) : null;
    if (!settings || !gateway) return { ok: true };
    try {
      const st = await gateway.getStatus(toGatewayConfig(settings), order.transaction_id as string);
      const s = st.status.toUpperCase();
      if (s === "REFUNDED" || s === "REFUNDS" || s === "PARTIALLY_REFUNDED") {
        for (const r of pending) await supabaseAdmin.from("order_refunds" as never).update({ status: "concluido", provider_status: st.status } as never).eq("id", r.id);
        await supabaseAdmin.from("orders").update({ status: s === "PARTIALLY_REFUNDED" ? "reembolso_parcial" : "reembolsado" } as never).eq("id", order.id);
      }
    } catch {
      /* mantém como está */
    }
    return { ok: true };
  });
