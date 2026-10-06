/**
 * Camada de integração dos gateways (executa somente no servidor).
 * Cada provedor implementa a mesma interface, então novos gateways podem ser
 * adicionados sem reescrever o checkout.
 */

import type { PaymentEnvironment, PaymentProviderId } from "./catalog";

export type GatewayConfig = {
  provider: PaymentProviderId;
  environment: PaymentEnvironment;
  secrets: Record<string, string>;
  publicData: Record<string, string>;
};

export type PixChargeInput = {
  orderNumber: string;
  amount: number;
  description: string;
  customer: { name: string; email: string; document: string; phone?: string };
  /** Campos detalhados (usados por provedores que exigem itens/entrega). Valores em centavos. */
  amountCents?: number;
  items?: Array<{ title: string; unit_price: number; quantity: number; tangible: boolean; external_ref?: string }>;
  shipping?: {
    fee: number;
    address: { street: string; street_number: string; complement: string; zip_code: string; neighborhood: string; city: string; state: string; country: string };
  };
  postbackUrl?: string;
  /** Origem do checkout (PinPay exige metadata.checkout_url). */
  checkoutUrl?: string;
  metadata?: Record<string, string>;
  expiresInDays?: number;
};

export type PixChargeResult =
  | {
      ok: true;
      transaction_id: string;
      qr_code: string | null;
      copy_paste: string | null;
      expires_in: number;
      provider_status?: string;
      expiration_date?: string | null;
      e2e?: string | null;
      amount_cents?: number | null;
      payment_url?: string | null;
    }
  | { ok: false; error: string };

export type StatusResult = { paid: boolean; status: string; e2e?: string | null; paid_at?: string | null };

export type PaymentProvider = {
  id: PaymentProviderId;
  testConnection(config: GatewayConfig): Promise<{ ok: boolean; error?: string; company?: { id?: string | undefined; fantasy_name?: string | undefined; status?: string | undefined } }>;
  createPix(config: GatewayConfig, input: PixChargeInput): Promise<PixChargeResult>;
  getStatus(config: GatewayConfig, transactionId: string): Promise<StatusResult>;
  /** Reembolso PIX. Ausente = provedor sem estorno pela API (feito manualmente no painel do provedor). */
  refund?(config: GatewayConfig, transactionId: string, amountCents: number, key: string): Promise<RefundResult>;
};

export type RefundResult = { ok: true; refund_id: string | null; status: string; done: boolean } | { ok: false; error: string };

const digits = (value: string) => value.replace(/\D/g, "");

// ---------------------------------------------------------------- Mercado Pago

