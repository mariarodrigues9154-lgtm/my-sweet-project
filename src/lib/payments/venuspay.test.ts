import { describe, expect, it, vi, afterEach } from "vitest";
import { mapVenuspayStatus, parseVenuspayPix, venuspay, venuspayPayload, verifyVenuspaySignature } from "./venuspay.server";

const cfg = { provider: "venuspay" as const, environment: "production" as const, secrets: { api_key: "sk_live_abc" }, publicData: {} };
afterEach(() => vi.restoreAllMocks());

describe("VenusPay", () => {
  it("só aprova com status approved", () => {
    expect(mapVenuspayStatus("approved")).toBe("paid");
    expect(mapVenuspayStatus("pending")).toBe("pending");
    expect(mapVenuspayStatus("xyz")).toBe("unknown");
  });
  it("envia valor em reais e recusa abaixo de R$ 5,00", () => {
    const base = { orderNumber: "N1", amount: 117.9, amountCents: 11790, description: "x", customer: { name: "Ana", email: "a@b.com", document: "123.456.789-09" } };
    expect(venuspayPayload(base).amount).toBe(117.9);
    expect(venuspayPayload(base).payment_method).toBe("pix");
    expect(() => venuspayPayload({ ...base, amount: 4.99, amountCents: 499 })).toThrow();
  });
  it("respeita o limite oficial de R$ 1.000.000,00", () => {
    const base = { orderNumber: "N1", amount: 1_000_000, amountCents: 100_000_000, description: "x", customer: { name: "Ana", email: "a@b.com", document: "" } };
    expect(venuspayPayload(base).amount).toBe(1_000_000);
    expect(() => venuspayPayload({ ...base, amountCents: 100_000_001 })).toThrow();
  });
  it("segue o contrato oficial e faz apenas um POST mesmo no erro 500", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "erro interno" }), { status: 500 }));
    const result = await venuspay.createPix(cfg, { orderNumber: "N1", amount: 19.9, amountCents: 1990, description: "x", customer: { name: "Ana", email: "a@b.com", document: "" } });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe("https://mdjmtirsrhqrurkiqffb.supabase.co/functions/v1/process-payment");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).has("x-api-key")).toBe(true);
    expect(JSON.parse(String(init?.body)).amount).toBe(19.9);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.uncertain).toBe(true);
  });
  it("uma falha de rede mantém o resultado incerto sem repetir cobrança", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new DOMException("timeout", "TimeoutError"));
    const result = await venuspay.createPix(cfg, { orderNumber: "N1", amount: 19.9, description: "x", customer: { name: "Ana", email: "a@b.com", document: "" } });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(!result.ok && result.uncertain).toBe(true);
  });
  it("usa o copia e cola como PIX e nunca como imagem", () => {
    const r = parseVenuspayPix({ success: true, transaction_id: "t1", status: "pending", pix_copy_paste: "000201abc", qr_code_base64: "000201abc" });
    expect(r.ok && r.copy_paste).toBe("000201abc");
    expect(r.ok && r.qr_code).toBeNull();
  });
  it("valida a assinatura HMAC", async () => {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("s"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const hex = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("{}"))), (b) => b.toString(16).padStart(2, "0")).join("");
    expect(await verifyVenuspaySignature("{}", `sha256=${hex}`, "s")).toBe(true);
    expect(await verifyVenuspaySignature("{ }", `sha256=${hex}`, "s")).toBe(false);
  });
  it("teste de conexão: 401 falha, 400 aprova a chave", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ error: "invalid" }), { status: 401 }));
    expect((await venuspay.testConnection(cfg)).ok).toBe(false);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ error: "amount required" }), { status: 400 }));
    expect((await venuspay.testConnection(cfg)).ok).toBe(true);
  });
});
