/**
 * VenusPay webhook. Signed with HMAC-SHA256 (X-Venuspay-Signature) using the store's webhook
 * secret; regardless, the status is always reconfirmed via GET /check-payment-status before writes.
 * Paid transition is conditional on status = aguardando_pagamento (idempotent).
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  event: z.string().max(60),
  data: z.object({ transaction_id: z.string().min(1).max(200), amount: z.number().optional(), metadata: z.record(z.string(), z.unknown()).optional() }),
});

export const Route = createFileRoute("/api/public/webhooks/venuspay")({
  server: { handlers: { POST: async ({ request }) => {
    const raw = await request.text();
    if (raw.length > 1_000_000) return new Response("payload grande", { status: 413 });
    let json: unknown;
    try { json = JSON.parse(raw); } catch { return new Response("payload inválido", { status: 400 }); }
    const parsed = schema.safeParse(json);
    if (!parsed.success) return new Response("ok");
    const txId = parsed.data.data.transaction_id;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin.from("orders")
      .select("id, store_id, total, status, payment, paid_at, provider_status")
      .eq("payment_provider", "venuspay").eq("transaction_id", txId).maybeSingle();
    if (error) return new Response("indisponível", { status: 503 });
    if (!order?.store_id) return new Response("ok");

    const { loadStorePayment, toGatewayConfig } = await import("@/lib/payments/resolve.server");
    const settings = await loadStorePayment(order.store_id, "venuspay");
    if (!settings || settings.provider !== "venuspay") return new Response("ok");
    const { venuspay, verifyVenuspaySignature } = await import("@/lib/payments/venuspay.server");
    const config = toGatewayConfig(settings);
    const secret = config.secrets["webhook_secret"] ?? "";
    if (secret && !(await verifyVenuspaySignature(raw, request.headers.get("x-venuspay-signature"), secret))) {
      return new Response("invalid signature", { status: 401 });
    }
    // Signed body must belong to this order and amount.
    const meta = parsed.data.data.metadata;
    if (meta?.["order_id"] && meta["order_id"] !== order.id) return new Response("ok");
    if (typeof parsed.data.data.amount === "number" && Math.round(parsed.data.data.amount * 100) !== Math.round(Number(order.total) * 100)) return new Response("ok");

    let confirmed;
    try { confirmed = await venuspay.getStatus(config, txId); } catch { return new Response("indisponível", { status: 503 }); }
    console.info("[venuspay] webhook", JSON.stringify({ order_id: order.id, store_id: order.store_id, event: parsed.data.event, status: confirmed.status }));
    if (order.provider_status === confirmed.status || confirmed.status === "unknown") return new Response("ok");

    const payment = (order.payment ?? {}) as Record<string, unknown>;
    const update: Record<string, unknown> = { provider_status: confirmed.status, payment: { ...payment, gateway_status: confirmed.status, status: confirmed.paid ? "pago" : confirmed.status } };
    let q;
    if (confirmed.paid) {
      update["status"] = "pago";
      update["paid_at"] = order.paid_at ?? new Date().toISOString();
      q = supabaseAdmin.from("orders").update(update as never).eq("id", order.id).eq("status", "aguardando_pagamento").select("id");
    } else if (confirmed.status === "refunded" || confirmed.status === "chargeback") {
      update["status"] = confirmed.status === "refunded" ? "reembolsado" : "contestado";
      q = supabaseAdmin.from("orders").update(update as never).eq("id", order.id).select("id");
    } else {
      if (order.status !== "aguardando_pagamento") return new Response("ok");
      q = supabaseAdmin.from("orders").update(update as never).eq("id", order.id).eq("status", "aguardando_pagamento").select("id");
    }
    const { data: changed } = await q;
    if (confirmed.paid && changed && changed.length > 0) {
      const { sendPurchaseForOrder } = await import("@/lib/meta.server");
      await sendPurchaseForOrder(order.id);
    }
    return new Response("ok");
  } } },
});
