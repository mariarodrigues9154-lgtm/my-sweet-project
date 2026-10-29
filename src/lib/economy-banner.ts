import { z } from "zod";
import { brl } from "./format";
import { savings } from "./product-types";

export type BoldRange = { start: number; end: number };
export type EconomyBannerSettings = { mode?: "auto" | "manual" | undefined; text?: string | undefined; bold?: BoldRange[] | undefined; pulse?: boolean | undefined; pulse_target?: "bold" | "all" | undefined };

export const economyBannerSchema = z
  .object({
    mode: z.enum(["auto", "manual"]).optional(), text: z.string().max(160).optional(),
    bold: z.array(z.object({ start: z.number().int().min(0).max(160), end: z.number().int().min(0).max(160) })).max(160).optional(),
    pulse: z.boolean().optional(), pulse_target: z.enum(["bold", "all"]).optional(),
  })
  .nullish()
  .transform((v) => v ?? undefined);

export function normalizeBold(ranges: BoldRange[], length: number): BoldRange[] {
  const sorted = ranges.map(r => ({ start: Math.min(length, r.start), end: Math.min(length, r.end) })).filter(r => r.end > r.start).sort((a,b) => a.start - b.start);
  const result: BoldRange[] = [];
  for (const r of sorted) {
    const last = result[result.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else result.push({ ...r });
  }
  return result;
}

export function toggleBold(ranges: BoldRange[], start: number, end: number, length: number): BoldRange[] {
  const normalized = normalizeBold(ranges, length);
  if (end <= start) return normalized;
  if (normalized.some(r => r.start <= start && r.end >= end)) {
    return normalizeBold(normalized.flatMap(r => r.end <= start || r.start >= end ? [r] : [{ start: r.start, end: start }, { start: end, end: r.end }]), length);
  }
  return normalizeBold([...normalized, { start, end }], length);
}

/** Mantém os destaques alinhados ao inserir/apagar texto. */
export function editBold(ranges: BoldRange[], oldText: string, text: string): BoldRange[] {
  let start = 0;
  while (start < oldText.length && start < text.length && oldText[start] === text[start]) start++;
  let oldEnd = oldText.length, newEnd = text.length;
  while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] === text[newEnd - 1]) { oldEnd--; newEnd--; }
  const delta = newEnd - oldEnd;
  return normalizeBold(ranges.map(r => ({
    start: r.start < start ? r.start : r.start >= oldEnd ? r.start + delta : start,
    end: r.end <= start ? r.end : r.end >= oldEnd ? r.end + delta : newEnd,
  })), text.length);
}

/** Texto da faixa “Economize”; null = faixa oculta. */
export function economyBannerText(price: number, previous: number, settings?: EconomyBannerSettings | null): string | null {
  if (settings?.mode === "manual") return settings.text?.trim() ? settings.text : null;
  const value = savings(price, previous);
  return value > 0 ? `Economize ${brl(value)}` : null;
}