const mercadopago: PaymentProvider = {
  id: "mercadopago",
  async testConnection(config) {
    const token = config.secrets["access_token"] ?? "";
    if (!token) return { ok: false, error: "Informe o Access Token." };
    const res = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return { ok: true };
    if (res.status === 401 || res.status === 403) return { ok: false, error: "Não foi possível autenticar. Verifique suas credenciais." };
    return { ok: false, error: "O provedor de pagamento não respondeu. Tente novamente." };
  },
  async createPix(config, input) {
    const token = config.secrets["access_token"] ?? "";
    if (!token) return { ok: false, error: "Gateway sem credenciais." };
    const [first, ...restName] = input.customer.name.trim().split(/\s+/);
    const doc = digits(input.customer.document);
    const res = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": input.orderNumber,
      },
      body: JSON.stringify({
        transaction_amount: Number(input.amount.toFixed(2)),
        description: input.description,
        payment_method_id: "pix",
        external_reference: input.orderNumber,
        payer: {
          email: input.customer.email,
          first_name: first ?? "Cliente",
          last_name: restName.join(" ") || "Cliente",
          identification: { type: doc.length > 11 ? "CNPJ" : "CPF", number: doc },
        },
      }),
    });
    const body = (await res.json().catch(() => null)) as
      | { id?: number | string; status?: string; message?: string; point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } } }
      | null;
    if (!res.ok || !body?.id) {
      return { ok: false, error: "O provedor não conseguiu gerar o PIX agora." };
    }
    const tx = body.point_of_interaction?.transaction_data ?? {};
    return {
      ok: true,
      transaction_id: String(body.id),
      qr_code: tx.qr_code_base64 ? `data:image/png;base64,${tx.qr_code_base64}` : null,
      copy_paste: tx.qr_code ?? null,
      expires_in: 1800,
    };
  },
  async getStatus(config, transactionId) {
    const token = config.secrets["access_token"] ?? "";
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${transactionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json().catch(() => null)) as { status?: string } | null;
    const status = body?.status ?? "unknown";
    return { paid: status === "approved", status };
  },
  async refund(config, transactionId, amountCents, key) {
    const token = config.secrets["access_token"] ?? "";
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${transactionId}/refunds`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Idempotency-Key": key },
      body: JSON.stringify({ amount: Number((amountCents / 100).toFixed(2)) }),
    });
    const body = (await res.json().catch(() => null)) as { id?: number | string; status?: string } | null;
    if (!res.ok || !body?.id) return { ok: false, error: "O provedor recusou o reembolso." };
    const status = body.status ?? "unknown";
    return { ok: true, refund_id: String(body.id), status, done: status === "approved" };
  },
};

// ----------------------------------------------------------------------- Asaas

function asaasBase(environment: PaymentEnvironment): string {
  return environment === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
}

const asaas: PaymentProvider = {
  id: "asaas",
  async testConnection(config) {
    const key = config.secrets["api_key"] ?? "";
    if (!key) return { ok: false, error: "Informe a chave de API." };
    const res = await fetch(`${asaasBase(config.environment)}/myAccount`, { headers: { access_token: key } });
    if (res.ok) return { ok: true };
    if (res.status === 401 || res.status === 403) return { ok: false, error: "Não foi possível autenticar. Verifique suas credenciais." };
    return { ok: false, error: "O provedor de pagamento não respondeu. Tente novamente." };
  },
  async createPix(config, input) {
    const key = config.secrets["api_key"] ?? "";
    if (!key) return { ok: false, error: "Gateway sem credenciais." };
    const base = asaasBase(config.environment);
    const headers = { access_token: key, "Content-Type": "application/json" };
    const doc = digits(input.customer.document);

    const found = await fetch(`${base}/customers?cpfCnpj=${doc}`, { headers }).then(
      (r) => r.json().catch(() => null) as Promise<{ data?: Array<{ id: string }> } | null>,
    );
    let customerId = found?.data?.[0]?.id ?? "";
    if (!customerId) {
      const created = await fetch(`${base}/customers`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: input.customer.name, email: input.customer.email, cpfCnpj: doc, mobilePhone: digits(input.customer.phone ?? "") }),
      }).then((r) => r.json().catch(() => null) as Promise<{ id?: string } | null>);
      customerId = created?.id ?? "";
    }
    if (!customerId) return { ok: false, error: "O provedor não conseguiu registrar o cliente." };

    const due = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const charge = (await fetch(`${base}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: Number(input.amount.toFixed(2)),
        dueDate: due,
        description: input.description,
        externalReference: input.orderNumber,
      }),
    }).then((r) => r.json().catch(() => null))) as { id?: string } | null;
    if (!charge?.id) return { ok: false, error: "O provedor não conseguiu gerar o PIX agora." };

    const qr = (await fetch(`${base}/payments/${charge.id}/pixQrCode`, { headers }).then((r) => r.json().catch(() => null))) as
      | { encodedImage?: string; payload?: string }
      | null;

    return {
      ok: true,
      transaction_id: charge.id,
      qr_code: qr?.encodedImage ? `data:image/png;base64,${qr.encodedImage}` : null,
      copy_paste: qr?.payload ?? null,
      expires_in: 1800,
    };
  },
  async getStatus(config, transactionId) {
    const key = config.secrets["api_key"] ?? "";
    const res = await fetch(`${asaasBase(config.environment)}/payments/${transactionId}`, { headers: { access_token: key } });
    const body = (await res.json().catch(() => null)) as { status?: string } | null;
    const status = body?.status ?? "unknown";
    return { paid: status === "RECEIVED" || status === "CONFIRMED" || status === "RECEIVED_IN_CASH", status };
  },
  async refund(config, transactionId, amountCents) {
    const key = config.secrets["api_key"] ?? "";
    const res = await fetch(`${asaasBase(config.environment)}/payments/${transactionId}/refund`, {
      method: "POST",
      headers: { access_token: key, "Content-Type": "application/json" },
      body: JSON.stringify({ value: Number((amountCents / 100).toFixed(2)) }),
    });
    const body = (await res.json().catch(() => null)) as { status?: string } | null;
    if (!res.ok) return { ok: false, error: "O provedor recusou o reembolso." };
    const status = body?.status ?? "REFUND_REQUESTED";
    return { ok: true, refund_id: null, status, done: status === "REFUNDED" };
  },
};

