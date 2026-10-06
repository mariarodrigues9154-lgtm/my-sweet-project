/**
 * Webhook da PinPay. Aceita o postback do pedido (JSON plano, sem assinatura) e
 * os webhooks da conta (envelope { event, data } + X-Webhook-Signature HMAC-SHA256).
 * O corpo nunca é confiável: o status é reconfirmado em GET /transactions/{id}
 * com a Secret Key da loja dona do pedido. Idempotente.
 */
import { createFileRoute } from "@tanstack/react-router";

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/webhooks/pinpay")({
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
        const idRaw = data["transaction_id"] ?? data["id"];
        const transactionId = typeof idRaw === "string" || typeof idRaw === "number" ? String(idRaw).trim().slice(0, 200) : "";
        if (!transactionId) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id, status, store_id, payment, provider_status, paid_at")
          .eq("payment_provider", "pinpay")
          .eq("transaction_id", transactionId)
          .maybeSingle();
        if (!order || !order.store_id) return new Response("ok");

        const { loadStorePayment, toGatewayConfig } = await import("@/lib/payments/resolve.server");
        const settings = await loadStorePayment(order.store_id as string);
        if (!settings || settings.provider !== "pinpay") return new Response("ok");

        // Webhook da conta assinado: se veio assinatura e a loja tem o Signing Secret, ela precisa bater.
        const signature = request.headers.get("x-webhook-signature");
        const whsec = settings.secret_data["webhook_secret"];
        if (signature && whsec) {
          const expected = `sha256=${await hmacHex(whsec, raw)}`;
          if (!safeEqual(signature, expected)) return new Response("assinatura inválida", { status: 401 });
        }

        const { getProvider } = await import("@/lib/payments/providers.server");
        const gateway = getProvider("pinpay");
        if (!gateway) return new Response("ok");
        let confirmed;
        try {
          confirmed = await gateway.getStatus(toGatewayConfig(settings), transactionId);
        } catch {
          return new Response("indisponível", { status: 503 });
        }
        const internal = confirmed.status.toLowerCase();
        console.info("[pinpay] webhook", { order: order.id, event: String(body["event"] ?? "postback"), status: confirmed.status });

        if (order.provider_status === internal) return new Response("ok");
        if (order.status === "pago" && !["refunded", "chargeback"].includes(internal)) return new Response("ok");

        const payment = (order.payment ?? {}) as Record<string, unknown>;
        const update: Record<string, unknown> = {
          provider_status: internal,
          payment: { ...payment, gateway_status: confirmed.status, status: internal === "paid" ? "pago" : internal },
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
