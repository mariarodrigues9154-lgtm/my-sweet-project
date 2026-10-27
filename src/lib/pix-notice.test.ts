import { describe, expect, it } from "vitest";
import { noticeKind } from "./pix-notice";
const T0 = Date.parse("2026-10-27T00:00:00Z"); const m = 60_000;
const base = { created_at: new Date(T0).toISOString(), paid_at: null, expires_at: new Date(T0 + 15 * m).toISOString() };
describe("aviso PIX", () => {
  it("pendente aparece", () => expect(noticeKind({ ...base, state: "pendente" }, T0 + 5 * m)).toBe("pendente"));
  it("pago aparece até 15 min após confirmação", () => {
    const o = { ...base, state: "pago" as const, paid_at: new Date(T0 + 10 * m).toISOString() };
    expect(noticeKind(o, T0 + 24 * m)).toBe("pago");
    expect(noticeKind(o, T0 + 26 * m)).toBeNull();
  });
  it("pago nunca vira expirado", () => expect(noticeKind({ ...base, state: "pago", paid_at: new Date(T0 + 20 * m).toISOString() }, T0 + 30 * m)).toBe("pago"));
  it("respeita expiração real do gateway", () => expect(noticeKind({ ...base, state: "pendente" }, T0 + 16 * m)).toBe("expirado"));
  it("some após 40 min sem pagamento", () => {
    expect(noticeKind({ ...base, state: "expirado" }, T0 + 39 * m)).toBe("expirado");
    expect(noticeKind({ ...base, state: "expirado" }, T0 + 41 * m)).toBeNull();
    expect(noticeKind({ ...base, state: "pendente", expires_at: null }, T0 + 41 * m)).toBeNull();
  });
});
