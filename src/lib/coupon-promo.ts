/** Chip de cupom (perto do preço) e barra de cupom (acima do menu inferior): config por loja em checkout.coupon_promo.
 *  Só os ícones são fixos; textos aceitam {percent} e {max}. Desligar apenas esconde (os dados ficam salvos). */
export type CouponPromoSettings = {
  chip_enabled?: boolean;
  bar_enabled?: boolean;
  chip_text?: string;
  bar_text?: string;
  percent?: number;
  max_value?: number;
  show_timer?: boolean;
  show_close?: boolean;
  show_arrow?: boolean;
  bg_color?: string;
  text_color?: string;
  accent_color?: string;
  border_color?: string;
  /** Duração própria do cronômetro deste produto. */
  countdown_hours?: number;
  countdown_minutes?: number;
};

export const COUPON_DEFAULTS = {
  chip_enabled: false,
  bar_enabled: false,
  chip_text: "Desconto de {percent}%, máximo de {max}",
  bar_text: "O cupom de {percent}% de desconto está expirando",
  percent: 60,
  max_value: 20,
  show_timer: true,
  show_close: true,
  show_arrow: true,
  bg_color: "",
  text_color: "",
  accent_color: "",
  border_color: "",
  countdown_hours: 18,
  countdown_minutes: 9,
} satisfies Required<CouponPromoSettings>;

export type ResolvedCouponPromo = Required<CouponPromoSettings>;

const color = (v: unknown) => (typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v.trim()) ? v.trim() : "");
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const num = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  return v === undefined || v === null || v === "" || !Number.isFinite(n) ? undefined : Math.min(max, Math.max(min, n));
};

/** Limpa o que vem do painel (mantém tudo salvo, mesmo desligado). */
export function sanitizeCouponPromo(raw: unknown): CouponPromoSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: CouponPromoSettings = {};
  for (const k of ["chip_enabled", "bar_enabled", "show_timer", "show_close", "show_arrow"] as const) if (typeof r[k] === "boolean") out[k] = r[k] as boolean;
  const ct = text(r['chip_text'], 120); if (ct !== undefined) out.chip_text = ct;
  const bt = text(r['bar_text'], 160); if (bt !== undefined) out.bar_text = bt;
  const p = num(r['percent'], 0, 100); if (p !== undefined) out.percent = p;
  const m = num(r['max_value'], 0, 100000); if (m !== undefined) out.max_value = m;
  const ch = num(r['countdown_hours'], 0, 99); if (ch !== undefined) out.countdown_hours = Math.floor(ch);
  const cm = num(r['countdown_minutes'], 0, 59); if (cm !== undefined) out.countdown_minutes = Math.floor(cm);
  for (const k of ["bg_color", "text_color", "accent_color", "border_color"] as const) if (r[k] !== undefined) out[k] = color(r[k]);
  return out;
}

/** Lê a configuração do produto (products.sections.coupon_promo). Sem configuração: chip e barra desligados. */
export function resolveCouponPromo(sections: unknown): ResolvedCouponPromo {
  const raw = (sections && typeof sections === "object" ? (sections as { coupon_promo?: unknown }).coupon_promo : null) ?? {};
  const s = sanitizeCouponPromo(raw);
  return {
    ...COUPON_DEFAULTS,
    ...s,
    chip_text: s.chip_text || COUPON_DEFAULTS.chip_text,
    bar_text: s.bar_text || COUPON_DEFAULTS.bar_text,
  };
}

const money = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: Number.isInteger(v) ? 0 : 2 }).format(v);

/** Troca {percent} e {max} pelos valores configurados. */
export function fillCouponText(template: string, cfg: Pick<ResolvedCouponPromo, "percent" | "max_value">): string {
  return template.replaceAll("{percent}", String(cfg.percent)).replaceAll("{max}", money(cfg.max_value));
}
