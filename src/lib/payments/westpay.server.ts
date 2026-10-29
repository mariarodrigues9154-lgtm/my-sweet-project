/** Contract: https://app.westpay.com.br/docs (reviewed 2026-10-24). Server only. */
import { z } from "zod";
import { isValidCpfCnpj } from "../format";
import { parseGatewayDate } from "../pix-time";
import type { GatewayConfig, PaymentProvider, PixChargeInput, PixChargeResult } from "./providers.server";

export const WESTPAY_BASE = "https://api.westpay.com.br";
export const WESTPAY_CREATE_TIMEOUT_MS = 25000;
const transaction = z.object({
  id: z.string().min(1).max(200), amount: z.number().int().positive(),
  payment_method: z.string(), status: z.string().max(60),
  paid_at: z.string().nullish(), metadata: z.unknown().optional(),
});
const creation = z.object({ success: z.literal(true), data: transaction.extend({
  pix: z.object({ qr_code: z.string().min(6).max(10000), expiration_date: z.string().nullish(), e2_e: z.string().nullish() }),
}) });

export function mapWestpayStatus(raw: unknown): string {
  const status = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  const statuses: Record<string, string> = { PENDING: "pending", PAID: "paid", REFUNDED: "refunded", REFUSED: "refused", CHARGEBACK: "chargeback", PRECHARGEBACK: "prechargeback", EXPIRED: "expired", ERROR: "error", FAILED: "failed" };
  return statuses[status] ?? "unknown";
}

function headers(config: GatewayConfig): Record<string, string> | null {
  const pub = config.secrets["public_key"];
  const secret = config.secrets["secret_key"];
  if (!pub || !secret) return null;
  return { authorization: `Basic ${btoa(`${pub}:${secret}`)}`, accept: "application/json", "content-type": "application/json" };
}

/** Normalization follows the official PIX example (digits, Brazil country code). */
export function westpayPayload(input: PixChargeInput) {
  const amount = input.amountCents ?? Math.round(input.amount * 100);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Valor do pedido inválido.");
  const document = input.customer.document.replace(/\D/g, "");
  if (!isValidCpfCnpj(document)) throw new Error("Confira o CPF/CNPJ informado.");
  const rawPhone = (input.customer.phone ?? "").replace(/\D/g, "");
  const phone = rawPhone.length === 10 || rawPhone.length === 11 ? `55${rawPhone}` : rawPhone;
  if (!/^55\d{10,11}$/.test(phone)) throw new Error("Informe um telefone válido com DDD.");
  if (!input.customer.name.trim() || !z.email().safeParse(input.customer.email.trim()).success) throw new Error("Confira o nome e o e-mail informados.");
  const items = input.items?.length ? input.items : [{ title: input.description, unit_price: amount, quantity: 1, tangible: true }];
  if (items.some(i => !Number.isSafeInteger(i.unit_price) || i.unit_price < 0 || !Number.isSafeInteger(i.quantity) || i.quantity < 1)) throw new Error("Itens do pedido inválidos.");
  const fee = input.shipping?.fee ?? 0;
  if (!Number.isSafeInteger(fee) || fee < 0 || items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0) + fee !== amount) throw new Error("Não foi possível confirmar o valor do pedido.");
  // Shipping is optional; fee units are not explicitly documented. Current store shipping is free.
  if (fee !== 0) throw new Error("A WestPay ainda não está configurada para frete pago.");
  const days = input.expiresInDays ?? 1;
  if (!Number.isSafeInteger(days) || days < 1) throw new Error("Validade do PIX inválida.");
  return {
    amount, payment_method: "pix",
    customer: { name: input.customer.name.trim(), email: input.customer.email.trim(), document: { number: document, type: document.length === 11 ? "cpf" : "cnpj" }, phone },
    items: items.map(i => ({ title: i.title, unit_price: i.unit_price, quantity: i.quantity, tangible: i.tangible, ...(i.external_ref ? { external_ref: i.external_ref } : {}) })),
    ...(input.shipping ? { shipping: { fee: 0, address: input.shipping.address } } : {}),
    pix: { expires_in_days: days },
    ...(input.postbackUrl ? { postback_url: input.postbackUrl } : {}),
    metadata: { ...(input.metadata ?? {}), order_number: input.orderNumber },
  };
}

export function parseWestpayPix(body: unknown, amount: number): PixChargeResult {
  const parsed = creation.safeParse(body);
  if (!parsed.success) return { ok: false, uncertain: true, error: "Não foi possível confirmar a resposta da WestPay. Aguarde a confirmação antes de tentar novamente." };
  const tx = parsed.data.data;
  if (tx.amount !== amount || tx.payment_method !== "pix" || !tx.pix.qr_code.startsWith("000201")) return { ok: false, uncertain: true, error: "Não foi possível confirmar os dados do PIX. Aguarde a confirmação do pagamento." };
  const expiry = tx.pix.expiration_date ? parseGatewayDate(tx.pix.expiration_date) : NaN;
  return { ok: true, transaction_id: tx.id, copy_paste: tx.pix.qr_code, qr_code: null,
    amount_cents: tx.amount, provider_status: mapWestpayStatus(tx.status),
    expiration_date: Number.isFinite(expiry) ? new Date(expiry).toISOString() : null,
    expires_in: Number.isFinite(expiry) ? Math.max(0, Math.floor((expiry - Date.now()) / 1000)) : 900,
    e2e: tx.pix.e2_e ?? null };
}

