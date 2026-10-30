/** Contract: https://app.medusapayoficial.pro/docs (reviewed 2026-10-30). Server only. */
import { z } from "zod";
import type { GatewayConfig, PaymentProvider, PixChargeInput, PixChargeResult } from "./providers.server";

export const MEDUSAPAY_BASE = "https://api.medusapayoficial.pro/api/v1/api";
export const MEDUSAPAY_CREATE_TIMEOUT_MS = 25000;

const createSchema = z.object({
  venda: z.object({ id: z.string().min(1).max(100), valor: z.union([z.string(), z.number()]).optional(), status: z.string().max(30), simulada: z.boolean().optional() }),
  pixQrCode: z.string().max(200000).nullish(),
  pixCopiaECola: z.string().max(10000).nullish(),
  pixExpiresAt: z.string().max(40).nullish(),
});

const saleSchema = z.object({
  id: z.string().min(1).max(100),
  valor: z.union([z.string(), z.number()]).optional(),
  status: z.string().max(30),
});

/** Status documentados: pendente, aprovado, recusado, estornado (+ outros normalizados como unknown). */
export function mapMedusapayStatus(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  const map: Record<string, string> = { pendente: "pending", aprovado: "paid", recusado: "refused", estornado: "refunded", expirado: "expired", cancelado: "canceled" };
  return map[s] ?? "unknown";
}

/** idempotencyKey documentada: ID único por pedido; mesma chave devolve a venda original (200). */
export function medusapayIdempotencyKey(orderNumber: string): string {
  const clean = orderNumber.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 100);
  return clean.length >= 8 ? clean : `pix-${clean}`.padEnd(8, "0");
}

const toCents = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

function headers(config: GatewayConfig): Record<string, string> | null {
  const key = (config.secrets["api_key"] ?? "").trim();
  if (!key) return null;
  return { authorization: `Bearer ${key}`, "content-type": "application/json", accept: "application/json" };
}

/** Erro documentado: { message, code }. Nunca devolve chaves. */
export function medusapayErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { message?: unknown; code?: unknown };
  const full = [typeof b.message === "string" ? b.message.trim() : "", typeof b.code === "string" ? b.code : ""].filter(Boolean).join(" — ");
  return full ? full.replace(/mk_live_\w+/g, "[chave]").slice(0, 300) : null;
}

const friendly = (s: number) =>
  s === 401 ? "API Key ausente ou inválida." :
  s === 403 ? "Operação não permitida para esta conta MedusaPay." :
  s === 404 ? "Venda não encontrada." :
  s === 400 ? "Alguns dados do pedido não foram aceitos (confira CPF, e-mail e valor)." :
  s === 502 ? "Todos os adquirentes da MedusaPay falharam. Tente novamente." :
  s === 503 ? "A conta MedusaPay está sem adquirente ativo." :
  "A MedusaPay está indisponível no momento. Tente novamente.";

