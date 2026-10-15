/**
 * Webhook da InvictusPay (X-Webhook-Event: EVENT:CHARGE_*). O corpo não é assinado,
 * então o status sempre é reconfirmado em GET /transactions/{id} com a API Key da loja
 * dona do pedido. Idempotente pelo transaction.id + status já gravado.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/invictuspay")({
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
        const event = request.headers.get("x-webhook-event") ?? String(body["event"] ?? "");
        if (!event.startsWith("EVENT:CHARGE_")) return new Response("ok");
        const tx = (body["transaction"] ?? {}) as Record<string, unknown>;
        const idRaw = tx["id"];
        const transactionId = typeof idRaw === "string" || typeof idRaw === "number" ? String(idRaw).trim().slice(0, 200) : "";
        if (!transactionId) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id, status, store_id, payment, provider_status, paid_at, total_amount_cents")
          .eq("payment_provider", "invictuspay")
          .eq("transaction_id", transactionId)
          .maybeSingle();
        if (!order || !order.store_id) return new Response("ok");

        const { loadStorePayment, toGatewayConfig } = await import("@/lib/payments/resolve.server");
        const settings = await loadStorePayment(order.store_id as string);
        if (!settings || settings.provider !== "invictuspay") return new Response("ok");

        const { getProvider } = await import("@/lib/payments/providers.server");
        const gateway = getProvider("invictuspay");
        if (!gateway) return new Response("ok");
        let confirmed;
        try {
          confirmed = await gateway.getStatus(toGatewayConfig(settings), transactionId);
        } catch {
          return new Response("indisponível", { status: 503 });
        }
        const internal = confirmed.status;
        console.info("[invictuspay] webhook", { order: order.id, event, status: internal });

        if (internal === "unknown" || order.provider_status === internal) return new Response("ok");
        if (order.status === "pago" && !["refunded", "chargeback"].includes(internal)) return new Response("ok");
        // Valor pago precisa bater com o pedido.
        const expected = order.total_amount_cents as number | null;
        if (internal === "paid" && expected && typeof tx["amount"] === "number" && tx["amount"] !== expected) {
          console.error("[invictuspay] valor divergente", { order: order.id });
          return new Response("ok");
        }

        const payment = (order.payment ?? {}) as Record<string, unknown>;
        const update: Record<string, unknown> = {
          provider_status: internal,
          payment: { ...payment, gateway_status: internal, status: internal === "paid" ? "pago" : internal },
        };
        if (internal === "paid") {
          update["status"] = "pago";
          if (!order.paid_at) update["paid_at"] = confirmed.paid_at ? new Date(confirmed.paid_at).toISOString() : new Date().toISOString();
        } else if (internal === "refunded" || internal === "chargeback") {
          update["status"] = "reembolsado";
        } else if (internal === "expired" || internal === "cancelled") {
          update["pix_expiration_date"] = new Date().toISOString();
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
