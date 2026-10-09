/** Modelo de dados do produto — o layout nunca guarda conteúdo, só lê daqui. */

export type Media = {
  type: "image" | "video";
  url: string;
  poster?: string | null;
  alt?: string | null;
};

export type VariantOption = {
  label: string;
  value: string;
  /** Imagem própria da opção (ex.: a foto daquela cor). */
  image?: string | null;
};

export type VariantGroup = {
  name: string;
  label: string;
  /** Quando verdadeiro, as opções aparecem como cards com imagem. */
  use_image?: boolean;
  options: VariantOption[];
};

/** Combinação de variações (ex.: Preto + 40/41) com preço e estoque próprios. */
export type VariantCombo = {
  /** Chave da combinação: valores na ordem dos grupos, unidos por "|". */
  key: string;
  price?: number | null;
  previous_price?: number | null;
  stock?: number | null;
  sku?: string | null;
  /** Imagem própria da combinação (opcional). */
  image?: string | null;
  active?: boolean;
};


export type ShippingOption = {
  id: string;
  label: string;
  eta: string;
  price: number;
};

export type Shipping = {
  free?: boolean;
  fee?: number;
  min_days?: number;
  max_days?: number;
  options?: ShippingOption[];
};

export type Offer = {
  badge?: string;
  highlight?: string;
  flash_label?: string;
  countdown_seconds?: number;
};

export type Protection = {
  title?: string;
  subtitle?: string;
  items?: string[];
};

export type Spec = { label: string; value: string };

