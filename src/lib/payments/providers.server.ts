/**
 * Camada de integração dos gateways (executa somente no servidor).
 * Cada provedor implementa a mesma interface, então novos gateways podem ser
 * adicionados sem reescrever o checkout.
 */

import { isValidCpfCnpj, isValidPhone } from "@/lib/format";
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

/** Extrai a mensagem real da Wappi: error_messages[].message ou o mapa errors {campo: [msg]} (RFC 9110). */
export function wappiErrorDetail(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const j = json as { message?: unknown; error_messages?: unknown; errors?: unknown };
  if (Array.isArray(j.error_messages)) {
    const msgs = j.error_messages
      .map((e) => (e && typeof e === "object" ? String((e as { message?: unknown }).message ?? "").trim() : ""))
      .filter(Boolean);
    if (msgs.length) return msgs.join(" | ");
  }
  if (j.errors && typeof j.errors === "object" && !Array.isArray(j.errors)) {
    const parts = Object.entries(j.errors as Record<string, unknown>).map(
      ([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(", ") : String(msgs)}`,
    );
    if (parts.length) return parts.join(" | ");
  }
  return typeof j.message === "string" && j.message.trim() ? j.message : null;
}

/** Mensagem amigável por campo quando a Wappi devolve erro de validação (RFC 9110). */
function wappiFieldError(detail: string): string | null {
  const d = detail.toLowerCase();
  if (d.includes("phone")) return "Informe um telefone válido com DDD.";
  if (d.includes("document")) return "Confira o CPF/CNPJ informado.";
  if (d.includes("zip") || d.includes("cep")) return "Confira o CEP informado.";
  if (d.includes("street_number")) return "Confira o número do endereço.";
  if (d.includes("street") || d.includes("neighborhood") || d.includes("city") || d.includes("state")) return "Confira o endereço informado.";
  if (d.includes("email")) return "Confira o e-mail informado.";
  if (d.includes("name")) return "Confira o nome informado.";
  return null;
}

function wappiError(status: number, detail?: string | null): string {
  if (status === 401 || status === 403) return "Não foi possível autenticar. Verifique suas credenciais.";
  if (status === 400) {
    if (detail) {
      const field = wappiFieldError(detail);
      if (field) return field;
      // Recusa do adquirente (ex.: GETNET_HTTP_ERROR): não é campo inválido do checkout.
      if (detail.toLowerCase().includes("adquirente")) return "O provedor de pagamento recusou a transação. Tente novamente em alguns minutos.";
    }
    return "Alguns dados do pedido não foram aceitos. Confira CPF/CNPJ, telefone e endereço.";
  }
  return "O provedor de pagamento não respondeu. Tente novamente.";
}

/** Validação local antes de enviar à Wappi: devolve a mensagem do campo inválido ou null. */
export function validateWappiInput(input: {
  doc: string;
  phone: string;
  address: { street: string; street_number: string; zip_code: string; neighborhood: string; city: string; state: string };
}): string | null {
  if (!isValidCpfCnpj(input.doc)) return "Confira o CPF/CNPJ informado.";
  if (!isValidPhone(input.phone)) return "Informe um telefone válido com DDD.";
  const a = input.address;
  if (!a.street.trim()) return "Confira o endereço informado.";
  if (!a.street_number.trim()) return "Confira o número do endereço.";
  if (a.zip_code.replace(/\D/g, "").length !== 8) return "Confira o CEP informado.";
  if (!a.neighborhood.trim() || !a.city.trim() || a.state.trim().length !== 2) return "Confira o endereço informado.";
  return null;
}

/** Wappi e FreePay Brasil usam a mesma API (Basic Auth, /v1/payment-transaction, centavos). */
function makeBasicPixProvider(id: "wappi" | "freepay", BASE: string): PaymentProvider {
  const label = id === "freepay" ? "freepay" : "wappi";
  return {
  id,
  async testConnection(config) {
    if (id === "freepay") {
      // Validação segura pela rota documentada de consulta: 404 = credenciais aceitas.
      const h = wappiHeaders(config);
      if (!h) return { ok: false, error: "Informe a Public Key e a Secret Key." };
      const r = await fetch(`${BASE}/v1/payment-transaction/info/teste-conexao`, { headers: h, signal: AbortSignal.timeout(10000) });
      if (r.status === 401 || r.status === 403) return { ok: false, error: "Não foi possível autenticar. Verifique a Public Key e a Secret Key da FreePay." };
      if (r.status === 404 || r.ok) return { ok: true, company: { fantasy_name: "FreePay Brasil" } };
      return { ok: false, error: "A FreePay não respondeu. Tente novamente." };
    }
    const headers = wappiHeaders(config);
    if (!headers) return { ok: false, error: "Informe PUBLIC_KEY e SECRET_KEY." };
    const res = await fetch(`${BASE}/v1/company`, { headers });
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
    if (id === "wappi") {
      // Validação local com mensagem por campo: não envia CPF/telefone/endereço inválido ao gateway.
      const invalid = validateWappiInput({ doc, phone, address: input.shipping.address });
      if (invalid) {
        console.warn("[wappi] validação local reprovou", { order: input.orderNumber, campo: invalid });
        return { ok: false, error: invalid };
      }
    }
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
    const res = await fetch(`${BASE}/v1/payment-transaction/create`, { method: "POST", headers, body: JSON.stringify(body) });
    const json = await res.json().catch(() => null);
    if (res.status !== 200 && res.status !== 201) {
      // Registra a resposta real do gateway (sem credenciais) para diagnóstico da recusa.
      const detail = wappiErrorDetail(json);
      console.error(`[${label}] create falhou`, res.status, JSON.stringify({ order: input.orderNumber, detail: (detail ?? "sem detalhe").slice(0, 400) }));
      return { ok: false, error: wappiError(res.status, detail) };
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
    const res = await fetch(`${BASE}/v1/payment-transaction/info/${encodeURIComponent(transactionId)}`, { headers });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) throw new Error(`${label} info ${res.status}`);
    const tx = firstTx(json) as (WappiTx & { Status?: string; E2E?: string; PaidAt?: string; paid_at?: string }) | null;
    const status = String(tx?.status ?? tx?.Status ?? "unknown").toUpperCase();
    const e2e = pixOf(tx)?.e2_e ?? tx?.E2E ?? null;
    return { paid: status === "PAID", status, e2e, paid_at: validDate(tx?.PaidAt ?? tx?.paid_at ?? null) };
  },
  };
}

const wappi = makeBasicPixProvider("wappi", WAPPI_BASE);
// Doc: https://www.freepaybrasil.com/docs — Basic Base64(PUBLIC_KEY:SECRET_KEY), valores em centavos.
export const FREEPAY_BASE = "https://api.freepaybrasil.com";
const freepay = makeBasicPixProvider("freepay", FREEPAY_BASE);

export type CardChargeInput = {
  orderNumber: string;
  amountCents: number;
  installments: number;
  card: { number: string; holder_name: string; expiration_month: number; expiration_year: number; cvv: string };
  customer: { name: string; email: string; document: string; phone?: string };
  items: Array<{ title: string; unit_price: number; quantity: number; tangible: boolean; external_ref?: string }>;
  shipping: Record<string, unknown>;
  postbackUrl?: string;
  ip?: string;
};
export type CardChargeResult = { ok: true; transaction_id: string; status: string } | { ok: false; error: string; status?: string | undefined; unavailable?: boolean };

/**
 * Cobrança de cartão na FreePay (POST /v1/payment-transaction/create, payment_method credit_card).
 * Os dados do cartão só passam por aqui em memória até a FreePay: nunca são gravados nem logados.
 */
export async function createFreepayCardCharge(config: GatewayConfig, input: CardChargeInput): Promise<CardChargeResult> {
  const headers = wappiHeaders(config);
  if (!headers) return { ok: false, error: "Gateway sem credenciais." };
  const doc = digits(input.customer.document);
  let phone = digits(input.customer.phone ?? "");
  if (phone && !phone.startsWith("55")) phone = `55${phone}`;
  const body = {
    amount: input.amountCents,
    payment_method: "credit_card",
    installments: input.installments,
    ...(input.postbackUrl ? { postback_url: input.postbackUrl } : {}),
    customer: {
      name: input.customer.name.trim().slice(0, 120) || "Cliente",
      email: input.customer.email.trim().slice(0, 160),
      document: { number: doc, type: doc.length > 11 ? "cnpj" : "cpf" },
      ...(phone ? { phone } : {}),
    },
    items: input.items,
    shipping: input.shipping,
    card: input.card,
    metadata: { order_number: input.orderNumber },
    ...(input.ip ? { ip: input.ip } : {}),
  };
  let res: Response;
  try {
    res = await fetch(`${FREEPAY_BASE}/v1/payment-transaction/create`, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(45000) });
  } catch {
    return { ok: false, error: "A FreePay não respondeu.", unavailable: true };
  }
  const json = (await res.json().catch(() => null)) as { data?: { id?: unknown; status?: unknown }; error_messages?: unknown } | null;
  const tx = json?.data;
  if ((res.status === 200 || res.status === 201) && tx?.id) {
    return { ok: true, transaction_id: String(tx.id), status: String(tx.status ?? "").toUpperCase() };
  }
  // Nunca registrar o corpo enviado (contém o cartão); só o status e a mensagem do gateway.
  console.error("[freepay] cartão falhou", res.status, JSON.stringify(json?.error_messages ?? null).slice(0, 300));
  if (res.status === 400) return { ok: false, error: "Alguns dados do pagamento não foram aceitos. Confira o cartão e o CPF.", status: tx?.status ? String(tx.status).toUpperCase() : undefined };
  // 5xx, 2xx sem transação ou corpo inválido = instabilidade (não é recusa).
  const unavailable = res.status >= 500 || res.status === 429 || res.status === 408 || !json || ((res.status === 200 || res.status === 201) && !tx?.id);
  return { ok: false, error: wappiError(res.status), ...(unavailable ? { unavailable: true } : {}) };
}

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

// ------------------------------------------------------------------ InvictusPay
// Doc: API Seller v1 — header X-Api-Key, valores em centavos, PIX via POST /transactions.

export const INVICTUS_BASE = "https://api.invictuspayv2.com.br/api/v1";

/** Status oficiais da InvictusPay → status interno (minúsculo). */
export const INVICTUS_STATUSES = ["pending", "processing", "antifraud", "paid", "failed", "refused", "expired", "cancelled", "refunded", "in_dispute", "pre_chargeback", "chargeback"] as const;
export function mapInvictusStatus(raw: unknown): string {
  const s = String(raw ?? "").trim().toLowerCase();
  return (INVICTUS_STATUSES as readonly string[]).includes(s) ? s : "unknown";
}

function invictusError(status: number, retryAfter?: string | null): string {
  if (status === 401 || status === 403) return "Não foi possível autenticar. Verifique a API Key da InvictusPay.";
  if (status === 400 || status === 422) return "Alguns dados do pedido não foram aceitos. Confira nome, e-mail, telefone e CPF.";
  if (status === 429) return `Muitas tentativas seguidas. Aguarde ${retryAfter && /^\d+$/.test(retryAfter) ? `${retryAfter} segundos` : "um minuto"}.`;
  return "O provedor de pagamento não respondeu. Tente novamente.";
}

/** A doc não descreve os campos do PIX na resposta: localiza o código EMV (000201…) e imagem pelo conteúdo. */
function findPixInBody(body: unknown): { payload: string | null; image: string | null; keys: string[] } {
  let payload: string | null = null;
  let image: string | null = null;
  const keys: string[] = [];
  const walk = (v: unknown, path: string, depth: number) => {
    if (depth > 5 || v == null) return;
    if (typeof v === "string") {
      if (!payload && isPixPayload(v)) { payload = v.trim(); keys.push(path); }
      else if (!image && /^data:image\//.test(v)) { image = v; keys.push(path); }
      return;
    }
    if (typeof v === "object") for (const [k, val] of Object.entries(v as Record<string, unknown>)) walk(val, path ? `${path}.${k}` : k, depth + 1);
  };
  walk(body, "", 0);
  return { payload, image, keys };
}

function invictusTx(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  for (const k of ["transaction", "data"]) {
    const v = b[k];
    if (v && typeof v === "object" && !Array.isArray(v) && "id" in (v as object)) return v as Record<string, unknown>;
  }
  return "id" in b ? b : null;
}

const invictuspay: PaymentProvider = {
  id: "invictuspay",
  async testConnection(config) {
    const key = config.secrets["api_key"] ?? "";
    if (!key) return { ok: false, error: "Informe a API Key." };
    const res = await fetch(`${INVICTUS_BASE}/account`, { headers: { "X-Api-Key": key, accept: "application/json" }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { ok: false, error: invictusError(res.status, res.headers.get("retry-after")) };
    const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const acc = ((j?.["data"] && typeof j["data"] === "object" ? j["data"] : j) ?? {}) as Record<string, unknown>;
    const str = (...ks: string[]) => { for (const k of ks) if (typeof acc[k] === "string" && acc[k]) return acc[k] as string; return undefined; };
    return { ok: true, company: { fantasy_name: str("fantasy_name", "trade_name", "name"), status: str("status") } };
  },
  async createPix(config, input) {
    const key = config.secrets["api_key"] ?? "";
    if (!key) return { ok: false, error: "Gateway sem credenciais." };
    const amount = input.amountCents ?? Math.round(input.amount * 100);
    if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: "Valor do pedido inválido." };
    const phone = digits(input.customer.phone ?? "");
    const doc = digits(input.customer.document);
    if (!input.customer.email || !phone || !doc) return { ok: false, error: "Preencha e-mail, telefone e CPF para gerar o PIX." };
    // Itens: soma exata = amount, e amount de cada item divisível pela quantidade.
    let items = (input.items ?? []).map((i) => ({ description: i.title.slice(0, 140), quantity: i.quantity, amount: i.unit_price * i.quantity, ...(i.external_ref ? { externalRef: i.external_ref } : {}) }));
    const fee = input.shipping?.fee ?? 0;
    if (fee > 0) items.push({ description: "Frete", quantity: 1, amount: fee });
    const sum = items.reduce((t, i) => t + i.amount, 0);
    if (!items.length || sum !== amount || items.some((i) => i.amount % i.quantity !== 0)) {
      items = [{ description: input.description.slice(0, 140), quantity: 1, amount, externalRef: input.orderNumber }];
    }
    const body = {
      amount,
      paymentMethod: "pix",
      customer: { name: input.customer.name.trim().slice(0, 120) || "Cliente", email: input.customer.email.trim().slice(0, 160), document: doc, phone },
      items,
      ...(input.postbackUrl ? { postbackUrl: input.postbackUrl } : {}),
      pix: { expirationInSeconds: 900 },
    };
    const res = await fetch(`${INVICTUS_BASE}/transactions`, {
      method: "POST",
      headers: { "X-Api-Key": key, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const json = (await res.json().catch(() => null)) as unknown;
    const tx = invictusTx(json);
    if (!res.ok || !tx?.["id"]) {
      const msg = json && typeof json === "object" ? String((json as Record<string, unknown>)["message"] ?? "") : "";
      console.error("[invictuspay] create falhou", res.status, msg.slice(0, 200));
      return { ok: false, error: invictusError(res.status, res.headers.get("retry-after")) };
    }
    const found = findPixInBody(json);
    // Registro só dos nomes dos campos (nunca valores) para conferir a resposta real.
    console.info("[invictuspay] resposta PIX", { top: Object.keys(tx).slice(0, 30), pix_fields: found.keys });
    let qr = found.image;
    if (!qr && found.payload) qr = await qrFromPayload(found.payload);
    if (!found.payload && !qr) return { ok: false, error: "O provedor não retornou os dados do PIX. Tente novamente." };
    return {
      ok: true,
      transaction_id: String(tx["id"]),
      qr_code: qr,
      copy_paste: found.payload,
      expires_in: 900,
      provider_status: mapInvictusStatus(tx["status"] ?? "pending"),
      amount_cents: typeof tx["amount"] === "number" ? (tx["amount"] as number) : null,
    };
  },
  async getStatus(config, transactionId) {
    const key = config.secrets["api_key"] ?? "";
    if (!key) return { paid: false, status: "unknown" };
    const res = await fetch(`${INVICTUS_BASE}/transactions/${encodeURIComponent(transactionId)}`, {
      headers: { "X-Api-Key": key, accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`invictuspay status ${res.status}`);
    const tx = invictusTx(await res.json().catch(() => null));
    const status = mapInvictusStatus(tx?.["status"]);
    const paidAt = typeof tx?.["paid_at"] === "string" ? (tx["paid_at"] as string) : null;
    return { paid: status === "paid", status, paid_at: paidAt };
  },
};

// ----------------------------------------------------------------------- CodeFy
// Doc: usecodefy.com/docs (Gateway PIX) — headers x-public-key + x-secret-key, valores em REAIS.

export const CODEFY_BASE = "https://usecodefy.com/api/v1/gateway";

/** Status oficiais do Gateway CodeFy: pending, paid, expired, refunded. */
export function mapCodefyStatus(raw: unknown): string {
  const s = String(raw ?? "").trim().toLowerCase();
  return s === "pending" || s === "paid" || s === "expired" || s === "refunded" ? s : "unknown";
}

function codefyHeaders(config: GatewayConfig): Record<string, string> | null {
  const pk = config.publicData["public_key"] ?? "";
  const sk = config.secrets["secret_key"] ?? "";
  if (!pk || !sk) return null;
  return { "x-public-key": pk, "x-secret-key": sk, "Content-Type": "application/json" };
}

function codefyError(status: number): string {
  if (status === 401 || status === 403) return "Não foi possível autenticar. Verifique as chaves da CodeFy.";
  if (status === 400 || status === 422) return "Alguns dados do pedido não foram aceitos. Confira nome, CPF, telefone e endereço.";
  if (status === 429) return "Muitas tentativas seguidas. Aguarde um minuto.";
  return "O provedor de pagamento não respondeu. Tente novamente.";
}

type CodefyTx = { id?: string; external_id?: string; status?: string; amount?: number | string; pix_code?: string; qr_code_url?: string | null; expires_at?: string; pix_expiration?: string; paid_at?: string | null };
const codefyTx = (j: unknown): CodefyTx | null => {
  const o = j as { transaction?: CodefyTx; data?: CodefyTx } | null;
  return o?.transaction ?? o?.data ?? ((o as CodefyTx | null)?.id ? (o as CodefyTx) : null);
};

const codefy: PaymentProvider = {
  id: "codefy",
  async testConnection(config) {
    const h = codefyHeaders(config);
    if (!h) return { ok: false, error: "Informe a Public Key e a Secret Key." };
    const res = await fetch(`${CODEFY_BASE}/seller/balance`, { headers: h, signal: AbortSignal.timeout(10000) });
    return res.ok ? { ok: true, company: {} } : { ok: false, error: codefyError(res.status) };
  },
  async createPix(config, input) {
    const h = codefyHeaders(config);
    if (!h) return { ok: false, error: "Gateway sem credenciais." };
    const cents = input.amountCents ?? Math.round(input.amount * 100);
    if (!Number.isInteger(cents) || cents <= 0) return { ok: false, error: "Valor do pedido inválido." };
    const a = input.shipping?.address;
    const zip = digits(a?.zip_code ?? "");
    const address = a && zip.length === 8 && /^[A-Z]{2}$/.test(a.state)
      ? { street: a.street, number: a.street_number, complement: a.complement, neighborhood: a.neighborhood, city: a.city, state: a.state, zip }
      : undefined;
    const phone = digits(input.customer.phone ?? "");
    const tracking: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "sck"]) {
      const v = input.metadata?.[k];
      if (v) tracking[k] = v.slice(0, 200);
    }
    const body = {
      amount: cents / 100,
      description: input.description.slice(0, 140),
      ...(input.checkoutUrl ? { origin_url: input.checkoutUrl } : {}),
      external_id: input.orderNumber,
      ...(input.postbackUrl ? { callbackUrl: input.postbackUrl } : {}),
      customer: {
        name: input.customer.name.trim().slice(0, 120) || "Cliente",
        cpf: digits(input.customer.document),
        email: input.customer.email.trim().slice(0, 160),
        ...(phone.length >= 10 ? { phone } : {}),
        ...(address ? { address } : {}),
      },
      ...(Object.keys(tracking).length ? { trackingParameters: tracking } : {}),
    };
    const res = await fetch(`${CODEFY_BASE}/pix/receive`, { method: "POST", headers: h, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
    const json = (await res.json().catch(() => null)) as unknown;
    const tx = codefyTx(json);
    if (!res.ok || !tx?.id) {
      console.error("[codefy] create falhou", res.status);
      return { ok: false, error: codefyError(res.status) };
    }
    const copyPaste = isPixPayload(tx.pix_code) ? tx.pix_code.trim() : null;
    const qr = copyPaste ? await qrFromPayload(copyPaste) : null;
    if (!copyPaste) return { ok: false, error: "O provedor não retornou os dados do PIX. Tente novamente." };
    const exp = tx.expires_at ?? tx.pix_expiration ?? null;
    const expMs = exp ? Date.parse(exp) - Date.now() : NaN;
    return {
      ok: true,
      transaction_id: String(tx.id),
      qr_code: qr,
      copy_paste: copyPaste,
      expires_in: Number.isFinite(expMs) && expMs > 0 ? Math.floor(expMs / 1000) : 900,
      provider_status: mapCodefyStatus(tx.status ?? "pending"),
      expiration_date: exp,
      amount_cents: tx.amount != null && Number.isFinite(Number(tx.amount)) ? Math.round(Number(tx.amount) * 100) : null,
    };
  },
  async getStatus(config, transactionId) {
    const h = codefyHeaders(config);
    if (!h) return { paid: false, status: "unknown" };
    const res = await fetch(`${CODEFY_BASE}/transactions/${encodeURIComponent(transactionId)}`, { headers: h, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`codefy status ${res.status}`);
    const tx = codefyTx(await res.json().catch(() => null));
    const status = mapCodefyStatus(tx?.status);
    return { paid: status === "paid", status, paid_at: tx?.paid_at ?? null };
  },
};

/** Valida X-CodeFy-Signature (sha256=<hmac hex do corpo bruto>). */
export async function verifyCodefySignature(raw: string, header: string | null, secret: string): Promise<boolean> {
  if (!header || !secret) return false;
  const given = header.replace(/^sha256=/i, "").trim().toLowerCase();
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== given.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

const REGISTRY: Record<string, PaymentProvider> = { wappi, freepay, pinpay, blackcat, invictuspay, codefy, mercadopago, asaas };

export function getProvider(id: string): PaymentProvider | null {
  return REGISTRY[id] ?? null;
}
