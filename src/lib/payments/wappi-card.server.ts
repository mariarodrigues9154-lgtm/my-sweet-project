/**
 * Cobrança de cartão na Wappi Brasil — SOMENTE servidor.
 * Doc: https://app.wappibrasil.com.br/docs/cartao-3ds
 *
 * O número e o CVV do cartão NUNCA passam por aqui: o SDK da Wappi (HiSo) tokeniza
 * no navegador e este módulo recebe apenas o token (`card.hash`). A autenticação 3DS
 * é conduzida pelo SDK no navegador; a confirmação final vem do webhook ou da
 * reconsulta em GET /v1/payment-transaction/info/{id}.
 */
import { firstTx, wappiError, wappiErrorDetail, wappiHeaders, WAPPI_BASE, type WappiTx } from "./providers.server";
import type { GatewayConfig } from "./providers.server";

export type WappiCardChargeInput = {
  orderNumber: string;
  amountCents: number;
  installments: number;
  /** Token gerado pelo encrypt() do SDK da Wappi no navegador. */
  cardHash: string;
  customer: { name: string; email: string; document: string; phone?: string };
  items: Array<{ title: string; unit_price: number; quantity: number; tangible: boolean; external_ref?: string }>;
  shipping: Record<string, unknown>;
  postbackUrl?: string;
  ip?: string;
};

export type WappiCardChargeResult =
  | { ok: true; transaction_id: string; status: string; transaction: WappiTx }
  | { ok: false; error: string; status?: string | undefined; unavailable?: boolean };

const digits = (value: string) => value.replace(/\D/g, "");

/**
 * Cria a transação de cartão com o token do SDK. Nunca registra o corpo enviado
 * nem o token em logs.
 */
export async function createWappiCardCharge(config: GatewayConfig, input: WappiCardChargeInput): Promise<WappiCardChargeResult> {
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
      ...(phone ? { phone: `+${phone}` } : {}),
    },
    items: input.items,
    shipping: input.shipping,
    card: { hash: input.cardHash },
    metadata: { order_number: input.orderNumber },
    ...(input.ip ? { ip: input.ip } : {}),
  };
  let res: Response;
  try {
    res = await fetch(`${WAPPI_BASE}/v1/payment-transaction/create`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    return { ok: false, error: "A Wappi não respondeu.", unavailable: true };
  }
  const json = (await res.json().catch(() => null)) as unknown;
  const tx = firstTx(json);
  if ((res.status === 200 || res.status === 201) && tx?.id) {
    return { ok: true, transaction_id: String(tx.id), status: String(tx.status ?? "").toUpperCase(), transaction: tx };
  }
  // Nunca registrar o corpo enviado (contém o token); só status e mensagem do gateway.
  const detail = wappiErrorDetail(json);
  console.error("[wappi] cartão falhou", res.status, (detail ?? "sem detalhe").slice(0, 300));
  if (res.status === 400 || res.status === 422) {
    return { ok: false, error: wappiError(res.status, detail), status: tx?.status ? String(tx.status).toUpperCase() : undefined };
  }
  // 5xx, 429, 408, 2xx sem transação ou corpo inválido = instabilidade (não é recusa).
  const unavailable = res.status >= 500 || res.status === 429 || res.status === 408 || !json || ((res.status === 200 || res.status === 201) && !tx?.id);
  return { ok: false, error: wappiError(res.status, detail), ...(unavailable ? { unavailable: true } : {}) };
}
