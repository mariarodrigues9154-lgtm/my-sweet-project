/**
 * Webhook da Wappi Brasil. O corpo recebido não é confiável: o status é
 * reconfirmado na Wappi com as credenciais da loja dona do pedido.
 * Idempotente — repetições do mesmo status não geram efeito.
 * Obs.: no webhook "Amount" vem em reais; não usamos esse valor (dinheiro é mantido em centavos).
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payloadSchema = z
  .object({
    Id: z.union([z.string(), z.number()]).transform((v) => String(v).trim()).pipe(z.string().min(1).max(200)),
    Status: z.string().max(40).optional(),
  })
  .passthrough();

const KNOWN = new Set(["PENDING", "PAID", "REFUNDED", "REFUSED", "CHARGEBACK", "PRECHARGEBACK", "EXPIRED", "ERROR"]);

export const Route = createFileRoute("/api/public/webhooks/wappi")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed;
        try {
          parsed = payloadSchema.safeParse(await request.json());
        } catch {
          return new Response("payload inválido", { status: 400 });
        }
        if (!parsed.success) return new Response("payload inválido", { status: 400 });
        const transactionId = parsed.data.Id;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id, status, store_id, payment, provider_status, e2e, paid_at")
          .eq("payment_provider", "wappi")
          .eq("transaction_id", transactionId)
          .maybeSingle();
        if (!order || !order.store_id) return new Response("ok");

        const { loadStorePayment, toGatewayConfig } = await import("@/lib/payments/resolve.server");
        const settings = await loadStorePayment(order.store_id as string);
        if (!settings || settings.provider !== "wappi") return new Response("ok");

        const { getProvider } = await import("@/lib/payments/providers.server");
        const gateway = getProvider("wappi");
        if (!gateway) return new Response("ok");

        let confirmed;
        try {
          confirmed = await gateway.getStatus(toGatewayConfig(settings), transactionId);
        } catch {
          return new Response("indisponível", { status: 503 });
        }
        const status = KNOWN.has(confirmed.status) ? confirmed.status : "ERROR";
        const internal = status.toLowerCase();

        // Pedido pago só muda por estorno/chargeback; status repetido é ignorado.
        if (order.provider_status === internal && (!confirmed.e2e || order.e2e === confirmed.e2e)) return new Response("ok");
        if (order.status === "pago" && !["refunded", "chargeback", "prechargeback"].includes(internal)) return new Response("ok");

        const payment = (order.payment ?? {}) as Record<string, unknown>;
        const update: Record<string, unknown> = {
          provider_status: internal,
          payment: { ...payment, gateway_status: status, status: internal === "paid" ? "pago" : internal },
        };
        if (confirmed.e2e) update["e2e"] = confirmed.e2e;
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
