import { afterEach, describe, expect, it, vi } from "vitest";
import { westpay, unwrapWestpay, westpayErrorMessage } from "./westpay.server";

const config = { secrets: { public_key: "westpay_live_pub", secret_key: "sk_live_sec" } } as never;
afterEach(() => vi.unstubAllGlobals());

describe("WestPay connection", () => {
  it("sends Basic base64(PUBLIC:SECRET) to GET /v1/company and accepts the wrapped data response", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { id: "c1", fantasy_name: "Loja", status: "ACTIVE" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await westpay.testConnection(config);
    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.westpay.com.br/v1/company");
    expect((init.headers as Record<string, string>)["authorization"]).toBe(`Basic ${btoa("westpay_live_pub:sk_live_sec")}`);
  });

  it("reports HTTP 401 with the provider text and never the secrets", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 })));
    const result = await westpay.testConnection(config);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("HTTP 401: Invalid credentials");
    expect(result.error).not.toContain("sk_live_sec");
  });

  it("unwraps status lookups and reads error_messages", () => {
    expect(unwrapWestpay({ data: { id: "t" } })).toEqual({ id: "t" });
    expect(westpayErrorMessage({ error_messages: [{ message: "Transação não encontrada" }] })).toBe("Transação não encontrada");
  });
});
