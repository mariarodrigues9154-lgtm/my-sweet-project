/** Contract: https://pixxblack.com/docs/api (reviewed 2026-10-30). Server only. */
import { z } from "zod";
import type { GatewayConfig, PaymentProvider, PixChargeInput, PixChargeResult } from "./providers.server";

export const PIXXBLACK_BASE = "https://pixxblack.com/api/v1";
export const PIXXBLACK_CREATE_TIMEOUT_MS = 25000;
/** A PixxBlack expira o Pix 30 minutos após a criação (fixo, não configurável pela API). */
export const PIXXBLACK_PIX_TTL_SECONDS = 1800;

const chargeSchema = z.object({
  id: z.string().min(1).max(100),
  status: z.string().max(30),
  amount_cents: z.number().int().optional(),
  external_reference: z.string().max(120).nullish(),
  pix: z.object({ copy_paste: z.string().min(6).max(10000), expires_at: z.string().max(40) }).nullish(),
  paid_at: z.string().nullish(),
  end_to_end_id: z.string().max(120).nullish(),
});

/** Statuses documentados: pending, paid, expired, canceled, refunded. */
export function mapPixxblackStatus(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  const map: Record<string, string> = { pending: "pending", paid: "paid", expired: "expired", canceled: "canceled", refunded: "refunded" };
  return map[s] ?? "unknown";
}

/** Idempotency-Key documentada: 8–100 caracteres [A-Za-z0-9_-]. Mesma chave + mesmo corpo = mesma cobrança. */
export function pixxblackIdempotencyKey(orderNumber: string): string {
  const clean = orderNumber.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 100);
  return clean.length >= 8 ? clean : `pix-${clean}`.padEnd(8, "0");
}

/** external_reference documentada: até 100 caracteres [A-Za-z0-9._:/-]. */
const externalRef = (orderNumber: string) => orderNumber.replace(/[^A-Za-z0-9._:/-]/g, "-").slice(0, 100);

function headers(config: GatewayConfig): Record<string, string> | null {
  const key = (config.secrets["api_key"] ?? "").trim();
  if (!key) return null;
  return { authorization: `Bearer ${key}`, "content-type": "application/json", accept: "application/json" };
}

/** Erros documentados: { message, issues?: [{ path, message }] }. Nunca devolve chaves. */
export function pixxblackErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { message?: unknown; issues?: unknown };
  const msg = typeof b.message === "string" ? b.message.trim() : "";
  const issues = Array.isArray(b.issues)
    ? b.issues
        .map((i) => (i && typeof i === "object" ? `${String((i as { path?: unknown }).path ?? "?")}: ${String((i as { message?: unknown }).message ?? "?")}` : ""))
        .filter(Boolean)
    : [];
  const full = [msg, ...issues].filter(Boolean).join(" | ");
  return full ? full.replace(/pxb_live_\w+|whsec_\w+/g, "[chave]").slice(0, 300) : null;
}

const friendly = (s: number) =>
  s === 401 ? "Chave de API ausente ou inválida." :
  s === 403 ? "IP não autorizado ou conta ainda não verificada (KYC) na PixxBlack." :
  s === 404 ? "Cobrança não encontrada." :
  s === 422 ? "Conflito de idempotência: a mesma chave foi usada com dados diferentes." :
  s === 429 ? "Limite de requisições da PixxBlack (300/min). Aguarde e tente novamente." :
  s === 400 ? "Alguns dados do pedido não foram aceitos. Confira os dados e tente novamente." :
  "A PixxBlack está indisponível no momento. Tente novamente.";

export function pixxblackPayload(input: PixChargeInput) {
  const cents = input.amountCents ?? Math.round(input.amount * 100);
  if (!Number.isSafeInteger(cents) || cents < 500) throw new Error("A PixxBlack aceita PIX a partir de R$ 5,00.");
  if (cents > 100000000) throw new Error("Valor acima do máximo aceito pela PixxBlack.");
  const name = input.customer.name.trim().slice(0, 120);
  const email = input.customer.email.trim();
  if (!name || !z.email().safeParse(email).success) throw new Error("Confira o nome e o e-mail informados.");
  const document = input.customer.document.replace(/\D/g, "");
  return {
    amount_cents: cents,
    description: input.description.slice(0, 140),
    external_reference: externalRef(input.orderNumber),
    payer: { name, email, ...(document.length === 11 || document.length === 14 ? { document } : {}) },
  };
}

export function parsePixxblackCharge(body: unknown): PixChargeResult {
  const p = chargeSchema.safeParse(body);
  const cp = p.success ? p.data.pix?.copy_paste : null;
  if (!p.success || !cp || !cp.startsWith("000201")) return { ok: false, uncertain: true, error: "Não foi possível confirmar a resposta da PixxBlack. Aguarde antes de tentar novamente." };
  const expiry = p.data.pix?.expires_at ? Date.parse(p.data.pix.expires_at) : NaN;
  return {
    ok: true,
    transaction_id: p.data.id,
    copy_paste: cp,
    qr_code: null, // desenhado a partir do copia-e-cola (a API não envia imagem)
    provider_status: mapPixxblackStatus(p.data.status),
    expiration_date: Number.isFinite(expiry) ? new Date(expiry).toISOString() : null,
    expires_in: Number.isFinite(expiry) ? Math.max(0, Math.floor((expiry - Date.now()) / 1000)) : PIXXBLACK_PIX_TTL_SECONDS,
    e2e: p.data.end_to_end_id ?? null,
    amount_cents: p.data.amount_cents ?? null,
  };
}

