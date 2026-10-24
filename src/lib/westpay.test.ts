import { afterEach, describe, expect, it, vi } from "vitest";
import { getProvider, type GatewayConfig, type PixChargeInput } from "./payments/providers.server";
import { WESTPAY_BASE, mapWestpayStatus, parseWestpayPix, westpay, westpayMatchesOrder, westpayPayload } from "./payments/westpay.server";
import { confirmWestpayOrder } from "./payments/westpay-confirm.server";
import { providerSpec } from "./payments/catalog";

const config: GatewayConfig = { provider: "westpay", environment: "production", secrets: { public_key: "test-public", secret_key: "test-secret" }, publicData: {} };
const input: PixChargeInput = { orderNumber: "PED-1", amount: 119.90, amountCents: 11990, description: "Produto", customer: { name: "Teste", email: "teste@example.com", document: "529.982.247-25", phone: "11999999999" }, metadata: { order_id: "o1", store_id: "s1" }, postbackUrl: "https://example.com/api/public/webhooks/westpay" };
const code = "00020101021226850014br.gov.bcb.pix2563exemplo";
const response = { success: true, data: { id: "tx1", amount: 11990, payment_method: "pix", status: "PENDING", pix: { qr_code: code, expiration_date: "2026-10-24T12:00:00Z" } } };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const mockResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("WestPay official contract", () => {
  it("registra WestPay sem substituir os outros gateways", () => {
    expect(getProvider("westpay")).toBe(westpay);
    for (const id of ["wappi", "freepay", "pinpay", "blackcat", "invictuspay", "codefy", "umbrellapag", "mercadopago", "asaas"]) expect(getProvider(id)?.id).toBe(id);
  });
  it("mantém ambas as credenciais somente no servidor", () => { expect(providerSpec("westpay").fields.map(f => ({ key: f.key, secret: f.secret }))).toEqual([{ key: "public_key", secret: true }, { key: "secret_key", secret: true }]); });
  it("119,90 é enviado como 11990 centavos", () => { expect(westpayPayload(input).amount).toBe(11990); });
  it("envia CPF sem máscara e tipo cpf do exemplo oficial", () => { expect(westpayPayload(input).customer.document).toEqual({ number: "52998224725", type: "cpf" }); });
  it("não envia CPF inválido", () => { expect(() => westpayPayload({ ...input, customer: { ...input.customer, document: "52998224720" } })).toThrow("CPF"); });
  it("telefone inclui 55 como no exemplo PIX oficial", () => { expect(westpayPayload(input).customer.phone).toBe("5511999999999"); });
  it("preserva telefone que já inclui 55", () => { expect(westpayPayload({ ...input, customer: { ...input.customer, phone: "+55 11 99999-9999" } }).customer.phone).toBe("5511999999999"); });
  it("não envia telefone incompleto", () => { expect(() => westpayPayload({ ...input, customer: { ...input.customer, phone: "119" } })).toThrow("telefone"); });
  it("inclui referência interna em metadata e expiração documentada em dias", () => { expect(westpayPayload(input).metadata).toEqual({ order_id: "o1", store_id: "s1", order_number: "PED-1" }); expect(westpayPayload(input).pix).toEqual({ expires_in_days: 1 }); });
  it("não cobra valor diferente da soma dos itens", () => { expect(() => westpayPayload({ ...input, items: [{ title: "Produto", unit_price: 100, quantity: 1, tangible: true }] })).toThrow("valor"); });
  it("não inventa unidade de frete pago", () => { expect(() => westpayPayload({ ...input, items: [{ title: "Produto", unit_price: 11890, quantity: 1, tangible: true }], shipping: { fee: 100, address: { street: "A", street_number: "1", complement: "", zip_code: "01001000", neighborhood: "Centro", city: "São Paulo", state: "SP", country: "BR" } } })).toThrow("frete pago"); });
  it("retorna transaction_id e o mesmo EMV usado pela tela existente", () => { expect(parseWestpayPix(response, 11990)).toMatchObject({ ok: true, transaction_id: "tx1", copy_paste: code, qr_code: null, amount_cents: 11990, provider_status: "pending" }); });
  it("não trata URL como código copia-e-cola", () => { expect(parseWestpayPix({ ...response, data: { ...response.data, pix: { qr_code: "https://example.com/qr" } } }, 11990)).toMatchObject({ ok: false, uncertain: true }); });
  it("resposta inválida não permite nova cobrança", () => { expect(parseWestpayPix({}, 11990)).toMatchObject({ ok: false, uncertain: true }); });
  it("valor divergente não permite usar PIX", () => { expect(parseWestpayPix(response, 500)).toMatchObject({ ok: false, uncertain: true }); });
  it("somente PAID representa pago; status desconhecido nunca aprova", () => { expect(mapWestpayStatus("PAID")).toBe("paid"); for (const status of ["PENDING", "REFUSED", "ERROR", "FAILED", "EXPIRED", "REFUNDED", "CHARGEBACK", "PRECHARGEBACK", "approved", ""]) expect(mapWestpayStatus(status)).not.toBe("paid"); expect(mapWestpayStatus("approved")).toBe("unknown"); });
  it("testa credencial válida sem criar cobrança", async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse({ id: "company1", fantasy_name: "Teste", status: "ACTIVE" })); vi.stubGlobal("fetch", fetch);
    expect(await westpay.testConnection(config)).toMatchObject({ ok: true });
    expect(fetch).toHaveBeenCalledWith(`${WESTPAY_BASE}/v1/company`, expect.objectContaining({ headers: expect.objectContaining({ authorization: `Basic ${btoa("test-public:test-secret")}` }) }));
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejeita credencial inválida", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({}, 401))); expect(await westpay.testConnection(config)).toMatchObject({ ok: false }); });
  it("cria PIX apenas pelo endpoint e payload oficiais", async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse(response)); vi.stubGlobal("fetch", fetch);
    expect(await westpay.createPix(config, input)).toMatchObject({ ok: true, transaction_id: "tx1" });
    expect(fetch).toHaveBeenCalledWith(`${WESTPAY_BASE}/v1/payment-transaction/create`, expect.objectContaining({ method: "POST", body: JSON.stringify(westpayPayload(input)) })); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("timeout fica incerto sem retry automático", async () => { const fetch = vi.fn().mockRejectedValue(new DOMException("timeout", "TimeoutError")); vi.stubGlobal("fetch", fetch); expect(await westpay.createPix(config, input)).toMatchObject({ ok: false, uncertain: true }); expect(fetch).toHaveBeenCalledTimes(1); });
  it("HTTP 400 é falha de dados, não recusa do pagamento", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({ error: "dados" }, 400))); expect(await westpay.createPix(config, input)).toMatchObject({ ok: false, uncertain: false }); });
  it("HTTP 500 fica incerto e não repete POST", async () => { const fetch = vi.fn().mockResolvedValue(mockResponse({}, 500)); vi.stubGlobal("fetch", fetch); expect(await westpay.createPix(config, input)).toMatchObject({ ok: false, uncertain: true }); expect(fetch).toHaveBeenCalledTimes(1); });
  it("consulta transação sem envelope e lê metadata JSON string", async () => {
    const fetch = vi.fn().mockResolvedValue(mockResponse({ id: "tx1", amount: 11990, payment_method: "pix", status: "PAID", metadata: '{"order_id":"o1","store_id":"s1"}', paid_at: "2026-10-24T10:00:00Z" })); vi.stubGlobal("fetch", fetch);
    expect(await westpay.getStatus(config, "tx1")).toMatchObject({ paid: true, amount_cents: 11990, metadata: { order_id: "o1", store_id: "s1" } });
    expect(fetch).toHaveBeenCalledWith(`${WESTPAY_BASE}/v1/payment-transaction/info/tx1`, expect.anything());
  });
  it("consulta não aceita ID de outra transação", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse({ id: "other", amount: 11990, payment_method: "pix", status: "PAID" }))); await expect(westpay.getStatus(config, "tx1")).rejects.toThrow("divergente"); });
  it("confirmação exige mesma loja, pedido e valor", () => {
    const order = { id: "o1", store_id: "s1", total: 119.90 }; const confirmed = { amount_cents: 11990, metadata: { order_id: "o1", store_id: "s1" } };
    expect(westpayMatchesOrder(confirmed, order)).toBe(true);
    expect(westpayMatchesOrder(confirmed, { ...order, store_id: "s2" })).toBe(false);
    expect(westpayMatchesOrder(confirmed, { ...order, id: "o2" })).toBe(false);
    expect(westpayMatchesOrder(confirmed, { ...order, total: 119 })).toBe(false);
  });
});

