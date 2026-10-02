/** Resolve a configuração de gateway de uma loja — somente servidor. */

import type { GatewayConfig } from "./providers.server";
import type { PaymentEnvironment, PaymentProviderId } from "./catalog";

export type StorePaymentRow = {
  store_id: string;
  provider: string;
  enabled: boolean;
  environment: string;
  public_data: Record<string, string>;
  secret_data: Record<string, string>;
  pix_config: Record<string, unknown>;
};

export async function loadStorePayment(storeId: string): Promise<StorePaymentRow | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("store_payment_settings")
    .select("store_id, provider, enabled, environment, public_data, secret_data, pix_config")
    .eq("store_id", storeId)
    .maybeSingle();
  if (!data) return null;
  return {
    store_id: data.store_id as string,
    provider: data.provider as string,
    enabled: Boolean(data.enabled),
    environment: data.environment as string,
    public_data: (data.public_data ?? {}) as Record<string, string>,
    secret_data: (data.secret_data ?? {}) as Record<string, string>,
    pix_config: (data.pix_config ?? {}) as Record<string, unknown>,
  };
}

export function toGatewayConfig(row: StorePaymentRow): GatewayConfig {
  return {
    provider: row.provider as PaymentProviderId,
    environment: (row.environment === "production" ? "production" : "sandbox") as PaymentEnvironment,
    secrets: row.secret_data,
    publicData: row.public_data,
  };
}