function metadata(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { return {}; } }
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
}

export function westpayMatchesOrder(confirmed: { amount_cents?: number | null; metadata?: Record<string, unknown> }, order: { id: string; store_id: string; total: number }) {
  return confirmed.amount_cents === Math.round(order.total * 100) && confirmed.metadata?.["order_id"] === order.id && confirmed.metadata?.["store_id"] === order.store_id;
}

const friendly = (status: number) => status === 401 || status === 403 ? "Não foi possível autenticar. Verifique as credenciais da WestPay." : status === 400 || status === 422 ? "Alguns dados do pedido não foram aceitos. Confira seus dados e tente novamente." : "Não foi possível gerar o PIX neste momento. Aguarde a confirmação antes de tentar novamente.";

/** WestPay wraps successful GET responses in `{ data: {...} }` (verified live 2026-10-29). */
export function unwrapWestpay(body: unknown): unknown {
  return body && typeof body === "object" && "data" in body ? (body as { data: unknown }).data : body;
}

/** Short provider message from `error_messages[].message` / `error`, credentials never included. */
export function westpayErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { error_messages?: { message?: unknown }[]; error?: unknown };
  const msg = Array.isArray(b.error_messages) ? b.error_messages.map(e => e?.message).filter(m => typeof m === "string").join("; ") : typeof b.error === "string" ? b.error : "";
  return msg ? msg.slice(0, 200) : null;
}

export const westpay: PaymentProvider = {
  id: "westpay",
  async testConnection(config) {
    const h = headers(config);
    if (!h) return { ok: false, error: "Informe PUBLIC_KEY e SECRET_KEY." };
    try {
      // GET /v1/company: read-only account lookup, no charge is created.
      const response = await fetch(`${WESTPAY_BASE}/v1/company`, { headers: h, signal: AbortSignal.timeout(10000) });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = westpayErrorMessage(body);
        console.warn("[westpay] test", JSON.stringify({ http_status: response.status, detail }));
        return { ok: false, error: `${friendly(response.status)} (HTTP ${response.status}${detail ? `: ${detail}` : ""})` };
      }
      const company = z.object({ id: z.string().min(1), fantasy_name: z.string().optional(), status: z.string().optional() }).safeParse(unwrapWestpay(body));
      return company.success ? { ok: true, company: { id: company.data.id, fantasy_name: company.data.fantasy_name, status: company.data.status } } : { ok: false, error: "A WestPay respondeu, mas em formato inesperado." };
    } catch { return { ok: false, error: "Não foi possível falar com a WestPay agora (tempo esgotado ou rede)." }; }
  },
  async createPix(config, input) {
    const h = headers(config);
    if (!h) return { ok: false, error: "Gateway sem credenciais." };
    let payload;
    try { payload = westpayPayload(input); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Confira os dados do pedido." }; }
    const start = Date.now();
    const audit = { provider: "westpay", store_id: input.metadata?.["store_id"], order_id: input.metadata?.["order_id"] };
    try {
      const response = await fetch(`${WESTPAY_BASE}/v1/payment-transaction/create`, { method: "POST", headers: h, body: JSON.stringify(payload), signal: AbortSignal.timeout(WESTPAY_CREATE_TIMEOUT_MS) });
      const received = Date.now();
      const body: unknown = await response.json().catch(() => null);
      const result = response.status === 200 ? parseWestpayPix(body, payload.amount) : { ok: false as const, error: friendly(response.status), uncertain: response.status >= 500 || ![400, 401, 403, 422].includes(response.status) };
      // Do not log raw provider messages: the documented error schema is unspecified and may echo credentials/PII.
      console.info("[westpay] create", JSON.stringify({ ...audit, http_status: response.status, category: result.ok ? "CREATED" : result.uncertain ? "UNCERTAIN" : "REJECTED_REQUEST", ...(result.ok ? { transaction_id: result.transaction_id, provider_status: result.provider_status } : {}), westpay_request_ms: received - start, westpay_response_ms: Date.now() - received, at: new Date().toISOString() }));
      return result;
    } catch {
      console.error("[westpay] create", JSON.stringify({ ...audit, category: "NETWORK_OR_TIMEOUT", westpay_request_ms: Date.now() - start, at: new Date().toISOString() }));
      return { ok: false, uncertain: true, error: "A WestPay ainda não confirmou a geração do PIX. Aguarde a confirmação antes de tentar novamente." };
    }
  },
  async getStatus(config, transactionId) {
    const h = headers(config);
    if (!h) throw new Error("WestPay sem credenciais.");
    const response = await fetch(`${WESTPAY_BASE}/v1/payment-transaction/info/${encodeURIComponent(transactionId)}`, { headers: h, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`WestPay consulta HTTP ${response.status}`);
    const tx = transaction.parse(unwrapWestpay(await response.json()));
    if (tx.id !== transactionId || tx.payment_method !== "pix") throw new Error("WestPay transação divergente.");
    const status = mapWestpayStatus(tx.status);
    return { paid: status === "paid", status, amount_cents: tx.amount, metadata: metadata(tx.metadata), paid_at: tx.paid_at && !tx.paid_at.startsWith("0001-") && Number.isFinite(Date.parse(tx.paid_at)) ? tx.paid_at : null };
  },
};