/**
 * Formas de pagamento por loja (store_settings.checkout.payment_methods).
 * Arquivo seguro para navegador e servidor: só configuração e cálculos, nunca dados de cartão.
 */

export type CardProviderId = "none" | "blackcat" | "freepay" | "pinpay";

export const CARD_PROVIDERS: Array<{ id: CardProviderId; name: string; ready: boolean }> = [
  { id: "none", name: "Nenhum", ready: false },
  { id: "blackcat", name: "Blackcat", ready: false },
  { id: "freepay", name: "FreePay", ready: true },
  { id: "pinpay", name: "PinPay", ready: false },
];

export type PaymentMethodsConfig = {
  pix: {
    enabled: boolean;
    text: string;
    discount_enabled: boolean;
    discount_type: "percent" | "fixed";
    discount_value: number;
    discount_text: string;
    /** Ícone personalizado do PIX (vazio = ícone padrão). */
    icon_url: string;
  };
  card: {
    enabled: boolean;
    provider: CardProviderId;
    title: string;
    text: string;
    highlight: string;
    max_installments: number;
    free_installments: number;
    /** Juros total (%) por número de parcelas, índice 0 = 1x. */
    rates: number[];
    promo_enabled: boolean;
    promo_text: string;
    show_brands: boolean;
    /** Bandeiras enviadas pelo painel, na ordem de exibição. Vazio = bandeiras padrão. */
    brands: CardBrandImage[];
  };
  decline: CardDeclineTexts;
  provider_error: CardProviderErrorTexts;
};

export type CardBrandImage = { id: string; name: string; url: string; enabled: boolean };

function resolveBrands(v: unknown): CardBrandImage[] {
  if (!Array.isArray(v)) return [];
  return v
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((b: any) => b && typeof b === "object" && typeof b.url === "string" && b.url.trim())
    .slice(0, 12)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((b: any, i: number) => ({ id: typeof b.id === "string" && b.id ? b.id.slice(0, 40) : `b${i}`, name: typeof b.name === "string" ? b.name.slice(0, 40) : "", url: b.url.slice(0, 600), enabled: b.enabled !== false }));
}

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v.replace(",", "."))) ? Number(v.replace(",", ".")) : d);
const str = (v: unknown, d: string, max = 120) => (typeof v === "string" ? v.slice(0, max) : d);
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

export function resolvePaymentMethods(raw: unknown): PaymentMethodsConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r: any = raw && typeof raw === "object" ? raw : {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p: any = r.pix ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = r.card ?? {};
  const max = Math.round(clamp(num(c.max_installments, 12), 1, 12));
  const free = Math.round(clamp(num(c.free_installments, max), 1, max));
  const rawRates = Array.isArray(c.rates) ? c.rates : [];
  const rates = Array.from({ length: 12 }, (_, i) => (i < free ? 0 : clamp(num(rawRates[i], 0), 0, 100)));
  const provider = CARD_PROVIDERS.some((x) => x.id === c.provider) ? (c.provider as CardProviderId) : "none";
  return {
    pix: {
      enabled: p.enabled !== false,
      text: str(p.text, "Pagamento instantâneo · Aprovação em segundos"),
      discount_enabled: p.discount_enabled === true,
      discount_type: p.discount_type === "fixed" ? "fixed" : "percent",
      discount_value: clamp(num(p.discount_value, 0), 0, p.discount_type === "fixed" ? 100000 : 90),
      discount_text: str(p.discount_text, ""),
      icon_url: str(p.icon_url, "", 600),
    },
    card: {
      enabled: c.enabled !== false,
      provider,
      title: str(c.title, "Cartão de crédito"),
      text: str(c.text, `Pague em até ${max} parcelas`),
      highlight: str(c.highlight, `Sem juros em até ${free} parcelas`),
      max_installments: max,
      free_installments: free,
      rates,
      promo_enabled: c.promo_enabled === true,
      promo_text: str(c.promo_text, ""),
      show_brands: c.show_brands !== false,
      brands: resolveBrands(c.brands),
    },
    decline: resolveDecline(r.decline),
    provider_error: resolveProviderError(r.provider_error),
  };
}

/** Gateway de cartão realmente pronto para cobrar. Nenhum está liberado ainda. */
export function cardProviderReady(cfg: PaymentMethodsConfig): boolean {
  return CARD_PROVIDERS.find((p) => p.id === cfg.card.provider)?.ready === true;
}

/** Visibilidade independente do gateway; cobrança continua exigindo provider pronto. */
export function cardAvailable(cfg: PaymentMethodsConfig): boolean {
  return cfg.card.enabled;
}

export function pixDiscountCents(totalCents: number, cfg: PaymentMethodsConfig): number {
  if (!cfg.pix.enabled || !cfg.pix.discount_enabled || cfg.pix.discount_value <= 0) return 0;
  const d = cfg.pix.discount_type === "percent" ? Math.round((totalCents * cfg.pix.discount_value) / 100) : Math.round(cfg.pix.discount_value * 100);
  return clamp(d, 0, Math.max(0, totalCents - 100));
}

