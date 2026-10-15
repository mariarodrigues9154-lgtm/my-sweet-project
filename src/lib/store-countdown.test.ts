import { describe, expect, it } from "vitest";
import { productCountdownSeconds, remainingSeconds, resolveCountdownSeconds } from "./store-countdown";

describe("cronômetro da loja", () => {
  it("padrão é 18h09 (18:09:00)", () => {
    expect(resolveCountdownSeconds({})).toBe(18 * 3600 + 9 * 60);
  });
  it("usa a duração salva pela loja", () => {
    expect(resolveCountdownSeconds({ offer_countdown: { hours: 2, minutes: 30 } })).toBe(9000);
  });
  it("não reinicia: 10 minutos depois mostra 17:59:00", () => {
    const d = 18 * 3600 + 9 * 60;
    const start = remainingSeconds(0, d, 1_000_000);
    expect(start.left).toBe(d);
    expect(remainingSeconds(start.deadline, d, 1_000_000 + 600_000).left).toBe(d - 600);
  });
});

describe("cronômetro por produto", () => {
  it("produto com 6h usa a própria duração", () => {
    expect(productCountdownSeconds({ id: "b", sections: { coupon_promo: { countdown_hours: 6, countdown_minutes: 0 } } })).toBe(21600);
  });
  it("produto sem duração própria usa a da loja", () => {
    expect(productCountdownSeconds({ id: "c", sections: {} })).toBeNull();
  });
});
