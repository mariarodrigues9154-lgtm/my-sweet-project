import type { StatusResult } from "./providers.server";
import { westpayMatchesOrder } from "./westpay.server";

/** Both callback and polling use the same verified, conditional transition. */
export async function confirmWestpayOrder(db: any, order: { id: string; store_id: string; total: number; status: string; payment: unknown; paid_at: string | null }, result: StatusResult, purchase: (id: string) => Promise<unknown>) {
  if (!westpayMatchesOrder(result, order)) throw new Error("WestPay valor ou referência divergente.");
  if (result.status === "unknown") return false;
  const payment = order.payment && typeof order.payment === "object" ? order.payment as Record<string, unknown> : {};
  const update: Record<string, unknown> = { provider_status: result.status, payment: { ...payment, gateway_status: result.status, status: result.paid ? "pago" : result.status } };
  if (result.paid) {
    update["status"] = "pago";
    update["paid_at"] = order.paid_at ?? result.paid_at ?? new Date().toISOString();
  } else if (result.status === "refunded" || result.status === "chargeback") {
    update["status"] = result.status === "refunded" ? "reembolsado" : "contestado";
  } else if (order.status !== "aguardando_pagamento") return false;
  let query = db.from("orders").update(update).eq("id", order.id).eq("payment_provider", "westpay");
  query = result.paid ? query.eq("status", "aguardando_pagamento") : query.eq("status", order.status);
  const { error } = await query;
  if (error) throw new Error("Não foi possível salvar a confirmação WestPay.");
  // Existing Purchase / UTMify locks own event idempotency and retry; never infer paid from callback.
  if (result.paid && ["aguardando_pagamento", "pago"].includes(order.status)) await purchase(order.id);
  return result.paid;
}