describe("WestPay verified payment transition", () => {
  function setup() {
    const order = { id: "o1", store_id: "s1", total: 119.90, status: "aguardando_pagamento", payment: {}, paid_at: null };
    const query: any = { eq: vi.fn(() => query), then: (resolve: (value: unknown) => unknown) => resolve({ error: null }) };
    const update = vi.fn(() => query); const db = { from: vi.fn(() => ({ update })) }; const purchase = vi.fn().mockResolvedValue(undefined);
    const confirmed = { paid: true, status: "paid", amount_cents: 11990, metadata: { order_id: "o1", store_id: "s1" } };
    return { order, query, update, db, purchase, confirmed };
  }
  it("pagamento verificado marca PAGO e aciona fluxo existente", async () => { const s = setup(); await confirmWestpayOrder(s.db, s.order, s.confirmed, s.purchase); expect(s.update).toHaveBeenCalledWith(expect.objectContaining({ status: "pago", provider_status: "paid" })); expect(s.purchase).toHaveBeenCalledWith("o1"); expect(s.query.eq).toHaveBeenCalledWith("status", "aguardando_pagamento"); });
  it("pendente nunca envia Purchase", async () => { const s = setup(); await confirmWestpayOrder(s.db, s.order, { ...s.confirmed, paid: false, status: "pending" }, s.purchase); expect(s.purchase).not.toHaveBeenCalled(); expect(s.update).not.toHaveBeenCalledWith(expect.objectContaining({ status: "pago" })); });
  it("callback falsificado não grava nem envia Purchase", async () => { const s = setup(); await expect(confirmWestpayOrder(s.db, s.order, { ...s.confirmed, amount_cents: 10 }, s.purchase)).rejects.toThrow("divergente"); expect(s.update).not.toHaveBeenCalled(); expect(s.purchase).not.toHaveBeenCalled(); });
  it("callback duplicado usa transição condicional e deduplicação existente", async () => { const s = setup(); await confirmWestpayOrder(s.db, { ...s.order, status: "pago" }, s.confirmed, s.purchase); expect(s.query.eq).toHaveBeenCalledWith("status", "aguardando_pagamento"); expect(s.purchase).toHaveBeenCalledWith("o1"); });
  it("erro ao salvar não envia evento de compra", async () => { const s = setup(); s.query.then = (resolve: (v: unknown) => unknown) => resolve({ error: { message: "failed" } }); await expect(confirmWestpayOrder(s.db, s.order, s.confirmed, s.purchase)).rejects.toThrow("salvar"); expect(s.purchase).not.toHaveBeenCalled(); });
});