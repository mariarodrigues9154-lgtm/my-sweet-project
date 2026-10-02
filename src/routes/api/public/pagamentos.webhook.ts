/**
 * Webhook dos gateways de pagamento.
 * Nunca confiamos no corpo recebido: o status é reconfirmado no provedor da
 * loja dona do pedido antes de marcar como pago. Repetições não geram efeito
 * duplicado (idempotente).
 */
import { createFileRoute } from "@tanstack/react-router";

type Payload = {
  type?: string;
  action?: string;
  event?: string;
  data?: { id?: string | number };
  payment?: { id?: string; externalReference?: string };
};

function extractTransactionId(payload: Payload): string | null {
  const candidates = [payload.payment?.id, payload.data?.id];
  for (const value of candidates) {
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return null;
}

export const Route = createFileRoute("/api/public/pagamentos/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: Payload;
        try {
          payload = (await request.json()) as Payload;
        } catch {
          return new Response("payload inválido", { status: 400 });
        }

        const transactionId = extractTransactionId(payload);
        if (!transactionId) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id, status, store_id, payment, payment_provider")
          .eq("transaction_id", transactionId)
          .maybeSingle();

        if (!order || !order.store_id) return new Response("ok");
        if (order.status === "pago") return new Response("ok");

        const { loadStorePayment, toGatewayConfig } = await import("@/lib/payments/resolve.server");
        const row = await loadStorePayment(order.store_id as string);
        if (!row || row.provider === "none") return new Response("ok");

        const { getProvider } = await import("@/lib/payments/providers.server");
        const gateway = getProvider(row.provider);
        if (!gateway) return new Response("ok");

        let result;
        try {
          result = await gateway.getStatus(toGatewayConfig(row), transactionId);
        } catch {
          return new Response("indisponível", { status: 503 });
        }
        if (!result.paid) return new Response("ok");

        const payment = (order.payment ?? {}) as Record<string, unknown>;
        await supabaseAdmin
          .from("orders")
          .update({
            status: "pago",
            paid_at: new Date().toISOString(),
            payment: { ...payment, status: "pago", gateway_status: result.status },
          } as never)
          .eq("id", order.id)
          .neq("status", "pago");
        const { sendPurchaseForOrder } = await import("@/lib/meta.server");
        await sendPurchaseForOrder(order.id as string);

        return new Response("ok");
      },
    },
  },
});