export type DescriptionBlock =
  | { type: "heading"; text: string }
  | { type: "subheading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "spacer"; size?: "sm" | "md" | "lg" }
  | { type: "list"; items: string[] }
  | { type: "image"; url: string; alt?: string; caption?: string }
  | { type: "video"; url: string; poster?: string };

export type CreatorVideo = {
  handle: string;
  thumb: string;
  video?: string | null;
  name?: string;
  title?: string;
  description?: string;
  rating?: number | null;
  show_name?: boolean;
  show_handle?: boolean;
  show_title?: boolean;
  show_stars?: boolean;
  avatar?: string | null;
  show_avatar?: boolean;
  verified?: boolean;
  show_rating_number?: boolean;
  show_description?: boolean;
};

export type ProductSections = {
  videos_subtitle?: string;
  videos_title?: string;
  videos_count?: string;
  videos_show_count?: boolean;
  videos_show_more?: boolean;
  videos_more_text?: string;
  videos_show_icon?: boolean;
  videos_show_hint?: boolean;
  videos_hint_text?: string;
  videos_card_style?: "overlay" | "below";
  about_title?: string;
  /** Avaliações exibidas de início e a cada "Ver mais" (1 a 20, padrão 20). */
  reviews_page_size?: number | undefined;
  description_title?: string;
  /** Perguntas sobre o produto (IA). Padrão: ativado. */
  qa_enabled?: boolean;
  qa_title?: string;
  qa_subtitle?: string;
  qa_placeholder?: string;
  /** Informações extras verdadeiras que a IA pode usar sobre este produto. */
  qa_ai_info?: string;
  /** Popup de notificações neste produto: segue a loja, força ligado ou desligado. */
  popup_mode?: "store" | "on" | "off";
  /** Oferta de saída do checkout neste produto. */
  exit_offer_mode?: "store" | "on" | "off";
  exit_offer?: import("./exit-offer").ExitOfferSettings;
  product_exit_offer_mode?: "store" | "on" | "off";
  product_exit_offer?: import("./exit-offer").ExitOfferSettings;
};

/** Atendimento por IA e suporte humano — por loja, lido só no servidor. */
export type StoreAiSupport = {
  /** Liga/desliga a função inteira; ausente = ligado (lojas antigas). */
  enabled?: boolean;
  ships_brazil?: boolean;
  warranty_text?: string;
  store_info?: string;
  extra_info?: string;
  support_phone?: string;
  whatsapp_enabled?: boolean;
  phone_enabled?: boolean;
  forward_enabled?: boolean;
  whatsapp_message?: string;
};

/** Textos e métricas exibidas — configuráveis no painel, sem mexer nos dados reais. */
export type MetricSource = "auto" | "manual";

export type ProductDisplay = {
  rating_source?: MetricSource;
  rating?: number | null;
  reviews_source?: MetricSource;
  reviews_count?: number | null;
  reviews_label?: string | null;
  sold_source?: MetricSource;
  sold_count?: number | null;
  sold_label?: string | null;
  badge1_show?: boolean;
  badge1_text?: string | null;
  badge2_show?: boolean;
  badge2_text?: string | null;
  /** Seção "Avaliações dos clientes" — só exibição, nunca altera as avaliações. */
  rs_title?: string | null;
  rs_source?: MetricSource;
  rs_count_source?: MetricSource;
  rs_rating_source?: MetricSource;
  rs_count?: number | null;
  rs_rating?: number | null;
  rs_max?: string | null;
};

/** Cabeçalho da seção de avaliações: título, quantidade, nota e máximo. */
export function reviewsSectionHeader(product: Product): { title: string; count: number; rating: number; max: string } {
  const d = product.display ?? {};
  const visible = (product.reviews ?? []).filter((r) => !r.hidden);
  const countManual = (d.rs_count_source ?? d.rs_source) === "manual";
  const ratingManual = (d.rs_rating_source ?? d.rs_source) === "manual";
  const real = visible.filter((r) => Number.isFinite(Number(r.rating)));
  const avg = real.length ? real.reduce((a, r) => a + Number(r.rating), 0) / real.length : 0;
  const count = countManual && d.rs_count != null ? Math.max(0, Math.round(Number(d.rs_count))) : visible.length || product.reviews_count || 0;
  const rating = ratingManual && d.rs_rating != null ? Math.min(5, Math.max(0, Number(d.rs_rating))) : real.length ? Math.round(avg * 10) / 10 : Number(product.rating) || 0;
  return {
    title: d.rs_title?.trim() || "Avaliações dos clientes",
    count,
    rating,
    max: d.rs_max?.trim() || "5",
  };
}


/** Avaliações por carregamento do produto (1–20, padrão 20). */
export function reviewsPageSize(product: Pick<Product, "sections">): number {
  const n = Math.round(Number(product.sections?.reviews_page_size));
  return Number.isFinite(n) && n >= 1 ? Math.min(20, n) : 20;
}

export type Review = {
  name: string;
  rating: number;
  date: string;
  text: string;
  confirmed?: boolean;
  hidden?: boolean;
  photos?: string[];
  /** Vídeos opcionais da avaliação (padrão: nenhum). */
  videos?: string[];
  avatar?: string | null;
  /** Localização real (opcional) — só existe se veio junto com a avaliação/pedido. */
  city?: string;
  state?: string;
  order_city?: string;
  order_state?: string;
};

export type Product = {
  id: string;
  slug: string;
  active: boolean;
  name: string;
  title: string;
  subtitle: string | null;
  price: number;
  previous_price: number;
  stock: number;
  rating: number;
  reviews_count: number;
  sold_count: number;
  offer: Offer;
  media: Media[];
  variants: VariantGroup[];
  variant_combos: VariantCombo[];

  shipping: Shipping;
  warranty: string | null;
  protection: Protection;
  specs: Spec[];
  description: DescriptionBlock[];
  creator_videos: CreatorVideo[];
  reviews: Review[];
  terms: string | null;
  sort_order: number;
  sections: ProductSections;
  display: ProductDisplay;
};

export type CheckoutSettings = {
  /** Espelho público de ai_support.enabled (ausente = ligado). */
  ai_enabled?: boolean;
  checkout_model?: "v1" | "v2";
  logo_url?: string | null;
  primary_color?: string | null;
  title?: string | null;
  note?: string | null;
  verified_home?: boolean;
  verified_product?: boolean;
  verified_checkout?: boolean;
  verified_footer?: boolean;
  display_name?: string | null;
  show_name?: boolean;
  discount_title?: string | null;
  show_discount?: boolean;
  legal_text?: string | null;
  show_legal?: boolean;
  show_rating?: boolean;
  rating_from_product?: boolean;
  rating_text?: string | null;
  rating_value?: number | null;
  rating_max?: string | null;
  pix_recovery?: PixRecoverySettings;
  /** Bloco de termos da página do produto (por loja). */
  product_terms?: { enabled?: boolean; title?: string; text?: string };
  /** Popups / notificações flutuantes da loja. */
  popups?: PopupSettings;
  /** Oferta de saída do checkout (por loja). */
  exit_offer?: import("./exit-offer").ExitOfferSettings;
  product_exit_offer?: import("./exit-offer").ExitOfferSettings;
};


export type StoreSettings = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  footer_logo_url: string | null;
  tagline: string | null;
  support_email: string | null;
  whatsapp: string | null;
  visit_url: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  banner_url: string | null;
  banner_link: string | null;
  verified: boolean;
  sold_count: number;
  show_follow: boolean;
  show_message: boolean;
  show_visit?: boolean;
  visit_clickable?: boolean;
  favicon_url?: string | null;
  show_footer?: boolean;
  indicators: Array<{ value: string; label: string }>;
  featured_product_ids: string[];
  footer_text: string | null;
  policies: {
    privacy: string;
    refund: string;
    terms: string;
    shipping: string;
  };
  checkout: CheckoutSettings;
  /** Só presente no painel administrativo. */
  ai_support?: StoreAiSupport;
};

