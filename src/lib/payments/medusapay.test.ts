import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { mapMedusapayStatus, medusapayIdempotencyKey, medusapayPayload, parseMedusapayCreate, verifyMedusapaySignature } from "./medusapay.server";

const input = { orderNumber: "1234", amount: 117.9, description: "Mini lavadora", customer: { name: "Ana Souza", email: "ana@x.com", document: "123.456.789-01" }, postbackUrl: "https://loja/api/public/webhooks/medusapay" };

describe("MedusaPay", () => {
  it("envia valor em reais, CPF só dígitos, PIX e idempotencyKey do pedido", () => {
    const p = medusapayPayload(input);
    expect(p).toMatchObject({ valor: 117.9, metodo: "PIX", clienteCpf: "12345678901", clienteEmail: "ana@x.com", idempotencyKey: "pix-1234", metadata: { postback_url: input.postbackUrl } });
  });
  it("recusa sem CPF/CNPJ (a doc diz que a cobrança é recusada)", () => {
    expect(() => medusapayPayload({ ...input, customer: { ...input.customer, document: "" } })).toThrow();
  });
  it("mesmo pedido gera a mesma chave de idempotência", () => {
    expect(medusapayIdempotencyKey("PED-000123")).toBe(medusapayIdempotencyKey("PED-000123"));
  });
  it("mapeia status documentados", () => {
    expect(mapMedusapayStatus("aprovado")).toBe("paid");
    expect(mapMedusapayStatus("pendente")).toBe("pending");
    expect(mapMedusapayStatus("estornado")).toBe("refunded");
    expect(mapMedusapayStatus("recusado")).toBe("refused");
  });
  it("lê a resposta de criação e recusa venda simulada", () => {
    const ok = parseMedusapayCreate({ venda: { id: "v1", valor: "117.90", status: "pendente" }, pixCopiaECola: "000201abc", pixQrCode: "data:image/png;base64,AA", pixExpiresAt: new Date(Date.now() + 600000).toISOString() });
    expect(ok).toMatchObject({ ok: true, transaction_id: "v1", copy_paste: "000201abc", provider_status: "pending", amount_cents: 11790 });
    expect(parseMedusapayCreate({ venda: { id: "v2", status: "aprovado", simulada: true } }).ok).toBe(false);
  });
  it("valida X-Medusa-Signature e recusa assinatura errada", async () => {
    const body = JSON.stringify({ evento: "payment.approved", dados: { vendaId: "v1" } });
    const sig = "sha256=" + createHmac("sha256", "seg").update(body).digest("hex");
    expect(await verifyMedusapaySignature(body, sig, "seg")).toBe(true);
    expect(await verifyMedusapaySignature(body, sig, "outro")).toBe(false);
  });
});
