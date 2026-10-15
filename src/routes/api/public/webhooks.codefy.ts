/**
 * Webhook da CodeFy (callbackUrl). Se a loja cadastrou a chave secreta de callback,
 * a assinatura X-CodeFy-Signature (HMAC-SHA256 do corpo bruto) é exigida. Em qualquer caso
 * o status é reconfirmado em GET /gateway/transactions/{id} antes de marcar como pago.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/codefy")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > 200_000) return new Response("payload grande", { status: 413 });
        let body: Record<string, unknown>;
        try {
          body = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return new Response("payload inválido", { status: 400 });
        }
        const idRaw = body["id"];
        const transactionId = typeof idRaw === "string" ? idRaw.trim().slice(0, 200) : "";
        if (!transactionId) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id, status, store_id, payment, provider_status, paid_at, total_amount_cents")
          .eq("payment_provider", "codefy")
          .eq("transaction_id", transactionId)
          .maybeSingle();
        if (!order || !order.store_id) return new Response("ok");

        const { loadStorePayment, toGatewayConfig } = await import("@/lib/payments/resolve.server");
        const settings = await loadStorePayment(order.store_id as string);
        if (!settings || settings.provider !== "codefy") return new Response("ok");

        const { getProvider, verifyCodefySignature } = await import("@/lib/payments/providers.server");
        const secret = settings.secret_data["webhook_secret"] ?? "";
        if (secret && !(await verifyCodefySignature(raw, request.headers.get("x-codefy-signature"), secret))) {
          return new Response("assinatura inválida", { status: 401 });
        }
        const gateway = getProvider("codefy");
        if (!gateway) return new Response("ok");
        let confirmed;
        try {
          confirmed = await gateway.getStatus(toGatewayConfig(settings), transactionId);
        } catch {
          return new Response("indisponível", { status: 503 });
        }
        const internal = confirmed.status;
        console.info("[codefy] webhook", { order: order.id, store: order.store_id, event: request.headers.get("x-codefy-event"), status: internal });

        if (internal === "unknown" || order.provider_status === internal) return new Response("ok");
        if (order.status === "pago" && internal !== "refunded") return new Response("ok");
        const expected = order.total_amount_cents as number | null;
        const got = Number(body["amount"]);
        if (internal === "paid" && expected && Number.isFinite(got) && Math.round(got * 100) !== expected) {
          console.error("[codefy] valor divergente", { order: order.id });
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
        } else if (internal === "refunded") {
          update["status"] = "reembolsado";
        } else if (internal === "expired") {
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
