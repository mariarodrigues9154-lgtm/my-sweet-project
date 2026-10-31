import { describe, expect, it } from "vitest";
import { alreadyMessagedRecently } from "./pix-purchase-attempt";

const now = new Date("2026-10-31T12:00:00Z").getTime();
const hoursAgo = (h: number) => new Date(now - h * 3600000).toISOString();

describe("trava de 24h da recuperação de PIX", () => {
  it("bloqueia se o mesmo telefone recebeu mensagem há 1h por outro pedido", () => {
    expect(alreadyMessagedRecently({ id: "b", customer: { phone: "(94) 98442-4260" } }, [{ order_id: "a", sent_at: hoursAgo(1), customer: { phone: "5594984424260" } }], now)).toBe(true);
  });
  it("bloqueia pelo mesmo CPF ou e-mail", () => {
    expect(alreadyMessagedRecently({ id: "b", customer: { cpf: "123.456.789-00" } }, [{ order_id: "a", sent_at: hoursAgo(5), customer: { document: "12345678900" } }], now)).toBe(true);
    expect(alreadyMessagedRecently({ id: "b", customer: { email: "Ana@x.com" } }, [{ order_id: "a", sent_at: hoursAgo(5), customer: { email: "ana@x.com" } }], now)).toBe(true);
  });
  it("libera depois de 24h", () => {
    expect(alreadyMessagedRecently({ id: "b", customer: { phone: "94984424260" } }, [{ order_id: "a", sent_at: hoursAgo(25), customer: { phone: "94984424260" } }], now)).toBe(false);
  });
  it("libera cliente diferente", () => {
    expect(alreadyMessagedRecently({ id: "b", customer: { phone: "94984424260" } }, [{ order_id: "a", sent_at: hoursAgo(1), customer: { phone: "94984425324" } }], now)).toBe(false);
  });
});
