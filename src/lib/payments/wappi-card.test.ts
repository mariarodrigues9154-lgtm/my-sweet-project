import { afterEach, describe, expect, it, vi } from "vitest";
import { createWappiCardCharge } from "./wappi-card.server";
import type { GatewayConfig } from "./providers.server";

const config: GatewayConfig = {
  provider: "wappi",
  environment: "production",
  secrets: { secret_key: "sk_test_123" },
  publicData: { public_key: "pk_test_123" },
};

const input = {
  orderNumber: "PED-123",
  amountCents: 11790,
  installments: 3,
  cardHash: "token-do-sdk-hiso",
  customer: { name: "Maria Silva", email: "maria@email.com", document: "123.456.789-09", phone: "(85) 99999-0000" },
  items: [{ title: "Mini máquina", unit_price: 3930, quantity: 3, tangible: true }],
  shipping: { fee: 0, address: { street: "Rua A", street_number: "10", complement: "", zip_code: "60000000", neighborhood: "Centro", city: "Fortaleza", state: "CE", country: "BR" } },
  postbackUrl: "https://loja.com/api/public/webhooks/wappi",
};

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

afterEach(() => vi.restoreAllMocks());

describe("createWappiCardCharge", () => {
  it("envia apenas o token do cartão (card.hash), nunca número ou CVV", async () => {
    const spy = mockFetch(200, { data: { id: "tx_1", status: "PENDING", three_ds: { required: true, session_id: "s1", type: "SCRIPT", redirect_url: null } } });
    const res = await createWappiCardCharge(config, input);
    expect(res.ok).toBe(true);
    const body = JSON.parse(String(spy.mock.calls[0]?.[1]?.body));
    expect(body.card).toEqual({ hash: "token-do-sdk-hiso" });
    expect(JSON.stringify(body)).not.toContain("cvv");
    expect(JSON.stringify(body)).not.toContain("4111");
    expect(body.payment_method).toBe("credit_card");
    expect(body.amount).toBe(11790);
    expect(body.installments).toBe(3);
    expect(body.postback_url).toBe("https://loja.com/api/public/webhooks/wappi");
  });

  it("autentica com Basic base64(PUBLIC_KEY:SECRET_KEY)", async () => {
    const spy = mockFetch(200, { data: { id: "tx_1", status: "PAID" } });
    await createWappiCardCharge(config, input);
    const headers = spy.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(`Basic ${Buffer.from("pk_test_123:sk_test_123").toString("base64")}`);
  });

  it("devolve a transação completa (com three_ds) para o finishThreeDS do navegador", async () => {
    mockFetch(200, { data: { id: "tx_9", status: "PENDING", three_ds: { required: true, session_id: "abc", type: "SCRIPT", redirect_url: null } } });
    const res = await createWappiCardCharge(config, input);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.transaction_id).toBe("tx_9");
      expect(res.status).toBe("PENDING");
      expect(res.transaction.three_ds?.session_id).toBe("abc");
    }
  });

  it("400 com recusa do gateway devolve o status real sem marcar como instabilidade", async () => {
    mockFetch(400, { data: { id: "tx_2", status: "REFUSED" }, error_messages: [{ message: "Recusada pelo emissor" }] });
    const res = await createWappiCardCharge(config, input);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe("REFUSED");
      expect(res.unavailable).toBeUndefined();
    }
  });

  it("5xx é instabilidade (unavailable), nunca recusa", async () => {
    mockFetch(500, { message: "erro interno" });
    const res = await createWappiCardCharge(config, input);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.unavailable).toBe(true);
  });

  it("falha de rede é instabilidade (unavailable)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    const res = await createWappiCardCharge(config, input);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.unavailable).toBe(true);
  });

  it("sem credenciais nem chama a API", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const res = await createWappiCardCharge({ ...config, secrets: {} }, input);
    expect(res.ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});
