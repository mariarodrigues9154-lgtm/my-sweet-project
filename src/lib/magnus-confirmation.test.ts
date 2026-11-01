import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ status: "pago", claimed: false, post: vi.fn(), shipments: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (table: string) => {
  let claiming = false;
  const q = {
    select: () => q, eq: () => q,
    upsert: () => { claiming = true; return q; },
    update: (values: unknown) => { state.shipments(values); return q; },
    maybeSingle: async () => {
      if (table === "orders") return { data: { id: "order", store_id: "store", status: state.status, order_number: "N1", quantity: 1, unit_price: 100, total: 100, customer: { email: "cliente@example.com", name: "Cliente" }, address: {}, product_snapshot: { title: "Produto" } } };
      if (table === "store_magnus_settings") return { data: { enabled: true, api_token: "test-only" } };
      if (claiming && !state.claimed) { state.claimed = true; return { data: { id: "shipment" } }; }
      return { data: null };
    },
    then: (resolve: (value: unknown) => unknown) => resolve({ error: null }),
  };
  return q;
} } }));
import { syncMagnusOrder } from "./magnus.server";
beforeEach(() => { state.status = "pago"; state.claimed = false; vi.clearAllMocks(); });
describe("Magnus na confirmação compartilhada", () => {
  it("confirmações repetidas criam um único envio com e-mail do checkout", async () => {
    state.post.mockImplementation(async () => new Response(JSON.stringify({ success: true, codigo_rastreio: "BR1" }), { status: 201 }));
    vi.stubGlobal("fetch", state.post);
    try {
      await Promise.all([1, 2, 3].map(() => syncMagnusOrder("order")));
      expect(state.post).toHaveBeenCalledTimes(1);
      expect(JSON.parse(state.post.mock.calls[0]?.[1].body).customer.email).toBe("cliente@example.com");
      expect(state.shipments).toHaveBeenCalledWith(expect.objectContaining({ send_status: "enviado", tracking_code: "BR1" }));
    } finally { vi.unstubAllGlobals(); }
  });
  it("pedido aguardando pagamento nunca é enviado", async () => {
    state.status = "aguardando_pagamento";
    vi.stubGlobal("fetch", state.post);
    try { await syncMagnusOrder("order"); expect(state.post).not.toHaveBeenCalled(); }
    finally { vi.unstubAllGlobals(); }
  });
});