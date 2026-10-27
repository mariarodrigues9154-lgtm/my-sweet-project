import type { Product } from "@/lib/product-types";
import { resolveCustomerProtection, type CustomerProtectionSettings } from "@/lib/customer-protection";
import { OriginalProtection } from "./OriginalProtection";
import { PremiumProtection } from "./PremiumProtection";

export function CustomerProtection({ protection, settings }: { protection: Product["protection"]; settings?: CustomerProtectionSettings }) {
  const config = resolveCustomerProtection(settings);
  if (!config.enabled) return null;
  return config.style === "premium" ? <PremiumProtection config={config} /> : <OriginalProtection protection={protection} />;
}