import { describe, expect, it } from "vitest";
import { z } from "zod";
import { variantAvailabilityFields } from "./variant-availability";
import { optionSelectable, variantPricing, type Product } from "./product-types";

function fixture(): Product {
  return {
    price: 117.90, previous_price: 290, stock: 10,
    variants: [
      { name: "cor", label: "Cor", use_image: true, options: [
        { label: "Branco", value: "branco" },
        { label: "Preto", value: "preto", sold_out: true, sold_out_text: "SEM ESTOQUE" },
      ] },
      { name: "voltagem", label: "Voltagem", options: [
        { label: "110V", value: "110" }, { label: "220V", value: "220" },
      ] },
    ],
    variant_combos: ["branco|110", "branco|220", "preto|110", "preto|220"].map(key => ({ key, stock: 5, price: 118 })),
  } as Product;
}

describe("variant availability", () => {
  it("blocks sold-out options before other groups are chosen", () => {
    expect(optionSelectable(fixture(), {}, "cor", "preto")).toBe(false);
  });
  it("blocks purchase for every voltage of a sold-out color", () => {
    for (const voltagem of ["110", "220"]) {
      expect(variantPricing(fixture(), { cor: "preto", voltagem }).available).toBe(false);
    }
  });
  it("restores availability without changing the price or stock", () => {
    const product = fixture();
    const before = variantPricing(product, { cor: "preto", voltagem: "110" });
    product.variants[0]?.options.forEach(option => { option.sold_out = false; });
    const after = variantPricing(product, { cor: "preto", voltagem: "110" });
    expect(after).toMatchObject({ available: true, price: 118, stock: 5 });
    expect(after.price).toBe(before.price);
  });
  it("leaves other options and products available", () => {
    const first = fixture();
    const second = fixture();
    second.variants[0]?.options.forEach(option => { option.sold_out = false; });
    expect(variantPricing(first, { cor: "branco", voltagem: "110" }).available).toBe(true);
    expect(variantPricing(second, { cor: "preto", voltagem: "110" }).available).toBe(true);
    expect(variantPricing(first, { cor: "preto", voltagem: "110" }).available).toBe(false);
  });
  it("blocks sold-out options even without combination overrides", () => {
    const product = { ...fixture(), variant_combos: [] };
    expect(optionSelectable(product, {}, "cor", "preto")).toBe(false);
    expect(variantPricing(product, { cor: "preto", voltagem: "220" }).available).toBe(false);
  });
  it("rejects unknown options instead of falling back to a purchasable base price", () => {
    expect(variantPricing(fixture(), { cor: "inexistente", voltagem: "220" }).available).toBe(false);
  });
  it("persists the availability fields through save validation", () => {
    const fields = z.object(variantAvailabilityFields);
    expect(fields.parse({ sold_out: true, sold_out_text: "SEM ESTOQUE" })).toEqual({ sold_out: true, sold_out_text: "SEM ESTOQUE" });
    expect(fields.parse({ sold_out: false, sold_out_text: "SEM ESTOQUE" })).toEqual({ sold_out: false, sold_out_text: "SEM ESTOQUE" });
  });
});