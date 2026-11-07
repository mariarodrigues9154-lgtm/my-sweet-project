/** Providers without documented idempotency or order-reference lookup fail closed. */
export function permanentPixLock(provider: string): boolean {
  return provider === "venuspay" || provider === "westpay";
}

export function pixCreationFilter(provider: string, staleIso: string): string {
  if (permanentPixLock(provider)) {
    return `provider_status.is.null,and(provider_status.neq.creating,provider_status.neq.${provider}_uncertain)`;
  }
  return `provider_status.is.null,provider_status.neq.creating,updated_at.lt.${staleIso}`;
}

export function ambiguousPixAttempt(order: { payment_provider?: string | null; transaction_id?: string | null; provider_status?: string | null }): boolean {
  const provider = order.payment_provider ?? "";
  return permanentPixLock(provider) && !order.transaction_id &&
    (order.provider_status === "creating" || order.provider_status === `${provider}_uncertain`);
}