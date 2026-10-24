/** Browser-safe guard: an uncertain WestPay attempt cannot silently become a new order. */
export function pixRetryBlocked(result: unknown): boolean {
  return Boolean(result && typeof result === "object" && (result as Record<string, unknown>)["retry_blocked"] === true);
}

export function logPixSubmit(start: number, result: unknown, storeId: string) {
  if (!result || typeof result !== "object" || (result as Record<string, unknown>)["provider"] !== "westpay") return;
  console.info("[westpay] checkout", { provider: "westpay", store_id: storeId, checkout_submit_ms: Math.round(performance.now() - start), at: new Date().toISOString() });
}