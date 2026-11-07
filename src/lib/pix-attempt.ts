import { PAYMENT_PROVIDERS } from "./payments/catalog";

/** Browser-safe guard: an uncertain attempt cannot silently become a new order. */
export function pixRetryBlocked(result: unknown): boolean {
  return Boolean(result && typeof result === "object" && (result as Record<string, unknown>)["retry_blocked"] === true);
}

export function logPixSubmit(start: number, result: unknown, storeId: string) {
  const provider = pixAttemptProvider(result);
  if (provider !== "westpay" && provider !== "venuspay") return;
  console.info(`[${provider}] checkout`, { provider, store_id: storeId, checkout_submit_ms: Math.round(performance.now() - start), at: new Date().toISOString() });
}

export function pixAttemptProvider(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const provider = (result as Record<string, unknown>)["provider"];
  return typeof provider === "string" ? provider : null;
}

export function pixWaitingMessage(provider: string | null): string {
  const name = PAYMENT_PROVIDERS.find((item) => item.id === provider && item.id !== "none")?.name;
  return name ? `Aguardando confirmação da ${name}` : "Aguardando confirmação do pagamento";
}