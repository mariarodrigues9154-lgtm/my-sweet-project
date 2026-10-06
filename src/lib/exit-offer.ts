/** Oferta de saída do checkout: config por loja (checkout.exit_offer) com override por produto (sections). */
export type ExitOfferSettings = {
  enabled?: boolean;
  style?: "default" | "aggressive";
  badge?: string;
  title?: string;
  text?: string;
  timer_enabled?: boolean;
  timer_minutes?: number;
  timer_text?: string;
  discount_type?: "percent" | "fixed";
  discount_value?: number;
  button_text?: string;
  decline_text?: string;
};

export type ExitOfferProductSections = {
  exit_offer_mode?: "store" | "on" | "off";
  exit_offer?: ExitOfferSettings;
};

export type ResolvedExitOffer = Required<Omit<ExitOfferSettings, "enabled">>;

const clean = (s?: string) => (typeof s === "string" ? s.trim() : "");

/** Retorna a oferta efetiva ou null quando não deve aparecer. */
export function resolveExitOffer(storeRaw: unknown, sections?: ExitOfferProductSections | null): ResolvedExitOffer | null {
  const store = (storeRaw && typeof storeRaw === "object" ? storeRaw : {}) as ExitOfferSettings;
  const mode = sections?.exit_offer_mode ?? "store";
  if (mode === "off") return null;
  if (mode === "store" && store.enabled !== true) return null;
  const own = mode === "on" ? sections?.exit_offer ?? {} : {};
  const pick = <K extends keyof ExitOfferSettings>(k: K) => (own[k] !== undefined && own[k] !== "" && own[k] !== null ? own[k] : store[k]);
  const type = pick("discount_type") === "fixed" ? "fixed" : "percent";
  const value = Math.max(0, Number(pick("discount_value") ?? 0) || 0);
  if (value <= 0 || (type === "percent" && value >= 100)) return null;
  return {
    style: pick("style") === "default" ? "default" : "aggressive",
    badge: clean(pick("badge") as string) || "OFERTA EXCLUSIVA DE HOJE",
    title: clean(pick("title") as string) || "ESPERE! NÃO DEIXE ESSA OFERTA ESCAPAR!",
    text: clean(pick("text") as string) || "Identificamos que você não concluiu seu pedido. Para facilitar sua compra, liberamos um desconto especial aplicado diretamente ao seu pedido!",
    timer_enabled: pick("timer_enabled") !== false,
    timer_minutes: Math.min(120, Math.max(1, Number(pick("timer_minutes") ?? 5) || 5)),
    timer_text: clean(pick("timer_text") as string) || "Esta oportunidade única expira em: {MM:SS}",
    discount_type: type,
    discount_value: value,
    button_text: clean(pick("button_text") as string) || "SIM, QUERO APROVEITAR O DESCONTO!",
    decline_text: clean(pick("decline_text") as string) || "Não, prefiro pagar o valor normal depois",
  };
}

/** Preço unitário com desconto, em centavos (percentual, ou valor fixo por unidade). Nunca abaixo de 1 centavo. */
export function discountedUnitCents(unitCents: number, offer: Pick<ResolvedExitOffer, "discount_type" | "discount_value">): number {
  const next = offer.discount_type === "percent"
    ? Math.round(unitCents * (1 - offer.discount_value / 100))
    : unitCents - Math.round(offer.discount_value * 100);
  return Math.max(1, Math.min(unitCents, next));
}

export function discountedUnit(unit: number, offer: Pick<ResolvedExitOffer, "discount_type" | "discount_value"> | null): number {
  if (!offer) return unit;
  return discountedUnitCents(Math.round(unit * 100), offer) / 100;
}
