import { describe, it, expect, vi } from "vitest";
import { confirmCardOrder } from "./card-confirm.server";
import { orderPaymentMethod } from "../order-payment";

const base = { id: "order1", status: "aguardando_pagamento", payment_provider: "wappi", transaction_id: "tx1", payment_method: "credit_card", payment: { method: "card", installments: 3 }, paid_at: null };
function database() {
  let current = { ...base };
  const update = vi.fn();
  const from = vi.fn(() => ({ update: (values: typeof current) => {
    update(values);
    const filters: Record<string, unknown> = {};
    const q = { eq: (key: string, value: unknown) => { filters[key] = value; return q; }, select: () => q,
      maybeSingle: async () => {
        const matches = Object.entries(filters).every(([key, value]) => (current as Record<string, unknown>)[key] === value);
        if (!matches) return { data: null, error: null };
        current = { ...current, ...values };
        return { data: { id: current.id }, error: null };
      } };
    return q;
  } }));
  return { db: { from } as never, from, update, read: () => current };
}
describe("Confirmação de cartão", () => {
  it("aprovação real marca pago, preserva parcelas e aciona confirmação existente", async () => {
    const d = database(); const purchase = vi.fn(async () => {});
    await confirmCardOrder(d.db, base, { paid: true, status: "PAID" }, purchase);
    expect(d.read()).toMatchObject({ status: "pago", payment_method: "credit_card", payment: { method: "card", installments: 3, status: "pago" } });
    expect(purchase).toHaveBeenCalledExactlyOnceWith("order1");
  });
  it.each(["PENDING", "REFUSED", "CANCELLED", "REFUNDED", "CHARGEBACK"])("%s não aciona confirmação", async status => {
    const d = database(); const purchase = vi.fn(async () => {});
    await confirmCardOrder(d.db, base, { paid: false, status }, purchase);
    expect(d.read().status).toBe("aguardando_pagamento"); expect(purchase).not.toHaveBeenCalled();
  });
  it("não aceita PAID sem confirmação válida", async () => {
    const d = database(); const purchase = vi.fn(async () => {});
    await confirmCardOrder(d.db, base, { paid: false, status: "PAID" }, purchase);
    expect(d.from).not.toHaveBeenCalled(); expect(purchase).not.toHaveBeenCalled();
  });
  it("notificações concorrentes confirmam a transição apenas uma vez", async () => {
    const d = database(); const purchase = vi.fn(async () => {});
    await Promise.all([1, 2, 3].map(() => confirmCardOrder(d.db, base, { paid: true, status: "PAID" }, purchase)));
    expect(purchase).toHaveBeenCalledTimes(1);
  });
  it("pedido convertido para PIX ou gateway PIX Black nunca entra no fluxo de cartão", async () => {
    const d = database(); const purchase = vi.fn(async () => {});
    await confirmCardOrder(d.db, { ...base, payment_method: "pix" }, { paid: true, status: "PAID" }, purchase);
    await confirmCardOrder(d.db, { ...base, payment_provider: "pixxblack" }, { paid: true, status: "PAID" }, purchase);
    expect(d.from).not.toHaveBeenCalled(); expect(purchase).not.toHaveBeenCalled();
  });
  it("usa o método persistido e reconhece cartão legado sem confundir PIX", () => {
    expect(orderPaymentMethod(base)).toBe("card");
    expect(orderPaymentMethod({ payment: { method: "card" } })).toBe("card");
    expect(orderPaymentMethod({ payment_method: "pix", payment: { method: "card" } })).toBe("pix");
  });
});