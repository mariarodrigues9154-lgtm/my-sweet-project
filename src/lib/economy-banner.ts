import { z } from "zod";
import { brl } from "./format";
import { savings } from "./product-types";

export type EconomyBannerSettings = { mode?: "auto" | "manual"; text?: string };

export const economyBannerSchema = z
  .object({ mode: z.enum(["auto", "manual"]).optional(), text: z.string().max(160).optional() })
  .nullish()
  .transform((v) => (v ? { ...(v.mode ? { mode: v.mode } : {}), ...(v.text !== undefined ? { text: v.text } : {}) } : undefined));

/** Texto da faixa “Economize”; null = faixa oculta. */
export function economyBannerText(price: number, previous: number, settings?: EconomyBannerSettings | null): string | null {
  if (settings?.mode === "manual") return settings.text?.trim() ? settings.text : null;
  const value = savings(price, previous);
  return value > 0 ? `Economize ${brl(value)}` : null;
}