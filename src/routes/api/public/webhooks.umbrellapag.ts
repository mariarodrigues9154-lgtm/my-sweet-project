/**
 * Webhook da UmbrellaPag. O postback ({ objectId, data: { status, endToEndId, paidAt, ... } })
 * não é assinado, então o corpo nunca é confiável: o status é sempre reconfirmado em
 * GET /user/transactions/{id} com a API Key da loja dona do pedido. Idempotente.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/umbrellapag")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > 1_000_000) return new Response("payload grande", { status: 413 });
        let body: Record<string, unknown>;
        try {
          body = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return new Response("payload inválido", { status: 400 });
        }
        const idRaw = body["objectId"] ?? body["id"];
        const transactionId = typeof idRaw === "string" || typeof idRaw === "number" ? String(idRaw).trim().slice(0, 200) : "";
        if (!transactionId) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id, status, store_id, payment, provider_status, paid_at")
          .eq("payment_provider", "umbrellapag")
          .eq("transaction_id", transactionId)
          .maybeSingle();
        if (!order || !order.store_id) return new Response("ok");

        const { loadStorePayment, toGatewayConfig } = await import("@/lib/payments/resolve.server");
        const settings = await loadStorePayment(order.store_id as string, "umbrellapag");
        if (!settings || settings.provider !== "umbrellapag") return new Response("ok");

        const { getProvider } = await import("@/lib/payments/providers.server");
        const gateway = getProvider("umbrellapag");
        if (!gateway) return new Response("ok");
        let confirmed;
        try {
          confirmed = await gateway.getStatus(toGatewayConfig(settings), transactionId);
        } catch {
          return new Response("indisponível", { status: 503 });
        }
        const internal = confirmed.status.toLowerCase();
        console.info("[umbrellapag] webhook", { order: order.id, status: confirmed.status });

        // Idempotência: mesmo status já processado ou pedido pago sem estorno/contestação.
        if (order.provider_status === internal) return new Response("ok");
        if (order.status === "pago" && !["refunded", "chargeback"].includes(internal)) return new Response("ok");

        const payment = (order.payment ?? {}) as Record<string, unknown>;
        const update: Record<string, unknown> = {
          provider_status: internal,
          payment: {
            ...payment,
            gateway_status: confirmed.status,
            status: internal === "paid" ? "pago" : internal,
            ...(confirmed.e2e ? { end_to_end_id: confirmed.e2e } : {}),
          },
        };
        if (internal === "paid") {
          update["status"] = "pago";
          if (!order.paid_at) update["paid_at"] = confirmed.paid_at ? new Date(confirmed.paid_at).toISOString() : new Date().toISOString();
        } else if (internal === "refunded" || internal === "chargeback") {
          update["status"] = internal === "refunded" ? "reembolsado" : "contestado";
        }
        await supabaseAdmin.from("orders").update(update as never).eq("id", order.id);
        if (internal === "paid") {
          const { sendPurchaseForOrder } = await import("@/lib/meta.server");
          await sendPurchaseForOrder(order.id as string);
        }
        return new Response("ok");
      },
    },
  },
});