export type OrderSummary = {
  order_number: string;
  status: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  shipping_label: string | null;
  shipping_price: number;
  total: number;
  product_snapshot: { title?: string; image?: string; slug?: string };
  variant: Record<string, string>;
  customer: { name?: string; email?: string; phone?: string; document?: string };
  address: Record<string, string>;
  payment: { provider?: string; status?: string; qr_code?: string; copy_paste?: string };
  created_at: string;
};

/** Desconto e economia são sempre calculados, nunca gravados. */
export function discountPercent(price: number, previous: number): number {
  if (!previous || previous <= price) return 0;
  const p = Math.round(price * 100), o = Math.round(previous * 100);
  return Math.round(((o - p) / o) * 100);
}

export function savings(price: number, previous: number): number {
  return Math.max(0, Math.round(previous * 100) - Math.round(price * 100)) / 100;
}

/* ---------------------------------------------------------------------------
 * Variações: preço, estoque e disponibilidade por combinação.
 * O layout e o painel leem sempre daqui, nunca duplicam regra.
 * ------------------------------------------------------------------------- */

export const COMBO_SEP = "|";

/** Chave da combinação na ordem dos grupos. Retorna null se faltar alguma escolha. */
export function comboKeyFor(
  groups: VariantGroup[],
  selection: Record<string, string>,
): string | null {
  if (!groups.length) return null;
  const parts: string[] = [];
  for (const group of groups) {
    const value = selection[group.name];
    if (!value) return null;
    parts.push(value);
  }
  return parts.join(COMBO_SEP);
}

export function comboLabel(groups: VariantGroup[], key: string): string {
  const values = key.split(COMBO_SEP);
  return groups
    .map((group, index) => {
      const value = values[index] ?? "";
      const option = group.options.find((o) => o.value === value);
      return `${group.label}: ${option?.label ?? value}`;
    })
    .join(" · ");
}

export function findCombo(
  product: Pick<Product, "variants" | "variant_combos">,
  selection: Record<string, string>,
): VariantCombo | null {
  const key = comboKeyFor(product.variants ?? [], selection);
  if (!key) return null;
  return (product.variant_combos ?? []).find((c) => c.key === key) ?? null;
}

export function comboActive(combo: VariantCombo | null | undefined): boolean {
  return !combo || combo.active !== false;
}

/** Preço, preço antigo, estoque e código internos válidos para a escolha atual. */
export function variantPricing(
  product: Pick<Product, "price" | "previous_price" | "stock" | "variants" | "variant_combos">,
  selection: Record<string, string>,
): { price: number; previous_price: number; stock: number; sku: string | null; available: boolean } {
  const combo = findCombo(product as Product, selection);
  const price = combo?.price != null && combo.price > 0 ? Number(combo.price) : Number(product.price);
  const previous =
    combo?.previous_price != null && combo.previous_price > 0
      ? Number(combo.previous_price)
      : Number(product.previous_price);
  const stock = combo?.stock != null ? Number(combo.stock) : Number(product.stock ?? 0);
  return {
    price,
    previous_price: Math.max(previous, price),
    stock: Math.max(0, stock),
    sku: combo?.sku ?? null,
    available: comboActive(combo) && Math.max(0, stock) > 0,
  };
}

