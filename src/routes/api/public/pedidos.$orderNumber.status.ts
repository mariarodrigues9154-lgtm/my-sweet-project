import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const headers = {
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

/** GET /api/public/pedidos/{numero}/status — devolve só o status, sem dados do cliente nem credenciais. */
export const Route = createFileRoute("/api/public/pedidos/$orderNumber/status")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers }),
      GET: async ({ params }) => {
        const parsed = z.string().trim().regex(/^[A-Za-z0-9-]{4,64}$/).safeParse(params.orderNumber);
        if (!parsed.success) return Response.json({ error: "Número de pedido inválido." }, { status: 400, headers });
        const { checkOrderPaymentStatus } = await import("@/lib/payments/order-status.server");
        const result = await checkOrderPaymentStatus(parsed.data);
        if (!result.found) return Response.json({ error: "Pedido não encontrado." }, { status: 404, headers });
        return Response.json(
          { order_number: parsed.data, status: result.status, paid: result.status === "pago", paid_at: result.paid_at },
          { headers },
        );
      },
    },
  },
});
