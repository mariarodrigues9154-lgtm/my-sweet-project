import { z } from "zod";
import type { Product, StoreSettings } from "./product-types";

export const productHeaderSchema = z.object({
  header_mode: z.enum(["inherit", "enabled", "disabled"]).optional(),
  header_search_text: z.string().trim().max(160).nullish(),
});

export function resolveProductHeader(
  product: Pick<Product, "display" | "name" | "title">,
  store: Pick<StoreSettings, "checkout">,
) {
  const mode = product.display?.header_mode ?? "inherit";
  return {
    enabled: mode === "enabled" || (mode === "inherit" && store.checkout?.mobile_header_enabled === true),
    text: product.display?.header_search_text?.trim() || product.name || product.title,
  };
}