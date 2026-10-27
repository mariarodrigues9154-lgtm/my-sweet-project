import { z } from "zod";

export const PROTECTION_DEFAULTS = {
  enabled: true,
  style: "original" as const,
  collapsible: true,
  title: "Proteção do cliente",
  subtitle: "Compra 100% garantida do início ao fim",
  benefit_1: "Devolução gratuita",
  benefit_2: "Pagamento 100% seguro",
  benefit_3: "Reembolso por danos",
  benefit_4: "Atendimento via WhatsApp 24 horas",
  benefit_5: "Código de rastreio por e-mail em até 6 horas após a compra",
  benefit_6: "Suporte após a compra",
};

export const protectionBenefitKeys = ["benefit_1", "benefit_2", "benefit_3", "benefit_4", "benefit_5", "benefit_6"] as const;

const text = z.string().max(600).optional();
export const customerProtectionSchema = z.object({
  enabled: z.boolean().optional(),
  style: z.enum(["original", "premium"]).optional(),
  collapsible: z.boolean().optional(),
  title: text,
  subtitle: text,
  benefit_1: text,
  benefit_2: text,
  benefit_3: text,
  benefit_4: text,
  benefit_5: text,
  benefit_6: text,
});

export type CustomerProtectionSettings = z.infer<typeof customerProtectionSchema>;
export type ResolvedCustomerProtection = { [K in keyof CustomerProtectionSettings]-?: Exclude<CustomerProtectionSettings[K], undefined> };

export function resolveCustomerProtection(value?: CustomerProtectionSettings | null): ResolvedCustomerProtection {
  const result = customerProtectionSchema.safeParse(value ?? {});
  const config = result.success ? result.data : {};
  return Object.fromEntries(Object.entries(PROTECTION_DEFAULTS).map(([key, fallback]) => [key, config[key as keyof CustomerProtectionSettings] ?? fallback])) as ResolvedCustomerProtection;
}