// ----------------------------------------------------------------- Wappi Brasil

const WAPPI_BASE = "https://api.wappibrasil.com.br";

function wappiHeaders(config: GatewayConfig): Record<string, string> | null {
  const publicKey = config.publicData["public_key"] ?? "";
  const secretKey = config.secrets["secret_key"] ?? "";
  if (!publicKey || !secretKey) return null;
  const basic = Buffer.from(`${publicKey}:${secretKey}`).toString("base64");
  return { Accept: "application/json", "Content-Type": "application/json", Authorization: `Basic ${basic}` };
}

type WappiPix = { expiration_date?: string | null; qr_code?: string | null; url?: string | null; e2_e?: string | null };
const pixOf = (tx: WappiTx | null): WappiPix | null => (!tx?.pix ? null : Array.isArray(tx.pix) ? (tx.pix[0] ?? null) : tx.pix);
/** A Wappi devolve "0001-01-01T00:00:00" quando não há data; tratamos como ausente. */
const validDate = (v: string | null | undefined): string | null => (v && Date.parse(v) > Date.parse("2000-01-01") ? v : null);

type WappiTx = {
  id?: string | number;
  amount?: number;
  payment_method?: string;
  status?: string;
  pix?: WappiPix | WappiPix[] | null;
};

function firstTx(body: unknown): WappiTx | null {
  if (!body || typeof body !== "object") return null;
  const data = (body as { data?: unknown }).data;
  if (Array.isArray(data)) return (data[0] as WappiTx) ?? null;
  if (data && typeof data === "object") return data as WappiTx;
  if ("id" in (body as object) || "status" in (body as object)) return body as WappiTx;
  return null;
}