/** A API devolve só o copia-e-cola; o QR é desenhado localmente a partir do mesmo payload EMV. */
async function qrFromPayload(payload: string): Promise<string | null> {
  try {
    const QR = await import("qrcode");
    const svg = await QR.toString(payload, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Assinatura documentada: X-PixBlack-Signature: t=<unix>,v1=<hex HMAC-SHA256(segredo, "<t>.<corpo bruto>")>.
 * Recusa diferença maior que 300 segundos e compara em tempo constante.
 */
export async function verifyPixxblackSignature(raw: string, header: string | null, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=", 2)));
  const t = Number(parts["t"]);
  const v1 = String(parts["v1"] ?? "");
  if (!Number.isInteger(t) || !/^[0-9a-f]{64}$/.test(v1)) return false;
  if (Math.abs(nowSeconds - t) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`)));
  const expected = Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= v1.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export const pixxblack: PaymentProvider = {
  id: "pixxblack",
  async testConnection(config) {
    const h = headers(config);
    if (!h) return { ok: false, error: "Informe a chave de API (pxb_live_)." };
    try {
      // Consulta read-only de uma cobrança inexistente: 404 = chave aceita, sem criar cobrança.
      const res = await fetch(`${PIXXBLACK_BASE}/charges/teste-conexao`, { headers: h, signal: AbortSignal.timeout(10000) });
      const body: unknown = await res.json().catch(() => null);
      const detail = pixxblackErrorMessage(body);
      console.info("[pixxblack] test", JSON.stringify({ http_status: res.status }));
      if (res.status === 404 || res.ok) return { ok: true };
      return { ok: false, error: `${friendly(res.status)} (HTTP ${res.status}${detail ? `: ${detail}` : ""})` };
    } catch {
      return { ok: false, error: "Erro de comunicação com a PixxBlack (tempo esgotado ou rede)." };
    }
  },
  async createPix(config, input) {
    const h = headers(config);
    if (!h) return { ok: false, error: "Gateway sem credenciais." };
    let payload;
    try {
      payload = pixxblackPayload(input);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Confira os dados do pedido." };
    }
    const start = Date.now();
    const audit = { provider: "pixxblack", store_id: input.metadata?.["store_id"], order_id: input.metadata?.["order_id"] };
    try {
      const res = await fetch(`${PIXXBLACK_BASE}/charges`, {
        method: "POST",
        headers: { ...h, "idempotency-key": pixxblackIdempotencyKey(input.orderNumber) },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(PIXXBLACK_CREATE_TIMEOUT_MS),
      });
      const body: unknown = await res.json().catch(() => null);
      // 429/503/rede: tentar de novo com a MESMA Idempotency-Key devolve a mesma cobrança (documentado).
      const result: PixChargeResult = res.ok
        ? parsePixxblackCharge(body)
        : { ok: false, error: friendly(res.status), uncertain: res.status === 429 || res.status >= 500 };
      if (result.ok && result.copy_paste && !result.qr_code) result.qr_code = await qrFromPayload(result.copy_paste);
      console.info("[pixxblack] create", JSON.stringify({ ...audit, http_status: res.status, category: result.ok ? "CREATED" : result.uncertain ? "UNCERTAIN" : "REJECTED_REQUEST", ...(result.ok ? { transaction_id: result.transaction_id } : { detail: pixxblackErrorMessage(body) }), ms: Date.now() - start }));
      return result;
    } catch {
      console.error("[pixxblack] create", JSON.stringify({ ...audit, category: "NETWORK_OR_TIMEOUT", ms: Date.now() - start }));
      return { ok: false, uncertain: true, error: "A PixxBlack ainda não confirmou a geração do PIX. Aguarde antes de tentar novamente." };
    }
  },
  async getStatus(config, transactionId) {
    const h = headers(config);
    if (!h) throw new Error("PixxBlack sem credenciais.");
    const res = await fetch(`${PIXXBLACK_BASE}/charges/${encodeURIComponent(transactionId)}`, { headers: h, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`PixxBlack consulta HTTP ${res.status}`);
    const tx = chargeSchema.parse(await res.json());
    if (tx.id !== transactionId) throw new Error("PixxBlack cobrança divergente.");
    const status = mapPixxblackStatus(tx.status);
    return { paid: status === "paid", status, e2e: tx.end_to_end_id ?? null, paid_at: tx.paid_at ?? null, amount_cents: tx.amount_cents ?? null };
  },
};
