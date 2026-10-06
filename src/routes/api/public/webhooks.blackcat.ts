/**
 * Webhook da Blackcat (transaction.created / paid / failed). O corpo não é assinado,
 * então o status sempre é reconfirmado em GET /sales/{id}/status com a API Key da loja
 * dona do pedido. Idempotente pelo transactionId + status já gravado.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/blackcat")({
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
        const data = (body["data"] && typeof body["data"] === "object" ? body["data"] : body) as Record<string, unknown>;
        const idRaw = data["transactionId"];
        const transactionId = typeof idRaw === "string" || typeof idRaw === "number" ? String(idRaw).trim().slice(0, 200) : "";
        if (!transactionId) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id, status, store_id, payment, provider_status, paid_at, e2e")
          .eq("payment_provider", "blackcat")
          .eq("transaction_id", transactionId)
          .maybeSingle();
        if (!order || !order.store_id) return new Response("ok");

        const { loadStorePayment, toGatewayConfig } = await import("@/lib/payments/resolve.server");
        const settings = await loadStorePayment(order.store_id as string);
        if (!settings || settings.provider !== "blackcat") return new Response("ok");

        const { getProvider } = await import("@/lib/payments/providers.server");
        const gateway = getProvider("blackcat");
        if (!gateway) return new Response("ok");
        let confirmed;
        try {
          confirmed = await gateway.getStatus(toGatewayConfig(settings), transactionId);
        } catch {
          return new Response("indisponível", { status: 503 });
        }
        const internal = confirmed.status.toLowerCase();
        const event = request.headers.get("x-webhook-event") ?? String(body["event"] ?? "postback");
        console.info("[blackcat] webhook", { order: order.id, event, status: confirmed.status });

        if (order.provider_status === internal) return new Response("ok");
        if (order.status === "pago" && internal !== "refunded") return new Response("ok");

        const payment = (order.payment ?? {}) as Record<string, unknown>;
        const update: Record<string, unknown> = {
          provider_status: internal,
          payment: { ...payment, gateway_status: confirmed.status, status: internal === "paid" ? "pago" : internal },
        };
        if (internal === "paid") {
          update["status"] = "pago";
          if (!order.paid_at) update["paid_at"] = confirmed.paid_at ? new Date(confirmed.paid_at).toISOString() : new Date().toISOString();
          if (confirmed.e2e && !order.e2e) update["e2e"] = confirmed.e2e;
        } else if (internal === "refunded") {
          update["status"] = "reembolsado";
        } else if (internal === "cancelled") {
          // PIX cancelado/expirado: o código antigo deixa de valer na tela.
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
