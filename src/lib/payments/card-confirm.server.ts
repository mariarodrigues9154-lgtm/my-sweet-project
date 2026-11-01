import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { StatusResult } from "./providers.server";
import { normalizeCardStatus, type CardProviderId } from "../payment-methods";
import { orderPaymentMethod } from "../order-payment";

type CardOrder = { id: string; status: string; payment_provider: string | null; transaction_id: string | null; payment_method?: string | null; payment: unknown; paid_at: string | null };

/** Only a server-to-gateway lookup may supply result. No charge creation here. */
export async function confirmCardOrder(db: SupabaseClient<Database>, order: CardOrder, result: StatusResult, purchase: (id: string) => Promise<unknown>) {
  if (orderPaymentMethod(order) !== "card" || !order.transaction_id || !["wappi", "freepay"].includes(order.payment_provider ?? "")) return "unknown" as const;
  const status = normalizeCardStatus(order.payment_provider as CardProviderId, result.status);
  if (order.status === "pago") {
    if (result.paid && status === "paid") await purchase(order.id); // Independent persisted locks own retries.
    return "paid" as const;
  }
  if (order.status !== "aguardando_pagamento" || status === "unknown") return "unknown" as const;
  if (status === "paid" && !result.paid) return "unknown" as const;
  const payment = order.payment && typeof order.payment === "object" ? order.payment as Record<string, unknown> : {};
  const update = {
    payment_method: "credit_card",
    provider_status: result.status.toLowerCase(),
    payment: { ...payment, method: "card", gateway_status: result.status, status: status === "paid" ? "pago" : status === "refused" ? "recusado" : "pendente" },
    ...(status === "paid" ? { status: "pago", paid_at: order.paid_at ?? result.paid_at ?? new Date().toISOString() } : {}),
  };
  const { data: changed, error } = await db.from("orders").update(update as never)
    .eq("id", order.id).eq("payment_provider", order.payment_provider as string)
    .eq("transaction_id", order.transaction_id).eq("status", "aguardando_pagamento").select("id").maybeSingle();
  if (error) throw new Error("Não foi possível salvar a confirmação do cartão.");
  if (!changed) return "unknown" as const;
  if (status === "paid") await purchase(order.id);
  return status;
}