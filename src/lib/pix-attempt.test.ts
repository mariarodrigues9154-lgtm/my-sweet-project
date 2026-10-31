import { describe, expect, it } from "vitest";
import { decideAttempt, type AttemptOrder } from "./pix-attempt";

const c = { phone: "(35) 99198-9688", email: "a@b.com", document: "123.456.789-00" };
const o = (id: string, status: string, min: number, customer: AttemptOrder["customer"] = c): AttemptOrder =>
  ({ id, order_number: id, status, created_at: new Date(Date.UTC(2026, 9, 30, 12, min)).toISOString(), customer });

describe("recuperação PIX por tentativa de compra", () => {
  it("A: Pix 1 pendente + Pix 2 pago → não envia", () => {
    expect(decideAttempt(o("1", "aguardando_pagamento", 0), [o("2", "pago", 5)]).action).toBe("skip_paid");
  });
  it("B: dois pendentes → só o mais novo envia", () => {
    const p1 = o("1", "aguardando_pagamento", 0), p2 = o("2", "aguardando_pagamento", 5);
    expect(decideAttempt(p1, [p1, p2]).action).toBe("skip_superseded");
    expect(decideAttempt(p2, [p1, p2]).action).toBe("send");
  });
  it("C: Pix 1 pago + Pix 2 pendente → não envia", () => {
    expect(decideAttempt(o("2", "aguardando_pagamento", 5), [o("1", "pago", 0)]).action).toBe("skip_paid");
  });
  it("D: dois pendentes + um pago → nenhum envia", () => {
    const all = [o("1", "aguardando_pagamento", 0), o("2", "aguardando_pagamento", 3), o("3", "pago", 6)];
    expect(all.slice(0, 2).map((t) => decideAttempt(t, all).action)).toEqual(["skip_paid", "skip_paid"]);
  });
  it("relaciona pelo CPF mesmo com telefone diferente", () => {
    expect(decideAttempt(o("1", "aguardando_pagamento", 0), [o("2", "pago", 5, { phone: "11999990000", document: "12345678900" })]).action).toBe("skip_paid");
  });
  it("compra paga há dias não bloqueia novo carrinho abandonado", () => {
    const old = { ...o("0", "pago", 0), created_at: "2026-10-25T12:00:00Z" };
    expect(decideAttempt(o("1", "aguardando_pagamento", 0), [old]).action).toBe("send");
  });
  it("outro cliente pago não bloqueia", () => {
    expect(decideAttempt(o("1", "aguardando_pagamento", 0), [o("2", "pago", 5, { phone: "11988887777" })]).action).toBe("send");
  });
});
