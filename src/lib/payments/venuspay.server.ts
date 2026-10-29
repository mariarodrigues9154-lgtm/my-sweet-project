/** Contract: https://app.venuspay.com.br/docs (reviewed 2026-10-29). Server only. */
import { z } from "zod";
import { parseGatewayDate } from "../pix-time";
import type { GatewayConfig, PaymentProvider, PixChargeInput, PixChargeResult } from "./providers.server";

export const VENUSPAY_BASE = "https://mdjmtirsrhqrurkiqffb.supabase.co/functions/v1";
export const VENUSPAY_CREATE_TIMEOUT_MS = 25000;

const creation = z.object({
  success: z.literal(true),
  transaction_id: z.string().min(1).max(200),
  status: z.string().max(60).optional(),
  pix_copy_paste: z.string().min(6).max(10000),
  qr_code_base64: z.string().max(200000).nullish(),
  pix_qr_code_base64: z.string().max(200000).nullish(),
  expiration_date: z.string().nullish(),
});

/** Documented statuses: pending, approved, failed, expired, refunded, chargeback. */
export function mapVenuspayStatus(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  const map: Record<string, string> = { pending: "pending", approved: "paid", failed: "failed", declined: "failed", expired: "expired", refunded: "refunded", chargeback: "chargeback" };
  return map[s] ?? "unknown";
}

function headers(config: GatewayConfig): Record<string, string> | null {
  const key = (config.secrets["api_key"] ?? "").trim();
  if (!key) return null;
  return { "x-api-key": key, "content-type": "application/json", accept: "application/json" };
}

export function venuspayErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const e = (body as { error?: unknown; message?: unknown }).error ?? (body as { message?: unknown }).message;
  return typeof e === "string" && e ? e.replace(/sk_live_\w+|pk_live_\w+/g, "[chave]").slice(0, 200) : null;
}

export function venuspayPayload(input: PixChargeInput) {
  const cents = input.amountCents ?? Math.round(input.amount * 100);
  if (!Number.isSafeInteger(cents) || cents < 500) throw new Error("A VenusPay aceita PIX a partir de R$ 5,00.");
  const name = input.customer.name.trim();
  const email = input.customer.email.trim();
  if (!name || !z.email().safeParse(email).success) throw new Error("Confira o nome e o e-mail informados.");
  const document = input.customer.document.replace(/\D/g, "");
  const phone = (input.customer.phone ?? "").replace(/\D/g, "");
  return {
    amount: cents / 100,
    name, email,
    ...(document ? { document } : {}),
    ...(phone ? { phone } : {}),
    description: input.description.slice(0, 200),
    metadata: { ...(input.metadata ?? {}), order_number: input.orderNumber },
  };
}

export function parseVenuspayPix(body: unknown): PixChargeResult {
  const p = creation.safeParse(body);
  if (!p.success || !p.data.pix_copy_paste.startsWith("000201")) return { ok: false, uncertain: true, error: "Não foi possível confirmar a resposta da VenusPay. Aguarde antes de tentar novamente." };
  const img = p.data.qr_code_base64 ?? p.data.pix_qr_code_base64 ?? null;
  const expiry = p.data.expiration_date ? parseGatewayDate(p.data.expiration_date) : NaN;
  return {
    ok: true, transaction_id: p.data.transaction_id, copy_paste: p.data.pix_copy_paste,
    // Only accept a real image data URL; the EMV text is never treated as an image.
    qr_code: img && img.startsWith("data:image/") ? img : null,
    provider_status: mapVenuspayStatus(p.data.status ?? "pending"),
    expiration_date: Number.isFinite(expiry) ? new Date(expiry).toISOString() : null,
    expires_in: Number.isFinite(expiry) ? Math.max(0, Math.floor((expiry - Date.now()) / 1000)) : 3600,
  };
}

