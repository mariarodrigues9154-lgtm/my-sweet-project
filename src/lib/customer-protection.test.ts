import { describe, expect, it } from "vitest";
import { customerProtectionSchema, PROTECTION_DEFAULTS, protectionBenefitKeys, resolveCustomerProtection } from "./customer-protection";

describe("customer protection per store", () => {
  it("keeps existing stores on the original enabled layout", () => {
    expect(resolveCustomerProtection()).toMatchObject({ enabled: true, style: "original" });
  });
  it("accepts both layout choices without discarding premium data", () => {
    for (const style of ["original", "premium"] as const) {
      expect(customerProtectionSchema.parse({ ...PROTECTION_DEFAULTS, style, title: "Minha proteção" })).toMatchObject({ style, title: "Minha proteção" });
    }
  });
  it("preserves all six independently edited benefits through JSON persistence", () => {
    const value = { ...PROTECTION_DEFAULTS, style: "premium" as const, title: "Proteção Maria", subtitle: "Garantia da loja", ...Object.fromEntries(protectionBenefitKeys.map((key, index) => [key, `Benefício ${index + 1}`])) };
    const saved = customerProtectionSchema.parse(JSON.parse(JSON.stringify(value)));
    expect(resolveCustomerProtection(saved)).toEqual(value);
  });
  it("disables protection without losing configuration", () => {
    expect(resolveCustomerProtection({ enabled: false, style: "premium", benefit_4: "Meu suporte" })).toMatchObject({ enabled: false, style: "premium", benefit_4: "Meu suporte" });
  });
  it("keeps stores independent and does not mutate their settings", () => {
    const first = Object.freeze({ style: "premium" as const, title: "Loja A" });
    expect(resolveCustomerProtection(first).title).toBe("Loja A");
    expect(resolveCustomerProtection({ title: "Loja B" })).toMatchObject({ title: "Loja B", style: "original" });
    expect(first).toEqual({ style: "premium", title: "Loja A" });
  });
  it("supports always expanded premium benefits", () => {
    expect(resolveCustomerProtection({ collapsible: false }).collapsible).toBe(false);
  });
  it("rejects unknown styles and restores safe original fallback", () => {
    expect(customerProtectionSchema.safeParse({ style: "unknown" }).success).toBe(false);
  });
  it("does not replace intentionally empty editable text", () => {
    expect(resolveCustomerProtection({ title: "", benefit_5: "" })).toMatchObject({ title: "", benefit_5: "" });
  });
});