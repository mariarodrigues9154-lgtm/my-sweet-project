import { describe, expect, it } from "vitest";
import { cardAvailable, cardProviderReady, installmentPlan, normalizeCardStatus, pixDiscountCents, resolvePaymentMethods } from "./payment-methods";

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
    expect(plan[3]?.totalCents).toBe(13200);
    expect(cfg.card.text).toBe("Pague em até 7 parcelas");
    expect(cfg.card.highlight).toBe("Sem juros em até 3 parcelas");
  });
  it("enabled card is visible without a connected provider", () => {
    const cfg = resolvePaymentMethods({ card: { enabled: true, provider: "none" } });
    expect(cardAvailable(cfg)).toBe(true);
    expect(cardProviderReady(cfg)).toBe(false);
  });
  it("card is visible by default for stores without payment method configuration", () => {
    expect(cardAvailable(resolvePaymentMethods(undefined))).toBe(true);
  });
  it("explicit store switch still hides card", () => {
    expect(cardAvailable(resolvePaymentMethods({ card: { enabled: false } }))).toBe(false);
  });
});

import { fillDeclineMessage as _fill, normalizeCardStatus as _norm } from "./payment-methods";
describe("cartão recusado", () => {
  it("usa o primeiro nome do cliente", () => {
    expect(_fill("{nome}, seu cartão não foi aprovado nesta tentativa.", "maria souza")).toBe("Maria, seu cartão não foi aprovado nesta tentativa.");
  });
  it("status desconhecido ou pendente nunca vira recusa", () => {
    expect(_norm("blackcat", "PENDING")).not.toBe("refused");
    expect(_norm("none", "REFUSED")).not.toBe("refused");
  });
  it("FreePay: PAID approves, REFUSED/ERROR decline, unknown never declines", () => {
    expect(normalizeCardStatus("freepay", "PAID")).toBe("paid");
    expect(normalizeCardStatus("freepay", "REFUSED")).toBe("refused");
    expect(normalizeCardStatus("freepay", "ERROR")).toBe("refused");
    expect(normalizeCardStatus("freepay", "PENDING")).toBe("pending");
    expect(normalizeCardStatus("freepay", "CHARGEBACK")).toBe("unknown");
  });
  it("FreePay is a ready card gateway", () => {
    expect(cardProviderReady(resolvePaymentMethods({ card: { provider: "freepay" } }))).toBe(true);
  });
});