const friendly = (s: number) => s === 401 ? "Chave inválida, ausente ou revogada." : s === 403 ? "Sem permissão: use a chave secreta (sk_live_), não a pública." : s === 404 ? "Endpoint não encontrado." : s === 429 ? "Limite de requisições da VenusPay. Aguarde e tente novamente." : s === 400 || s === 422 ? "Alguns dados do pedido não foram aceitos. Confira seus dados e tente novamente." : "A VenusPay está indisponível no momento.";

/** HMAC-SHA256 of the raw body, header `X-Venuspay-Signature: sha256=<hex>`. */
export async function verifyVenuspaySignature(raw: string, header: string | null, secret: string): Promise<boolean> {
  if (!header || !secret) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const expected = "sha256=" + Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
  const got = header.trim();
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export const venuspay: PaymentProvider = {
  id: "venuspay",
  async testConnection(config) {
    const h = headers(config);
    if (!h) return { ok: false, error: "Informe a chave secreta (sk_live_)." };
    try {
      // VenusPay documents no read-only authenticated endpoint. An empty body is rejected
      // (amount/name/email are required, minimum R$ 5,00), so no charge can be created:
      // 401/403 = key rejected, 400/422 = key accepted.
      const res = await fetch(`${VENUSPAY_BASE}/process-payment`, { method: "POST", headers: h, body: "{}", signal: AbortSignal.timeout(10000) });
      const body: unknown = await res.json().catch(() => null);
      const detail = venuspayErrorMessage(body);
      console.info("[venuspay] test", JSON.stringify({ http_status: res.status }));
      if (res.status === 400 || res.status === 422) return { ok: true };
      return { ok: false, error: `${friendly(res.status)} (HTTP ${res.status}${detail ? `: ${detail}` : ""})` };
    } catch { return { ok: false, error: "Erro de comunicação com a VenusPay (tempo esgotado ou rede)." }; }
  },
  async createPix(config, input) {
    const h = headers(config);
    if (!h) return { ok: false, error: "Gateway sem credenciais." };
    let payload;
    try { payload = venuspayPayload(input); } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Confira os dados do pedido." }; }
    const start = Date.now();
    const audit = { provider: "venuspay", store_id: input.metadata?.["store_id"], order_id: input.metadata?.["order_id"] };
    try {
      const res = await fetch(`${VENUSPAY_BASE}/process-payment`, { method: "POST", headers: h, body: JSON.stringify(payload), signal: AbortSignal.timeout(VENUSPAY_CREATE_TIMEOUT_MS) });
      const body: unknown = await res.json().catch(() => null);
      const result: PixChargeResult = res.ok ? parseVenuspayPix(body) : { ok: false, error: friendly(res.status), uncertain: res.status >= 500 || ![400, 401, 403, 404, 422, 429].includes(res.status) };
      console.info("[venuspay] create", JSON.stringify({ ...audit, http_status: res.status, category: result.ok ? "CREATED" : result.uncertain ? "UNCERTAIN" : "REJECTED_REQUEST", ...(result.ok ? { transaction_id: result.transaction_id } : { detail: venuspayErrorMessage(body) }), ms: Date.now() - start }));
      return result;
    } catch {
      console.error("[venuspay] create", JSON.stringify({ ...audit, category: "NETWORK_OR_TIMEOUT", ms: Date.now() - start }));
      return { ok: false, uncertain: true, error: "A VenusPay ainda não confirmou a geração do PIX. Aguarde antes de tentar novamente." };
    }
  },
  async getStatus(_config, transactionId) {
    const res = await fetch(`${VENUSPAY_BASE}/check-payment-status?transaction_id=${encodeURIComponent(transactionId)}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`VenusPay consulta HTTP ${res.status}`);
    const tx = z.object({ transaction_id: z.string(), status: z.string() }).parse(await res.json());
    if (tx.transaction_id !== transactionId) throw new Error("VenusPay transação divergente.");
    const status = mapVenuspayStatus(tx.status);
    return { paid: status === "paid", status };
  },
};
