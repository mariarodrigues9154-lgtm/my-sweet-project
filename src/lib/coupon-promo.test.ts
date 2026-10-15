import { describe, expect, it } from "vitest";
import { fillCouponText, resolveCouponPromo, sanitizeCouponPromo } from "./coupon-promo";

describe("cupom promocional", () => {
  it("desligar não apaga textos salvos", () => {
    const c = resolveCouponPromo({ coupon_promo: { chip_enabled: false, chip_text: "Cupom especial de outubro" } });
    expect(c.chip_enabled).toBe(false);
    expect(c.chip_text).toBe("Cupom especial de outubro");
  });
  it("chip e barra são independentes", () => {
    const c = resolveCouponPromo({ coupon_promo: { chip_enabled: true, bar_enabled: false } });
    expect([c.chip_enabled, c.bar_enabled]).toEqual([true, false]);
  });
  it("preenche percentual e máximo", () => {
    expect(fillCouponText("Desconto de {percent}%, máximo de {max}", { percent: 60, max_value: 20 })).toBe("Desconto de 60%, máximo de R$\u00a020");
  });
  it("percentual fica entre 0 e 100", () => {
    expect(sanitizeCouponPromo({ percent: 150 }).percent).toBe(100);
  });
});
