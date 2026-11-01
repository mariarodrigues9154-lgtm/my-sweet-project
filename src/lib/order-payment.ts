/** Saved transaction identity, never today's selected PIX provider. */
export function orderPaymentMethod(order: { payment_method?: string | null; payment?: unknown }): "card" | "pix" {
  if (order.payment_method === "credit_card" || order.payment_method === "card") return "card";
  if (order.payment_method === "pix") return "pix";
  const payment = order.payment && typeof order.payment === "object" ? order.payment as Record<string, unknown> : {};
  return payment["method"] === "card" || payment["method"] === "credit_card" ? "card" : "pix";
}

export function orderPaymentBadge(order: { status: string; provider_status: string | null; payment_method?: string | null }) {
  const card = order.payment_method === "card" || order.payment_method === "credit_card";
  const status = (order.provider_status ?? "").toLowerCase();
  if (order.status === "pago") return { label: card ? "CARTÃO APROVADO" : "PIX CONFIRMED", cls: "bg-success/15 text-success" };
  if (["refused", "expired", "error", "failed", "cancelled", "canceled", "refunded", "chargeback"].includes(status) || ["reembolsado", "contestado", "cancelado", "expirado"].includes(order.status)) {
    return { label: card ? "CARTÃO NÃO APROVADO" : "PIX CANCELLED", cls: "bg-destructive/15 text-destructive" };
  }
  return { label: card ? "CARTÃO PENDENTE" : "PIX PENDING", cls: "bg-muted text-muted-foreground" };
}