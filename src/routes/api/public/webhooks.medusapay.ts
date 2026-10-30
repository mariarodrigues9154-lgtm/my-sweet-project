/**
 * MedusaPay webhook. Assinado (X-Medusa-Signature: sha256=<hex>) quando a loja cadastra o webhook
 * e salva o secret; via metadata.postback_url vem sem assinatura. Em ambos os casos o status é
 * sempre reconfirmado em GET /pagamentos/{id}. Transição para pago é condicional (idempotente:
 * retentativas com o mesmo eventId não têm efeito duplicado).
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  evento: z.string().max(60),
  eventId: z.string().max(100).optional(),
  dados: z.object({
    vendaId: z.string().min(1).max(100).optional(),
    valor: z.number().optional(),
    simulada: z.boolean().optional(),
    status: z.string().max(30).optional(),
  }),
});

export const Route = createFileRoute("/api/public/webhooks/medusapay")({
  server: { handlers: { POST: async ({ request }) => {
    const raw = await request.text();
    if (raw.length > 1_000_000) return new Response("payload grande", { status: 413 });
    let json: unknown;
    try { json = JSON.parse(raw); } catch { return new Response("payload inválido", { status: 400 }); }
    const parsed = schema.safeParse(json);
    if (!parsed.success || !parsed.data.dados.vendaId) return new Response("ok");
    if (parsed.data.dados.simulada) return new Response("ok"); // vendas de teste: ignorar (doc)
    if (!parsed.data.evento.startsWith("payment.")) return new Response("ok");
    const saleId = parsed.data.dados.vendaId;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin.from("orders")
      .select("id, store_id, total, status, payment, paid_at, provider_status")
      .eq("payment_provider", "medusapay").eq("transaction_id", saleId).maybeSingle();
    if (error) return new Response("indisponível", { status: 503 });
    if (!order?.store_id) return new Response("ok");

    const { loadStorePayment, toGatewayConfig } = await import("@/lib/payments/resolve.server");
    const settings = await loadStorePayment(order.store_id, "medusapay");
    if (!settings || settings.provider !== "medusapay") return new Response("ok");
    const { medusapay, verifyMedusapaySignature } = await import("@/lib/payments/medusapay.server");
    const config = toGatewayConfig(settings);
    const secret = config.secrets["webhook_secret"] ?? "";
    const sigHeader = request.headers.get("x-medusa-signature");
    // Com secret salvo, uma assinatura presente precisa ser válida; sem assinatura (postback por transação) segue para reconfirmação.
    if (secret && sigHeader && !(await verifyMedusapaySignature(raw, sigHeader, secret))) {
      return new Response("invalid signature", { status: 401 });
    }
    if (typeof parsed.data.dados.valor === "number" && Math.round(parsed.data.dados.valor * 100) !== Math.round(Number(order.total) * 100)) return new Response("ok");

    let confirmed;
    try { confirmed = await medusapay.getStatus(config, saleId); } catch { return new Response("indisponível", { status: 503 }); }
    if (typeof confirmed.amount_cents === "number" && confirmed.amount_cents !== Math.round(Number(order.total) * 100)) return new Response("ok");
    console.info("[medusapay] webhook", JSON.stringify({ order_id: order.id, store_id: order.store_id, event: parsed.data.evento, event_id: parsed.data.eventId, status: confirmed.status }));
    if (order.provider_status === confirmed.status || confirmed.status === "unknown") return new Response("ok");

    const payment = (order.payment ?? {}) as Record<string, unknown>;
    const update: Record<string, unknown> = { provider_status: confirmed.status, payment: { ...payment, gateway_status: confirmed.status, status: confirmed.paid ? "pago" : confirmed.status } };
    let q;
    if (confirmed.paid) {
      update["status"] = "pago";
      update["paid_at"] = order.paid_at ?? new Date().toISOString();
      q = supabaseAdmin.from("orders").update(update as never).eq("id", order.id).eq("status", "aguardando_pagamento").select("id");
    } else if (confirmed.status === "refunded") {
      update["status"] = "reembolsado";
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
