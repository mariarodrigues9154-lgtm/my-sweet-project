import { beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  from: vi.fn(),
  phone: "(22) 99999-5552",
  order: { id: "order-1", store_id: "store-1", order_number: "PIX-1", status: "aguardando_pagamento", customer: { name: "Cliente", phone: "(22) 99999-5552" }, product_snapshot: { title: "Produto" }, total: 100, payment: {}, transaction_id: "tx-1", pix_expiration_date: "2020-01-01", access_token: "a".repeat(48), created_at: "2026-10-30T12:00:00Z", paid_at: null },
}));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (fn: unknown) => fn };
  return builder;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: fixtures.from } }));
vi.mock("@/lib/payments/order-status.server", () => ({ checkOrderPaymentStatus: vi.fn() }));
import { listPixRecoveryOrders } from "./whatsapp-recovery.functions";
import { getPixOrders } from "./pix-recovery.functions";

type Handler = (args: { data: Record<string, unknown>; context?: unknown }) => Promise<Record<string, unknown>[]>;
const list = listPixRecoveryOrders as unknown as Handler;
const publicList = getPixOrders as unknown as Handler;
beforeEach(() => {
  fixtures.from.mockReset();
  fixtures.from.mockImplementation((table: string) => {
    const rows = table === "orders" ? [fixtures.order] : [];
    const query = { select: () => query, eq: () => query, not: () => query, gte: () => query, order: () => query, limit: () => query, in: () => query, neq: () => query, then: (resolve: (value: unknown) => unknown) => resolve({ data: rows }) };
    return query;
  });
});
describe("privacidade dos telefones PIX", () => {
  it("administrador autorizado recebe exatamente o telefone armazenado", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const rows = await list({ data: { store_id: "store-1" }, context: { userId: "admin-1", supabase: { rpc } } });
    expect(rpc).toHaveBeenCalledWith("has_role", { _user_id: "admin-1", _role: "admin" });
    expect(rows[0]?.phone).toBe(fixtures.phone);
    expect(rows[0]?.phone_digits).toBe("22999995552");
  });
  it("usuário não administrador é recusado antes de consultar pedidos", async () => {
    await expect(list({ data: { store_id: "store-1" }, context: { userId: "user-1", supabase: { rpc: vi.fn().mockResolvedValue({ data: false, error: null }) } } })).rejects.toThrow("Acesso restrito");
    expect(fixtures.from).not.toHaveBeenCalled();
  });
  it("falha na verificação de permissão não libera telefones", async () => {
    await expect(list({ data: { store_id: "store-1" }, context: { userId: "user-1", supabase: { rpc: vi.fn().mockResolvedValue({ data: true, error: { message: "error" } }) } } })).rejects.toThrow("Acesso restrito");
    expect(fixtures.from).not.toHaveBeenCalled();
  });
  it("retorno público do PIX continua sem telefone ou dados do cliente", async () => {
    const rows = await publicList({ data: { tokens: [fixtures.order.access_token], direct: true } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty("customer");
    expect(rows[0]).not.toHaveProperty("phone");
    expect(rows[0]).not.toHaveProperty("phone_digits");
    expect(JSON.stringify(rows)).not.toContain(fixtures.phone);
  });
});