/** Menor e maior preço entre as combinações vendáveis — base do "A partir de". */
export function variantPriceRange(
  product: Pick<Product, "price" | "variant_combos">,
): { min: number; max: number; multiple: boolean } {
  const prices = (product.variant_combos ?? [])
    .filter((c) => c.active !== false && (c.stock == null || Number(c.stock) > 0))
    .map((c) => (c.price != null && c.price > 0 ? Number(c.price) : Number(product.price)));
  if (!prices.length) return { min: Number(product.price), max: Number(product.price), multiple: false };
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return { min, max, multiple: max > min };
}

/**
 * Uma opção é escolhível quando existe alguma combinação vendável que a use,
 * respeitando o que já foi escolhido nos outros grupos.
 */
export function optionSelectable(
  product: Pick<Product, "stock" | "variants" | "variant_combos">,
  selection: Record<string, string>,
  groupName: string,
  value: string,
): boolean {
  const groups = product.variants ?? [];
  const combos = product.variant_combos ?? [];
  if (!combos.length) return Number(product.stock ?? 0) > 0;
  return combos.some((combo) => {
    if (combo.active === false) return false;
    if (combo.stock != null && Number(combo.stock) <= 0) return false;
    const values = combo.key.split(COMBO_SEP);
    return groups.every((group, index) => {
      const comboValue = values[index] ?? "";
      if (group.name === groupName) return comboValue === value;
      const chosen = selection[group.name];
      return !chosen || chosen === comboValue;
    });
  });
}

/** Todas as combinações possíveis a partir dos grupos cadastrados. */
export function allComboKeys(groups: VariantGroup[]): string[] {
  const usable = groups.filter((g) => g.options.length);
  if (!usable.length) return [];
  return usable.reduce<string[]>(
    (acc, group) => acc.flatMap((prefix) => group.options.map((o) => (prefix ? `${prefix}${COMBO_SEP}${o.value}` : o.value))),
    [""],
  );
}

/* ---------------------------------------------------------------------------
 * Textos e métricas exibidas: o painel controla, o layout apenas lê.
 * ------------------------------------------------------------------------- */

/** Aceita "4,8" ou "4.8" e devolve um número entre 0 e 5. */
export function parseRatingInput(value: string): number {
  const n = Number(String(value).replace(",", ".").trim());
  if (!Number.isFinite(n)) return 0;
  return Math.min(5, Math.max(0, n));
}

/** Nota bonita na tela: "5,0", "4,8". */
export function ratingText(value: number): string {
  return (Math.round((Number.isFinite(value) ? value : 0) * 10) / 10).toFixed(1).replace(".", ",");
}

type MetricsProduct = Pick<Product, "rating" | "reviews_count" | "sold_count" | "display" | "offer"> & { reviews?: Review[] };

/** Nota na página do produto: "5.0", "4.8". */
export function ratingDot(value: number): string {
  return (Math.round((Number.isFinite(value) ? value : 0) * 10) / 10).toFixed(1);
}

export function shownRating(product: MetricsProduct): number {
  const d = product.display ?? {};
  if (d.rating_source === "manual" && d.rating != null) return Math.min(5, Math.max(0, Number(d.rating)));
  // Automático: média real das avaliações cadastradas (visíveis); sem avaliações, usa a nota do cadastro.
  const real = (product.reviews ?? []).filter((r) => !r.hidden && Number(r.rating) > 0);
  if (real.length) return Math.min(5, real.reduce((a, r) => a + Number(r.rating), 0) / real.length);
  return Number(product.rating) || 0;
}

export function shownReviews(product: MetricsProduct): { count: number; label: string } {
  const d = product.display ?? {};
  const count =
    d.reviews_source === "manual" && d.reviews_count != null
      ? Math.max(0, Math.round(Number(d.reviews_count)))
      : Math.max(0, Math.round(Number(product.reviews_count) || 0));
  return { count, label: d.reviews_label?.trim() || "avaliações" };
}

export function shownSold(product: MetricsProduct): { count: number; label: string } {
  const d = product.display ?? {};
  const count =
    d.sold_source === "manual" && d.sold_count != null
      ? Math.max(0, Math.round(Number(d.sold_count)))
      : Math.max(0, Math.round(Number(product.sold_count) || 0));
  return { count, label: d.sold_label?.trim() || "vendidos" };
}

