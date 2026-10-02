/** Consulta o status do pagamento de um pedido. Credenciais ficam só no servidor. */
export async function checkOrderPaymentStatus(orderNumber: string): Promise<{ found: boolean; status: string; paid_at: string | null }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("orders")
    .select("id, status, store_id, transaction_id, payment, paid_at")
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (!row) return { found: false, status: "desconhecido", paid_at: null };
  const current = { found: true, status: row.status as string, paid_at: (row.paid_at as string | null) ?? null };
  if (row.status !== "aguardando_pagamento" || !row.transaction_id || !row.store_id) return current;

  const { loadStorePayment, toGatewayConfig } = await import("./resolve.server");
  const settings = await loadStorePayment(row.store_id as string);
  if (!settings || settings.provider === "none") return current;
  const { getProvider } = await import("./providers.server");
  const gateway = getProvider(settings.provider);
  if (!gateway) return current;

  try {
    const result = await gateway.getStatus(toGatewayConfig(settings), row.transaction_id as string);
    if (!result.paid) return current;
    const paidAt = new Date().toISOString();
    const payment = (row.payment ?? {}) as Record<string, unknown>;
    await supabaseAdmin
      .from("orders")
      .update({
        status: "pago",
        paid_at: paidAt,
        provider_status: "paid",
        ...(result.e2e ? { e2e: result.e2e } : {}),
        payment: { ...payment, status: "pago", gateway_status: result.status },
      } as never)
      .eq("id", row.id)
      .neq("status", "pago");
    const { sendPurchaseForOrder } = await import("@/lib/meta.server");
    await sendPurchaseForOrder(row.id as string);
    return { found: true, status: "pago", paid_at: paidAt };
  } catch {
    return current;
  }
}
