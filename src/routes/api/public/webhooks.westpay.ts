/** WestPay documents no callback signature. Authenticate the transaction through GET before any write. */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/api/public/webhooks/westpay")({
  server: { handlers: { POST: async ({ request }) => {
    const raw = await request.text();
    if (raw.length > 100000) return new Response("payload grande", { status: 413 });
    let json: unknown;
    try { json = JSON.parse(raw); } catch { return new Response("payload inválido", { status: 400 }); }
    const payload = z.object({ Id: z.string().min(1).max(200) }).safeParse(json);
    if (!payload.success) return new Response("payload inválido", { status: 400 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin.from("orders")
      .select("id, store_id, total, status, payment, paid_at")
      .eq("payment_provider", "westpay").eq("transaction_id", payload.data.Id).maybeSingle();
    if (error) return new Response("indisponível", { status: 503 });
    if (!order?.store_id) return new Response("ok");
    const { loadStorePayment, toGatewayConfig } = await import("@/lib/payments/resolve.server");
    const settings = await loadStorePayment(order.store_id);
    if (!settings || settings.provider !== "westpay") return new Response("indisponível", { status: 503 });
    try {
      const { westpay } = await import("@/lib/payments/westpay.server");
      const confirmed = await westpay.getStatus(toGatewayConfig(settings), payload.data.Id);
      const { confirmWestpayOrder } = await import("@/lib/payments/westpay-confirm.server");
      const { sendPurchaseForOrder } = await import("@/lib/meta.server");
      await confirmWestpayOrder(supabaseAdmin, { ...order, total: Number(order.total) }, confirmed, sendPurchaseForOrder);
      console.info("[westpay] webhook", { provider: "westpay", order_id: order.id, store_id: order.store_id, transaction_id: payload.data.Id, provider_status: confirmed.status, at: new Date().toISOString() });
      return new Response("ok");
    } catch { return new Response("confirmação indisponível", { status: 503 }); }
  } } },
});