/** Selos promocionais 1 e 2 — texto do painel, com o valor antigo como padrão. */
export function promoBadges(product: MetricsProduct): { badge1: string | null; badge2: string | null } {
  const d = product.display ?? {};
  const text1 = (d.badge1_text ?? product.offer?.badge ?? "").trim();
  const text2 = (d.badge2_text ?? product.offer?.highlight ?? "").trim();
  return {
    badge1: d.badge1_show === false || !text1 ? null : text1,
    badge2: d.badge2_show === false || !text2 ? null : text2,
  };
}

/** Avaliação do topo do Checkout 2. */
export function checkoutRating(
  store: Pick<StoreSettings, "checkout">,
  product: MetricsProduct | null,
): { text: string; value: string; max: string } | null {
  const c = store.checkout ?? {};
  if (c.show_rating === false) return null;
  const value =
    c.rating_from_product === false && c.rating_value != null
      ? Number(c.rating_value)
      : product
        ? shownRating(product)
        : Number(c.rating_value ?? 0);
  return {
    text: c.rating_text?.trim() || "Ótima avaliação!",
    value: ratingText(value),
    max: c.rating_max?.trim() || "5,0",
  };
}

/** Recuperação de PIX pendente, por loja (fica dentro de store_settings.checkout). */
export type PixRecoverySettings = {
  enabled?: boolean;
  show_notice?: boolean;
  allow_copy?: boolean;
  allow_chat?: boolean;
  show_badge?: boolean;
  title?: string;
  copy_label?: string;
  chat_label?: string;
};

export function resolvePixRecovery(raw: unknown) {
  const p = (raw && typeof raw === "object" ? raw : {}) as PixRecoverySettings;
  const enabled = p.enabled !== false;
  return {
    enabled,
    show_notice: enabled && p.show_notice !== false,
    allow_copy: enabled && p.allow_copy !== false,
    allow_chat: enabled && p.allow_chat !== false,
    show_badge: enabled && p.show_badge !== false,
    title: p.title?.trim() || "Você possui um pagamento PIX pendente",
    copy_label: p.copy_label?.trim() || "COPIAR CÓDIGO PIX",
    chat_label: p.chat_label?.trim() || "Abrir chat",
  };
}
export type ResolvedPixRecovery = ReturnType<typeof resolvePixRecovery>;

/* ---------------------------------------------------------------------------
 * Popups / notificações flutuantes — por loja (store_settings.checkout.popups).
 * ------------------------------------------------------------------------- */
export type PopupNotification = {
  id: string;
  active?: boolean;
  image?: string | null;
  name?: string;
  location?: string;
  title?: string;
  message?: string;
  secondary?: string;
  product_id?: string | null;
  /** Nome do produto vinculado, guardado ao escolher no painel. */
  product_name?: string;
  use_current_product?: boolean;
  scope?: "all" | "selected" | "one";
  product_ids?: string[];
  /** Mostra o selo Verificado (só para compra confirmada). */
  verified?: boolean;
  /** Texto próprio do selo desta notificação (vazio = texto geral). */
  badge_text?: string;
  /** Tempo exibido, em minutos ("há N minutos"). */
  minutes?: number | undefined;
  /** Texto de tempo digitado à mão (tem prioridade sobre minutos). */
  time_text?: string;
  /** Nome do produto digitado à mão (tem prioridade sobre o vinculado). */
  product_text?: string;
};

export type PopupBadgeColor = "accent" | "primary" | "success" | "verified" | "foreground";

export type PopupSettings = {
  enabled?: boolean;
  source?: "manual" | "reviews" | "real" | "manual_reviews" | "both";
  position?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  delay?: number;
  visible?: number;
  interval?: number;
  order?: "sequence" | "random";
  animation?: "slide-fade" | "fade" | "slide" | "none";
  show_close?: boolean;
  real_title?: string;
  real_message?: string;
  real_badge?: string;
  review_title?: string;
  review_message?: string;
  review_secondary?: string;
  review_max_chars?: number | undefined;
  review_show_location?: boolean;
  review_use_order_location?: boolean;
  review_confirmed_only?: boolean;
  /** Calcula o tempo a partir da data real (compras/avaliações). */
  real_time?: boolean;
  /** Partes visíveis do popup. */
  show_photo?: boolean;
  show_name?: boolean;
  show_location?: boolean;
  show_location_icon?: boolean;
  show_product?: boolean;
  show_secondary?: boolean;
  show_badge?: boolean;
  show_time?: boolean;
  badge_text?: string;
  badge_color?: PopupBadgeColor;
  items?: PopupNotification[];
};

