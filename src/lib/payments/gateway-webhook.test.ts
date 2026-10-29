import { describe, expect, it, vi, afterEach } from "vitest";

const fixtures = vi.hoisted(() => {
  const order = { id: "pedido-antigo", status: "aguardando_pagamento", store_id: "loja-a", payment: { provider: "umbrellapag" }, provider_status: "waiting_payment", paid_at: null };
  return { order, writes: vi.fn(), purchase: vi.fn(), status: vi.fn(), selector: { provider: "westpay", enabled: true } };
});
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock("@/lib/meta.server", () => ({ sendPurchaseForOrder: fixtures.purchase }));
vi.mock("@/lib/payments/providers.server", () => ({ getProvider: (id: string) => id === "umbrellapag" ? { getStatus: fixtures.status } : null }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (table: string) => {
  const filters: Record<string,string> = {};
  const query = {
    select: () => query, eq: (key: string, value: string) => { filters[key] = value; return query; },
    update: (patch: unknown) => { fixtures.writes(patch); return query; },
    maybeSingle: async () => ({ error: null, data: table === "orders" ? fixtures.order : table === "store_payment_settings" ? fixtures.selector : filters["provider"] === "umbrellapag" && filters["store_id"] === "loja-a" ? { store_id: "loja-a", provider: "umbrellapag", environment: "production", public_data: {}, secret_data: { api_key: "old-store-key" }, pix_config: {} } : null }),
    then: (resolve: (result: unknown) => unknown) => resolve({ error: null }),
  }; return query;
} } }));
import { Route } from "../../routes/api/public/webhooks.umbrellapag";
const handler = (Route as unknown as { server: { handlers: { POST: (args: { request: Request }) => Promise<Response> } } }).server.handlers.POST;
afterEach(() => { vi.clearAllMocks(); });
describe("Webhook depois da troca de gateway", () => {
  it("confirma PIX UmbrellaPag antigo enquanto WestPay está ativo e aciona fluxo existente", async () => {
    fixtures.status.mockResolvedValue({ paid: true, status: "paid", paid_at: "2026-10-29T10:00:00Z" });
    const response = await handler({ request: new Request("https://example.com/api/public/webhooks/umbrellapag", { method: "POST", body: JSON.stringify({ objectId: "tx-antiga" }) }) });
    expect(response.status).toBe(200);
    expect(fixtures.status).toHaveBeenCalledWith(expect.objectContaining({ provider: "umbrellapag", secrets: { api_key: "old-store-key" } }), "tx-antiga");
    expect(fixtures.writes).toHaveBeenCalledWith(expect.objectContaining({ status: "pago" }));
    expect(fixtures.purchase).toHaveBeenCalledWith("pedido-antigo");
  });
  it("postback falso não confirma pagamento sem reconfirmação real do gateway antigo", async () => {
    fixtures.status.mockResolvedValue({ paid: false, status: "waiting_payment" });
    await handler({ request: new Request("https://example.com/api/public/webhooks/umbrellapag", { method: "POST", body: JSON.stringify({ objectId: "tx-antiga", data: { status: "paid" } }) }) });
    expect(fixtures.writes).not.toHaveBeenCalled(); expect(fixtures.purchase).not.toHaveBeenCalled();
  });
});