export function medusapayPayload(input: PixChargeInput) {
  const cents = input.amountCents ?? Math.round(input.amount * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error("Valor inválido para a MedusaPay.");
  const clienteNome = input.customer.name.trim().slice(0, 120);
  const clienteEmail = input.customer.email.trim();
  if (!clienteNome || !z.email().safeParse(clienteEmail).success) throw new Error("Confira o nome e o e-mail informados.");
  const clienteCpf = input.customer.document.replace(/\D/g, "");
  if (clienteCpf.length !== 11 && clienteCpf.length !== 14) throw new Error("Informe um CPF/CNPJ válido.");
  return {
    clienteNome,
    clienteEmail,
    clienteCpf,
    valor: cents / 100,
    metodo: "PIX",
    produto: input.description.slice(0, 200),
    idempotencyKey: medusapayIdempotencyKey(input.orderNumber),
    ...(input.postbackUrl ? { metadata: { postback_url: input.postbackUrl } } : {}),
  };
}

export function parseMedusapayCreate(body: unknown): PixChargeResult {
  const p = createSchema.safeParse(body);
  if (p.success && p.data.venda.simulada) return { ok: false, error: "A conta MedusaPay está em Modo Teste (venda simulada, sem PIX real)." };
  const cp = p.success ? p.data.pixCopiaECola : null;
  if (!p.success || !cp || !cp.startsWith("000201")) return { ok: false, uncertain: true, error: "Não foi possível confirmar a resposta da MedusaPay. Aguarde antes de tentar novamente." };
  const expiry = p.data.pixExpiresAt ? Date.parse(p.data.pixExpiresAt) : NaN;
  const qr = p.data.pixQrCode && p.data.pixQrCode.startsWith("data:image/") ? p.data.pixQrCode : null;
  return {
    ok: true,
    transaction_id: p.data.venda.id,
    copy_paste: cp,
    qr_code: qr,
    provider_status: mapMedusapayStatus(p.data.venda.status),
    expiration_date: Number.isFinite(expiry) ? new Date(expiry).toISOString() : null,
    expires_in: Number.isFinite(expiry) ? Math.max(0, Math.floor((expiry - Date.now()) / 1000)) : 900, // sem pixExpiresAt: janela da loja (15 min)
    e2e: null,
    amount_cents: toCents(p.data.venda.valor),
  };
}

async function qrFromPayload(payload: string): Promise<string | null> {
  try {
    const QR = await import("qrcode");
    const svg = await QR.toString(payload, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  } catch {
    return null;
  }
}

async function hmacHex(secret: string, text: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Assinatura documentada: X-Medusa-Signature: sha256=<hex HMAC-SHA256(secret, JSON.stringify(body))>.
 * Aceita o corpo bruto ou a re-serialização (o exemplo oficial assina JSON.stringify do corpo).
 */
export async function verifyMedusapaySignature(raw: string, header: string | null, secret: string): Promise<boolean> {
  if (!header || !secret) return false;
  const got = header.trim().replace(/^sha256=/i, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(got)) return false;
  const candidates = [raw];
  try { const re = JSON.stringify(JSON.parse(raw)); if (re !== raw) candidates.push(re); } catch { /* inválido */ }
  let ok = false;
  for (const text of candidates) {
    const expected = await hmacHex(secret, text);
    let diff = 0;
    for (let i = 0; i < 64; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
    if (diff === 0) ok = true;
  }
  return ok;
}

export const medusapay: PaymentProvider = {
  id: "medusapay",
  async testConnection(config) {
    const h = headers(config);
    if (!h) return { ok: false, error: "Informe a API Key (mk_live_)." };
    try {
      // Consulta read-only de venda inexistente: 404 = chave aceita; 401 = chave inválida. Não cria cobrança.
      const res = await fetch(`${MEDUSAPAY_BASE}/pagamentos/00000000-0000-4000-8000-000000000000`, { headers: h, signal: AbortSignal.timeout(10000) });
      const body: unknown = await res.json().catch(() => null);
      const detail = medusapayErrorMessage(body);
      console.info("[medusapay] test", JSON.stringify({ http_status: res.status }));
      if (res.status === 404 || res.ok) return { ok: true };
      return { ok: false, error: `${friendly(res.status)} (HTTP ${res.status}${detail ? `: ${detail}` : ""})` };
    } catch {
      return { ok: false, error: "Erro de comunicação com a MedusaPay (tempo esgotado ou rede)." };
    }
  },
  async createPix(config, input) {
    const h = headers(config);
    if (!h) return { ok: false, error: "Gateway sem credenciais." };
    let payload;
    try {
      payload = medusapayPayload(input);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Confira os dados do pedido." };
    }
    const start = Date.now();
    const audit = { provider: "medusapay", store_id: input.metadata?.["store_id"], order_id: input.metadata?.["order_id"] };
    try {
      const res = await fetch(`${MEDUSAPAY_BASE}/pagamentos`, { method: "POST", headers: h, body: JSON.stringify(payload), signal: AbortSignal.timeout(MEDUSAPAY_CREATE_TIMEOUT_MS) });
      const body: unknown = await res.json().catch(() => null);
      // 5xx/rede: repetir com o MESMO idempotencyKey devolve a venda original (documentado).
      const result: PixChargeResult = res.ok ? parseMedusapayCreate(body) : { ok: false, error: friendly(res.status), uncertain: res.status >= 500 && res.status !== 503 };
      if (result.ok && result.copy_paste && !result.qr_code) result.qr_code = await qrFromPayload(result.copy_paste);
      console.info("[medusapay] create", JSON.stringify({ ...audit, http_status: res.status, category: result.ok ? "CREATED" : result.uncertain ? "UNCERTAIN" : "REJECTED_REQUEST", ...(result.ok ? { transaction_id: result.transaction_id } : { detail: medusapayErrorMessage(body) }), ms: Date.now() - start }));
      return result;
    } catch {
      console.error("[medusapay] create", JSON.stringify({ ...audit, category: "NETWORK_OR_TIMEOUT", ms: Date.now() - start }));
      return { ok: false, uncertain: true, error: "A MedusaPay ainda não confirmou a geração do PIX. Aguarde antes de tentar novamente." };
    }
  },
  async getStatus(config, transactionId) {
    const h = headers(config);
    if (!h) throw new Error("MedusaPay sem credenciais.");
    const res = await fetch(`${MEDUSAPAY_BASE}/pagamentos/${encodeURIComponent(transactionId)}`, { headers: h, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`MedusaPay consulta HTTP ${res.status}`);
    const raw: unknown = await res.json();
    const tx = saleSchema.parse(raw && typeof raw === "object" && "venda" in raw ? (raw as { venda: unknown }).venda : raw);
    if (tx.id !== transactionId) throw new Error("MedusaPay venda divergente.");
    const status = mapMedusapayStatus(tx.status);
    return { paid: status === "paid", status, e2e: null, paid_at: null, amount_cents: toCents(tx.valor) };
  },
};