export function resolvePopupSettings(raw: unknown) {
  const p = (raw && typeof raw === "object" ? raw : {}) as PopupSettings;
  const num = (v: unknown, d: number, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) && v !== "" && v != null ? Math.min(max, Math.max(min, n)) : d;
  };
  return {
    enabled: p.enabled === true,
    source: p.source ?? "manual",
    position: p.position ?? "bottom-left",
    delay: num(p.delay, 10, 0, 600),
    visible: num(p.visible, 5, 1, 120),
    interval: num(p.interval, 30, 1, 3600),
    order: p.order ?? "sequence",
    animation: p.animation ?? "slide-fade",
    show_close: p.show_close !== false,
    real_title: p.real_title?.trim() || "{nome} — {cidade}",
    real_message: p.real_message?.trim() || "comprou {produto}",
    real_badge: p.real_badge?.trim() ?? "Verificado",
    review_title: p.review_title?.trim() || "{nome}",
    review_message: p.review_message?.trim() || "{avaliacao}",
    review_secondary: p.review_secondary?.trim() ?? "Avaliou {produto}",
    review_max_chars: num(p.review_max_chars, 100, 20, 300),
    review_show_location: p.review_show_location === true,
    review_use_order_location: p.review_use_order_location === true,
    review_confirmed_only: p.review_confirmed_only === true,
    real_time: p.real_time !== false,
    show_photo: p.show_photo !== false,
    show_name: p.show_name !== false,
    show_location: p.show_location !== false,
    show_location_icon: p.show_location_icon !== false,
    show_product: p.show_product !== false,
    show_secondary: p.show_secondary !== false,
    show_badge: p.show_badge !== false,
    show_time: p.show_time !== false,
    badge_text: p.badge_text?.trim() || "Verificado",
    badge_color: (p.badge_color ?? "accent") as PopupBadgeColor,
    items: (p.items ?? []).filter((i) => i && i.id),
  };
}
export type ResolvedPopupSettings = ReturnType<typeof resolvePopupSettings>;

/** O popup aparece neste produto? Considera a loja e a opção do produto. */
export function popupEnabledFor(settings: ResolvedPopupSettings, productMode: ProductSections["popup_mode"]): boolean {
  if (productMode === "off") return false;
  if (productMode === "on") return true;
  return settings.enabled;
}

/** A notificação manual vale para este produto? */
export function popupMatchesProduct(item: PopupNotification, productId: string | null): boolean {
  if (item.active === false) return false;
  const scope = item.scope ?? "all";
  if (scope === "all") return true;
  if (!productId) return false;
  return (item.product_ids ?? []).includes(productId);
}

export function fillPopupText(text: string | undefined, vars: Record<string, string | undefined>): string {
  return (text ?? "")
    .replace(/\{(produto|loja|preco|cidade|estado|nome|nota|avaliacao|data)\}/g, (_, k: string) => (vars[k] ?? "").trim())
    .replace(/["“”']\s*["“”']/g, "")
    .replace(/\s+([,.:;!?])/g, "$1")
    .replace(/([,:;—-])\s*(?=[,:;—-])/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^[,:;—–-]+\s*/, "")
    .replace(/\s*[,:;—–-]+$/, "")
    .trim();
}

/** Corta o texto em até `max` caracteres, terminando com "...". */
export function truncateText(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, "").trimEnd() + "...";
}

/** Imagem da variação escolhida: combinação → opção selecionada → principal. Usa os valores (ids) das opções, nunca o texto. */
export function variantImage(
  product: Pick<Product, "variants" | "variant_combos" | "media">,
  selection: Record<string, string>,
): string | undefined {
  const combo = findCombo(product, selection);
  if (combo?.image) return combo.image;
  for (const group of product.variants ?? []) {
    const url = group.options.find((o) => o.value === selection[group.name])?.image;
    if (url) return url;
  }
  return (product.media ?? []).find((m) => m.type === "image")?.url;
}
