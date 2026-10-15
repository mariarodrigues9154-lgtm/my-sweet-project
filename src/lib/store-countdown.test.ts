import { describe, expect, it } from "vitest";
import { remainingSeconds, resolveCountdownSeconds } from "./store-countdown";

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