/** Payload Pix Copia e Cola (padrão EMV do Banco Central) sempre começa com "000201". */
const isPixPayload = (v: string | null | undefined): v is string => typeof v === "string" && v.trim().startsWith("000201");
const isImage = (v: string | null | undefined): v is string => typeof v === "string" && (/^data:image\//.test(v) || /^https:\/\//.test(v));

async function qrFromPayload(payload: string): Promise<string | null> {
  try {
    const QR = await import("qrcode");
    const svg = await QR.toString(payload, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  } catch {
    return null;
  }
}

function wappiError(status: number): string {
  if (status === 401 || status === 403) return "Não foi possível autenticar. Verifique suas credenciais.";
  if (status === 400) return "Alguns dados do pedido não foram aceitos. Confira CPF/CNPJ, telefone e endereço.";
  return "O provedor de pagamento não respondeu. Tente novamente.";
}

const wappi: PaymentProvider = {
  id: "wappi",
  async testConnection(config) {
    const headers = wappiHeaders(config);
    if (!headers) return { ok: false, error: "Informe PUBLIC_KEY e SECRET_KEY." };
    const res = await fetch(`${WAPPI_BASE}/v1/company`, { headers });
    if (res.status === 200) {
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const company = ((body["data"] as Record<string, unknown>) ?? body) as Record<string, unknown>;
      return {
        ok: true,
        company: {
          id: company["id"] != null ? String(company["id"]) : undefined,
          fantasy_name: company["fantasy_name"] != null ? String(company["fantasy_name"]) : undefined,
          status: company["status"] != null ? String(company["status"]) : undefined,
        },
      };
    }
    return { ok: false, error: wappiError(res.status) };
  },
  async createPix(config, input) {
    const headers = wappiHeaders(config);
    if (!headers) return { ok: false, error: "Gateway sem credenciais." };
    if (!input.items?.length || !input.shipping || input.amountCents === undefined) {
      return { ok: false, error: "Pedido incompleto para gerar o PIX." };
    }
    const doc = digits(input.customer.document);
    let phone = digits(input.customer.phone ?? "");
    if (phone && !phone.startsWith("55")) phone = `55${phone}`;
    const body = {
      amount: input.amountCents,
      payment_method: "pix",
      ...(input.postbackUrl ? { postback_url: input.postbackUrl } : {}),
      customer: {
        name: input.customer.name.trim().slice(0, 120) || "Cliente",
        email: input.customer.email.trim().slice(0, 160),
        document: { number: doc, type: doc.length > 11 ? "cnpj" : "cpf" },
        ...(phone ? { phone: `+${phone}` } : {}),
      },
      items: input.items,
      shipping: input.shipping,
      pix: { expires_in_days: input.expiresInDays ?? 1 },
      metadata: { order_number: input.orderNumber, ...(input.metadata ?? {}) },
    };
    const res = await fetch(`${WAPPI_BASE}/v1/payment-transaction/create`, { method: "POST", headers, body: JSON.stringify(body) });
    const json = await res.json().catch(() => null);
    if (res.status !== 200 && res.status !== 201) {
      console.error("[wappi] create falhou", res.status, JSON.stringify((json as { message?: unknown; errors?: unknown } | null)?.message ?? (json as { errors?: unknown } | null)?.errors ?? null).slice(0, 400));
      return { ok: false, error: wappiError(res.status) };
    }
    const tx = firstTx(json);
    if (!tx?.id) return { ok: false, error: "O provedor não conseguiu gerar o PIX agora." };
    const pix = pixOf(tx);
    if (!pix) return { ok: false, error: "O provedor não retornou os dados do PIX. Tente novamente." };

    // Sem suposições: só usamos como copia-e-cola o que tem formato de payload Pix,
    // e como imagem o que é imagem/URL https. O QR é desenhado a partir do payload real.
    const copyPaste = isPixPayload(pix.qr_code) ? pix.qr_code.trim() : isPixPayload(pix.url) ? pix.url.trim() : null;
    let qr: string | null = isImage(pix.qr_code) ? pix.qr_code : null;
    if (!qr && copyPaste) qr = await qrFromPayload(copyPaste);
    if (!qr && isImage(pix.url)) qr = pix.url;
    if (!qr && !copyPaste) return { ok: false, error: "O provedor não retornou os dados do PIX. Tente novamente." };

    const expiration = validDate(pix.expiration_date);
    const expiresMs = expiration ? Date.parse(expiration) - Date.now() : NaN;
    return {
      ok: true,
      transaction_id: String(tx.id),
      qr_code: qr,
      copy_paste: copyPaste,
      expires_in: Number.isFinite(expiresMs) && expiresMs > 0 ? Math.floor(expiresMs / 1000) : 86400,
      provider_status: tx.status ?? "PENDING",
      expiration_date: expiration,
      e2e: pix.e2_e ?? null,
      amount_cents: typeof tx.amount === "number" ? tx.amount : null,
      payment_url: typeof pix.url === "string" && /^https:\/\//.test(pix.url) ? pix.url : null,
    };
  },
  async getStatus(config, transactionId) {
    const headers = wappiHeaders(config);
    if (!headers) return { paid: false, status: "unknown" };
    const res = await fetch(`${WAPPI_BASE}/v1/payment-transaction/info/${encodeURIComponent(transactionId)}`, { headers });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) throw new Error(`wappi info ${res.status}`);
    const tx = firstTx(json) as (WappiTx & { Status?: string; E2E?: string; PaidAt?: string; paid_at?: string }) | null;
    const status = String(tx?.status ?? tx?.Status ?? "unknown").toUpperCase();
    const e2e = pixOf(tx)?.e2_e ?? tx?.E2E ?? null;
    return { paid: status === "PAID", status, e2e, paid_at: tx?.PaidAt ?? tx?.paid_at ?? null };
  },
};

// ----------------------------------------------------------------------- PinPay
// Doc: https://hub.usepinpay.com/documentacao — Bearer sk_, valores em centavos.

export const PINPAY_BASE = "https://api.usepinpay.com/functions/v1/api-v1";

/** Status da PinPay → status interno (maiúsculo, mesmo padrão da Wappi). */
export function mapPinpayStatus(raw: unknown): string {
  const s = String(raw ?? "").toLowerCase();
  if (s === "paid" || s === "approved") return "PAID";
  if (s === "pending" || s === "processing") return "PENDING";
  if (s === "refunded") return "REFUNDED";
  if (s === "chargeback") return "CHARGEBACK";
  if (s === "expired") return "EXPIRED";
  if (s === "refused" || s === "failed") return "REFUSED";
  return "ERROR";
}

function pinpayError(status: number): string {
  if (status === 401 || status === 403) return "Não foi possível autenticar. Verifique a Secret Key da PinPay.";
  if (status === 422) return "Alguns dados do pedido não foram aceitos. Confira nome, e-mail e CPF/CNPJ.";
  if (status === 429) return "Muitas tentativas seguidas. Aguarde um minuto.";
  return "O provedor de pagamento não respondeu. Tente novamente.";
}

const pinpay: PaymentProvider = {
  id: "pinpay",
  async testConnection(config) {
    const key = config.secrets["secret_key"] ?? "";
    if (!key) return { ok: false, error: "Informe a Secret Key." };
    // Listar transações valida a chave sem criar cobrança.
    const res = await fetch(`${PINPAY_BASE}/transactions`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10000) });
    if (res.ok) return { ok: true };
    return { ok: false, error: pinpayError(res.status) };
  },
  async createPix(config, input) {
    const key = config.secrets["secret_key"] ?? "";
    if (!key) return { ok: false, error: "Gateway sem credenciais." };
    const amount = input.amountCents ?? Math.round(input.amount * 100);
    if (!Number.isInteger(amount) || amount < 100) return { ok: false, error: "A PinPay aceita PIX a partir de R$ 1,00." };
    const doc = digits(input.customer.document);
    const phone = digits(input.customer.phone ?? "");
    const body = {
      amount,
      description: input.description.slice(0, 140),
      customer: {
        name: input.customer.name.trim().slice(0, 120) || "Cliente",
        email: input.customer.email.trim().slice(0, 160),
        document: { type: doc.length > 11 ? "CNPJ" : "CPF", number: doc },
        ...(phone ? { phone } : {}),
      },
      expires_in: 900,
      ...(input.postbackUrl ? { webhook_url: input.postbackUrl } : {}),
      metadata: {
        external_reference: input.orderNumber,
        checkout_url: input.checkoutUrl ?? "",
      },
    };
    const res = await fetch(`${PINPAY_BASE}/pix`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `pix-${input.orderNumber}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const json = (await res.json().catch(() => null)) as
      | { id?: string; status?: string; amount?: number; qr_code?: string; qr_code_url?: string; expires_at?: string; pix?: { qr_code?: string; qr_code_url?: string; expires_at?: string } }
      | null;
    if (res.status !== 200 && res.status !== 201) {
      console.error("[pinpay] create falhou", res.status, JSON.stringify(json ?? null).slice(0, 300));
      return { ok: false, error: pinpayError(res.status) };
    }
    if (!json?.id) return { ok: false, error: "O provedor não conseguiu gerar o PIX agora." };
    const payload = json.pix?.qr_code ?? json.qr_code ?? null;
    const imgUrl = json.pix?.qr_code_url ?? json.qr_code_url ?? null;
    const copyPaste = isPixPayload(payload) ? payload.trim() : null;
    let qr: string | null = copyPaste ? await qrFromPayload(copyPaste) : null;
    if (!qr && isImage(imgUrl)) qr = imgUrl;
    if (!qr && !copyPaste) return { ok: false, error: "O provedor não retornou os dados do PIX. Tente novamente." };
    const expiresAt = json.pix?.expires_at ?? json.expires_at ?? null;
    const expMs = expiresAt ? Date.parse(expiresAt) - Date.now() : NaN;
    return {
      ok: true,
      transaction_id: String(json.id),
      qr_code: qr,
      copy_paste: copyPaste,
      expires_in: Number.isFinite(expMs) && expMs > 0 ? Math.floor(expMs / 1000) : 900,
      provider_status: mapPinpayStatus(json.status ?? "pending"),
      expiration_date: expiresAt,
      amount_cents: typeof json.amount === "number" ? json.amount : null,
    };
  },
  async getStatus(config, transactionId) {
    const key = config.secrets["secret_key"] ?? "";
    if (!key) return { paid: false, status: "unknown" };
    const res = await fetch(`${PINPAY_BASE}/transactions/${encodeURIComponent(transactionId)}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`pinpay transaction ${res.status}`);
    const tx = (await res.json().catch(() => null)) as { status?: string; paid_at?: string; approved_at?: string } | null;
    const status = mapPinpayStatus(tx?.status);
    return { paid: status === "PAID", status, paid_at: tx?.approved_at ?? tx?.paid_at ?? null };
  },
};

