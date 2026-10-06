import { describe, expect, it } from "vitest";
import { discountedUnitCents, resolveExitOffer } from "./exit-offer";

describe("oferta de saída", () => {
  it("20% sobre R$ 57,90 vira R$ 46,32", () => {
    expect(discountedUnitCents(5790, { discount_type: "percent", discount_value: 20 })).toBe(4632);
  });
  it("valor fixo desconta por unidade", () => {
    expect(discountedUnitCents(5790, { discount_type: "fixed", discount_value: 10 })).toBe(4790);
  });
  it("desligada na loja não aparece", () => {
    expect(resolveExitOffer({ enabled: false, discount_value: 10 }, null)).toBeNull();
  });
  it("produto desativado esconde mesmo com loja ligada", () => {
    expect(resolveExitOffer({ enabled: true, discount_value: 10 }, { exit_offer_mode: "off" })).toBeNull();
  });
  it("produto com configuração própria usa o próprio desconto", () => {
    const r = resolveExitOffer({ enabled: false, discount_value: 10 }, { exit_offer_mode: "on", exit_offer: { discount_value: 30 } });
    expect(r?.discount_value).toBe(30);
  });
});
