import { describe, expect, it } from "vitest";
import { cardAvailable, installmentPlan, pixDiscountCents, resolvePaymentMethods } from "./payment-methods";

describe("payment methods", () => {
  it("5% PIX discount on R$117 gives R$111,15", () => {
    const cfg = resolvePaymentMethods({ pix: { discount_enabled: true, discount_type: "percent", discount_value: 5 } });
    expect(11700 - pixDiscountCents(11700, cfg)).toBe(11115);
  });
  it("max 7, free 3: 3x has no interest, 4x uses configured rate", () => {
    const cfg = resolvePaymentMethods({ card: { max_installments: 7, free_installments: 3, rates: [9, 9, 9, 10] } });
    const plan = installmentPlan(12000, cfg);
    expect(plan).toHaveLength(7);
    expect(plan[2]).toMatchObject({ installmentCents: 4000, totalCents: 12000, free: true });
    expect(plan[3]!.totalCents).toBe(13200);
    expect(cfg.card.text).toBe("Pague em até 7 parcelas");
    expect(cfg.card.highlight).toBe("Sem juros em até 3 parcelas");
  });
  it("card stays hidden while provider is none", () => {
    expect(cardAvailable(resolvePaymentMethods({ card: { enabled: true } }))).toBe(false);
  });
});