// --------------------------------------------------------------------- Blackcat
// Doc: https://docs.blackcatoficial.com — header X-API-Key, valores em centavos.

export const BLACKCAT_BASE = "https://api.blackcatoficial.com/api";

/** Status da Blackcat → status interno (maiúsculo). CANCELLED = cancelado ou expirado. */
export function mapBlackcatStatus(raw: unknown): string {
  const s = String(raw ?? "").toUpperCase();
  if (s === "PAID" || s === "PENDING" || s === "REFUNDED" || s === "CANCELLED") return s;
  if (s === "FAILED" || s === "EXPIRED") return "CANCELLED";
  return "ERROR";
}

function blackcatError(status: number): string {
  if (status === 401 || status === 403) return "Não foi possível autenticar. Verifique a API Key da Blackcat.";
  if (status === 400 || status === 422) return "Alguns dados do pedido não foram aceitos. Confira nome, e-mail, telefone, CPF e endereço.";
  if (status === 429) return "Muitas tentativas seguidas. Aguarde um minuto.";
  return "O provedor de pagamento não respondeu. Tente novamente.";
}

const blackcat: PaymentProvider = {
  id: "blackcat",
  async testConnection(config) {
    const key = config.secrets["api_key"] ?? "";
    if (!key) return { ok: false, error: "Informe a API Key." };
    const res = await fetch(`${BLACKCAT_BASE}/sales/seller`, { headers: { "X-API-Key": key }, signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const j = (await res.json().catch(() => null)) as { data?: { name?: string } } | null;
      return { ok: true, company: { fantasy_name: j?.data?.name } };
    }
    return { ok: false, error: blackcatError(res.status) };
  },
  async createPix(config, input) {
    const key = config.secrets["api_key"] ?? "";
    if (!key) return { ok: false, error: "Gateway sem credenciais." };
    const amount = input.amountCents ?? Math.round(input.amount * 100);
    if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: "Valor do pedido inválido." };
    const doc = digits(input.customer.document);
    const name = input.customer.name.trim().slice(0, 120) || "Cliente";
    const items = (input.items?.length ? input.items : [{ title: input.description, unit_price: amount, quantity: 1, tangible: true }]).map((i) => ({
      title: i.title.slice(0, 140),
      unitPrice: i.unit_price,
      quantity: i.quantity,
      tangible: i.tangible,
    }));
    const a = input.shipping?.address;
    const body: Record<string, unknown> = {
      amount,
      currency: "BRL",
      paymentMethod: "pix",
      items,
      customer: {
        name,
        email: input.customer.email.trim().slice(0, 160),
        phone: digits(input.customer.phone ?? ""),
        document: { number: doc, type: doc.length > 11 ? "cnpj" : "cpf" },
      },
      pix: { expiresInDays: Math.max(1, input.expiresInDays ?? 1) },
      externalRef: input.orderNumber,
      ...(input.postbackUrl ? { postbackUrl: input.postbackUrl } : {}),
    };
    if (a) {
      body["shipping"] = {
        name,
        street: a.street,
        number: a.street_number,
        complement: a.complement,
        neighborhood: a.neighborhood,
        city: a.city,
        state: a.state,
        zipCode: a.zip_code,
      };
    }
    const res = await fetch(`${BLACKCAT_BASE}/sales/create-sale`, {
      method: "POST",
      headers: { "X-API-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const json = (await res.json().catch(() => null)) as
      | { success?: boolean; message?: string; error?: string; data?: { transactionId?: string; status?: string; amount?: number; invoiceUrl?: string; paymentData?: { qrCode?: string; qrCodeBase64?: string; copyPaste?: string; expiresAt?: string } } }
      | null;
    if (!res.ok || !json?.success || !json.data?.transactionId) {
      console.error("[blackcat] create falhou", res.status, json?.message ?? "", json?.error ?? "");
      return { ok: false, error: blackcatError(res.status) };
    }
    const d = json.data;
    const pd = d.paymentData ?? {};
    const copyPaste = isPixPayload(pd.copyPaste) ? pd.copyPaste.trim() : isPixPayload(pd.qrCode) ? pd.qrCode.trim() : null;
    let qr: string | null = typeof pd.qrCodeBase64 === "string" && pd.qrCodeBase64.startsWith("data:image/") ? pd.qrCodeBase64 : null;
    if (!qr && copyPaste) qr = await qrFromPayload(copyPaste);
    if (!qr && !copyPaste) return { ok: false, error: "O provedor não retornou os dados do PIX. Tente novamente." };
    const expiresAt = pd.expiresAt ?? null;
    const expMs = expiresAt ? Date.parse(expiresAt) - Date.now() : NaN;
    return {
      ok: true,
      transaction_id: String(d.transactionId),
      qr_code: qr,
      copy_paste: copyPaste,
      expires_in: Number.isFinite(expMs) && expMs > 0 ? Math.floor(expMs / 1000) : 86400,
      provider_status: mapBlackcatStatus(d.status ?? "PENDING"),
      expiration_date: expiresAt,
      amount_cents: typeof d.amount === "number" ? d.amount : null,
      payment_url: d.invoiceUrl ?? null,
    };
  },
  async getStatus(config, transactionId) {
    const key = config.secrets["api_key"] ?? "";
    if (!key) return { paid: false, status: "unknown" };
    const res = await fetch(`${BLACKCAT_BASE}/sales/${encodeURIComponent(transactionId)}/status`, {
      headers: { "X-API-Key": key },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`blackcat status ${res.status}`);
    const j = (await res.json().catch(() => null)) as { data?: { status?: string; paidAt?: string; endToEndId?: string } } | null;
    const status = mapBlackcatStatus(j?.data?.status);
    return { paid: status === "PAID", status, paid_at: j?.data?.paidAt ?? null, e2e: j?.data?.endToEndId ?? null };
  },
};

const REGISTRY: Record<string, PaymentProvider> = { wappi, pinpay, blackcat, mercadopago, asaas };

export function getProvider(id: string): PaymentProvider | null {
  return REGISTRY[id] ?? null;
}
