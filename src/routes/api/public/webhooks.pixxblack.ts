/**
 * PixxBlack webhook. Assinado com HMAC-SHA256 (X-PixBlack-Signature: t=<unix>,v1=<hex>) usando o
 * segredo whsec_ da loja; mesmo assim o status é sempre reconfirmado via GET /charges/{id}.
 * Transição para pago é condicional a status = aguardando_pagamento (idempotente: o mesmo
 * evento evt_... pode chegar mais de uma vez sem efeito duplicado).
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  id: z.string().max(100),
  type: z.string().max(60),
  data: z.object({
    charge_id: z.string().min(1).max(100),
    external_reference: z.string().max(120).nullish(),
    status: z.string().max(30).optional(),
    amount_cents: z.number().int().optional(),
  }),
});

export const Route = createFileRoute("/api/public/webhooks/pixxblack")({
  server: { handlers: { POST: async ({ request }) => {
    const raw = await request.text();
    if (raw.length > 1_000_000) return new Response("payload grande", { status: 413 });
    let json: unknown;
    try { json = JSON.parse(raw); } catch { return new Response("payload inválido", { status: 400 }); }
    const parsed = schema.safeParse(json);
    if (!parsed.success) return new Response("ok");
    // ping: teste enviado pelo botão "Enviar teste" do painel PixxBlack.
    if (parsed.data.type === "ping") return new Response("ok");
    const chargeId = parsed.data.data.charge_id;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin.from("orders")
      .select("id, store_id, total, status, payment, paid_at, provider_status")
      .eq("payment_provider", "pixxblack").eq("transaction_id", chargeId).maybeSingle();
    if (error) return new Response("indisponível", { status: 503 });
    if (!order?.store_id) return new Response("ok");

    const { loadStorePayment, toGatewayConfig } = await import("@/lib/payments/resolve.server");
    const settings = await loadStorePayment(order.store_id, "pixxblack");
    if (!settings || settings.provider !== "pixxblack") return new Response("ok");
    const { pixxblack, verifyPixxblackSignature } = await import("@/lib/payments/pixxblack.server");
    const config = toGatewayConfig(settings);
    const secret = config.secrets["webhook_secret"] ?? "";
    if (secret && !(await verifyPixxblackSignature(raw, request.headers.get("x-pixblack-signature"), secret))) {
      return new Response("invalid signature", { status: 401 });
    }
    // O evento precisa bater com o valor do pedido.
    if (typeof parsed.data.data.amount_cents === "number" && parsed.data.data.amount_cents !== Math.round(Number(order.total) * 100)) return new Response("ok");

    let confirmed;
    try { confirmed = await pixxblack.getStatus(config, chargeId); } catch { return new Response("indisponível", { status: 503 }); }
    console.info("[pixxblack] webhook", JSON.stringify({ order_id: order.id, store_id: order.store_id, event: parsed.data.type, delivery: request.headers.get("x-pixblack-delivery"), status: confirmed.status }));
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
