/**
 * Formas de pagamento por loja (store_settings.checkout.payment_methods).
 * Arquivo seguro para navegador e servidor: só configuração e cálculos, nunca dados de cartão.
 */

export type CardProviderId = "none" | "blackcat" | "freepay" | "pinpay";

export const CARD_PROVIDERS: Array<{ id: CardProviderId; name: string; ready: boolean }> = [
  { id: "none", name: "Nenhum", ready: false },
  { id: "blackcat", name: "Blackcat", ready: false },
  { id: "freepay", name: "FreePay", ready: false },
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
  };
};

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
    },
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
