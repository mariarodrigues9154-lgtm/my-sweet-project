import { z } from "zod";

/** Stored on each option; does not overwrite stock, price or active flags. */
export const variantAvailabilityFields = {
  sold_out: z.boolean().optional(),
  sold_out_text: z.string().max(120).optional(),
};

export function soldOutLabel(option: { sold_out?: boolean; sold_out_text?: string }): string | null {
  return option.sold_out === true ? option.sold_out_text?.trim() || "ESGOTADO" : null;
}