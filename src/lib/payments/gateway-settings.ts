import { providerSpec } from "./catalog";

export type GatewaySettings = {
  provider: string;
  environment: string;
  public_data: Record<string, string>;
  secret_data: Record<string, string>;
};

export function missingGatewayFields(row: GatewaySettings): string[] {
  const spec = providerSpec(row.provider);
  if (!spec.supportsPix) return ["Gateway não disponível"];
  return spec.fields.filter((field) => field.required && !(field.secret ? row.secret_data[field.key] : row.public_data[field.key])?.trim()).map((field) => field.label);
}

export function gatewaySettingsDto(row: GatewaySettings) {
  return {
    provider: row.provider,
    environment: row.environment,
    public_data: Object.fromEntries(providerSpec(row.provider).fields.filter((field) => !field.secret).map((field) => [field.key, row.public_data[field.key] ?? ""])),
    secrets_masked: Object.fromEntries(providerSpec(row.provider).fields.filter((field) => field.secret && row.secret_data[field.key]).map((field) => [field.key, "••••••••••••••"])),
    configured: missingGatewayFields(row).length === 0,
  };
}

export function originalOrderProvider(order: { payment_provider?: string | null; payment?: unknown }): string | null {
  if (order.payment_provider && order.payment_provider !== "none") return order.payment_provider;
  const payment = order.payment;
  if (payment && typeof payment === "object" && "provider" in payment && typeof payment.provider === "string" && payment.provider !== "none" && payment.provider) return payment.provider;
  return null;
}