export type Installment = { n: number; rate: number; installmentCents: number; totalCents: number; free: boolean };

export function installmentPlan(totalCents: number, cfg: PaymentMethodsConfig): Installment[] {
  return Array.from({ length: cfg.card.max_installments }, (_, i) => {
    const n = i + 1;
    const rate = cfg.card.rates[i] ?? 0;
    const finalCents = Math.round(totalCents * (1 + rate / 100));
    return { n, rate, installmentCents: Math.ceil(finalCents / n), totalCents: finalCents, free: rate === 0 };
  });
}

/* ---------- Cartão recusado (somente com retorno real do gateway) ---------- */

export type CardDeclineTexts = { title: string; message: string; retry_label: string; pix_label: string; pix_benefit: string };

export const DEFAULT_DECLINE: CardDeclineTexts = {
  title: "Não foi possível concluir o pagamento",
  message: "{nome}, seu cartão não foi aprovado nesta tentativa. Você pode tentar novamente ou finalizar seu pedido via PIX.",
  retry_label: "Tentar outro cartão",
  pix_label: "Finalizar pagamento no PIX",
  pix_benefit: "Finalize via PIX e economize {desconto}",
};

export function resolveDecline(raw: unknown): CardDeclineTexts {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r: any = raw && typeof raw === "object" ? raw : {};
  const s = (k: keyof CardDeclineTexts, max = 120) => (typeof r[k] === "string" && r[k].trim() ? String(r[k]).slice(0, max) : DEFAULT_DECLINE[k]);
  return { title: s("title"), message: s("message", 300), retry_label: s("retry_label", 40), pix_label: s("pix_label", 40), pix_benefit: s("pix_benefit") };
}

/** Troca {nome} pelo primeiro nome do checkout; sem nome, remove o vocativo. */
export function fillDeclineMessage(text: string, fullName: string): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0] ?? "";
  if (first) return text.replace(/\{nome\}/g, first.charAt(0).toUpperCase() + first.slice(1).toLowerCase());
  const out = text.replace(/\{nome\},?\s*/g, "");
  return out.charAt(0).toUpperCase() + out.slice(1);
}

export function pixDiscountLabel(cfg: PaymentMethodsConfig): string | null {
  const p = cfg.pix;
  if (!p.enabled || !p.discount_enabled || p.discount_value <= 0) return null;
  return p.discount_type === "percent" ? `${p.discount_value.toLocaleString("pt-BR")}%` : `R$ ${p.discount_value.toFixed(2).replace(".", ",")}`;
}

export type CardResult = "paid" | "pending" | "refused" | "unknown";

/**
 * Status oficiais de cartão por gateway, preenchidos SOMENTE a partir da documentação de cada
 * provider quando o cartão dele for integrado. Status fora da tabela viram "unknown" (nunca recusa).
 */
export const CARD_STATUS_MAP: Record<CardProviderId, { paid: string[]; pending: string[]; refused: string[] }> = {
  none: { paid: [], pending: [], refused: [] },
  blackcat: { paid: [], pending: [], refused: [] },
  // Status oficiais da FreePay (docs: criar/buscar transação).
  freepay: { paid: ["paid"], pending: ["pending"], refused: ["refused", "failed", "error"] },
  pinpay: { paid: [], pending: [], refused: [] },
};

export function normalizeCardStatus(provider: CardProviderId, status: string | null | undefined): CardResult {
  const s = String(status ?? "").trim().toLowerCase();
  const m = CARD_STATUS_MAP[provider];
  if (!m || !s) return "unknown";
  if (m.paid.includes(s)) return "paid";
  if (m.pending.includes(s)) return "pending";
  if (m.refused.includes(s)) return "refused";
  return "unknown";
}

/* ---------- Falha técnica do provedor de cartão (timeout, rede, 5xx, resposta inválida) ---------- */

export type CardProviderErrorTexts = { title: string; message: string; retry_label: string; pix_label: string };

export const DEFAULT_PROVIDER_ERROR: CardProviderErrorTexts = {
  title: "Não foi possível concluir sua transação",
  message: "Tivemos uma instabilidade ao processar o pagamento com cartão. Você pode tentar novamente ou finalizar sua compra via PIX.",
  retry_label: "Tentar novamente",
  pix_label: "Finalizar pagamento no PIX",
};

export function resolveProviderError(raw: unknown): CardProviderErrorTexts {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r: any = raw && typeof raw === "object" ? raw : {};
  const s = (k: keyof CardProviderErrorTexts, max = 120) => (typeof r[k] === "string" && r[k].trim() ? String(r[k]).slice(0, max) : DEFAULT_PROVIDER_ERROR[k]);
  return { title: s("title"), message: s("message", 300), retry_label: s("retry_label", 40), pix_label: s("pix_label", 40) };
}
