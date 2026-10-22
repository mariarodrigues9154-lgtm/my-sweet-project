import { stableMediaUrl } from "@/lib/media-url";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Product, StoreSettings } from "./product-types";
import { reviewsPageSize, variantImage } from "./product-types";
import { parseGatewayDate } from "./pix-time";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const url = process.env["SUPABASE_URL"]!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const PRODUCT_COLUMNS =
  "id, slug, active, name, title, subtitle, price, previous_price, stock, rating, reviews_count, sold_count, offer, media, variants, variant_combos, shipping, warranty, protection, specs, description, creator_videos, reviews, terms, sort_order, sections, display";

function normalize(row: Record<string, unknown>): Product {
  return {
    ...(row as unknown as Product),
    price: Number(row["price"]),
    previous_price: Number(row["previous_price"]),
    rating: Number(row["rating"]),
    variant_combos: Array.isArray(row["variant_combos"]) ? (row["variant_combos"] as Product["variant_combos"]) : [],
    display: (row["display"] ?? {}) as Product["display"],
    creator_videos: (Array.isArray(row["creator_videos"]) ? (row["creator_videos"] as Product["creator_videos"]) : [])
      .filter((v) => v && (v.video || v.thumb))
      .map((v) => ({ ...v, video: stableMediaUrl(v.video), thumb: stableMediaUrl(v.thumb), avatar: v.avatar ? stableMediaUrl(v.avatar) : null })),
  };
}


export const STORE_COLUMNS =
  "id, slug, name, logo_url, footer_logo_url, tagline, support_email, whatsapp, visit_url, avatar_url, cover_url, banner_url, banner_link, verified, sold_count, show_follow, show_message, show_visit, visit_clickable, favicon_url, show_footer, indicators, featured_product_ids, footer_text, policies, checkout";

export const EMPTY_STORE: StoreSettings = {
  id: "",
  slug: "principal",
  name: "[NOME DA MINHA LOJA]",
  logo_url: null,
  footer_logo_url: null,
  tagline: null,
  support_email: null,
  whatsapp: null,
  visit_url: null,
  avatar_url: null,
  cover_url: null,
  banner_url: null,
  banner_link: null,
  verified: true,
  sold_count: 0,
  show_follow: true,
  show_message: true,
  show_visit: true,
  visit_clickable: true,
  favicon_url: null,
  show_footer: true,
  indicators: [],
  featured_product_ids: [],
  footer_text: null,
  policies: { privacy: "", refund: "", terms: "", shipping: "" },
  checkout: { checkout_model: "v1" },
};

const storeLookup = z
  .object({
    slug: z.string().max(120).optional(),
    productSlug: z.string().max(160).optional(),
    orderNumber: z.string().max(60).optional(),
  })
  .optional();

/** Resolve a loja por endereço, produto ou pedido; sem nada, usa a loja principal. */
export const getStoreSettings = createServerFn({ method: "GET" })
  .inputValidator((data?: { slug?: string; productSlug?: string; orderNumber?: string }) => storeLookup.parse(data) ?? {})
  .handler(async ({ data }) => {
    const db = publicClient();
    let storeId: string | null = null;
    if (data.orderNumber) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: o } = await supabaseAdmin.from("orders").select("store_id").eq("order_number", data.orderNumber).maybeSingle();
      storeId = (o?.store_id as string | null) ?? null;
    }
    if (!storeId && data.productSlug) {
      const { data: p } = await db.from("products").select("store_id").eq("slug", data.productSlug).eq("active", true).maybeSingle();
      storeId = (p?.store_id as string | null) ?? null;
    }
    let query = db.from("store_settings").select(STORE_COLUMNS);
    if (storeId) query = query.eq("id", storeId);
    else if (data.slug) query = query.eq("slug", data.slug);
    else query = query.eq("is_default", true);
    const { data: row } = await query.limit(1).maybeSingle();
    if (!row && data.slug) return null;
    if (!row) {
      const { data: fallback } = await db.from("store_settings").select(STORE_COLUMNS).eq("is_default", true).maybeSingle();
      return { ...EMPTY_STORE, ...((fallback ?? {}) as object) } as StoreSettings;
    }
    return { ...EMPTY_STORE, ...(row as object) } as StoreSettings;
  });

export const getProductBySlug = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { data: row } = await publicClient()
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    return row ? trimReviews(normalize(row as Record<string, unknown>)) : null;
  });

/** Entrega só a 1ª página de avaliações visíveis + resumo (nota/total) calculado sobre todas. */
function trimReviews(p: Product): Product {
  const visible = (p.reviews ?? []).filter((r) => r && !r.hidden);
  const real = visible.filter((r) => Number.isFinite(Number(r.rating)));
  const avg = real.length ? real.reduce((a, r) => a + Number(r.rating), 0) / real.length : 0;
  return { ...p, reviews: visible.slice(0, reviewsPageSize(p)), reviews_meta: { total: visible.length, avg, rated: real.length } };
}

/** Próximas avaliações visíveis (botão "Ver mais"); lê sempre do banco, então edições do painel valem na hora. */
export const getMoreReviews = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string; offset: number; limit: number }) => z.object({ slug: z.string().min(1), offset: z.number().int().min(0), limit: z.number().int().min(1).max(20) }).parse(d))
  .handler(async ({ data }) => {
    const { data: row } = await publicClient().from("products").select("reviews").eq("slug", data.slug).eq("active", true).maybeSingle();
    const all = (Array.isArray(row?.reviews) ? (row!.reviews as Product["reviews"]) : []).filter((r) => r && !r.hidden);
    return { reviews: all.slice(data.offset, data.offset + data.limit), total: all.length };
  });

export const getFeaturedProduct = createServerFn({ method: "GET" }).handler(async () => {
  const { data: row } = await publicClient()
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return row ? normalize(row as Record<string, unknown>) : null;
});

export const listActiveProducts = createServerFn({ method: "GET" })
  .inputValidator((data?: { storeId?: string }) => z.object({ storeId: z.string().uuid().optional() }).optional().parse(data) ?? {})
  .handler(async ({ data: input }) => {
  let q = publicClient()
    .from("products")
    .select("id, slug, name, title, subtitle, price, previous_price, media, shipping, sold_count, sort_order")
    .eq("active", true);
  if (input.storeId) q = q.eq("store_id", input.storeId);
  const { data } = await q.order("sort_order", { ascending: true });
  return (data ?? []) as Array<{
    id: string;
    slug: string;
    name: string;
    title: string;
    subtitle: string | null;
    price: number;
    previous_price: number;
    media: Product["media"];
    shipping: Product["shipping"];
    sold_count: number;
    sort_order: number;
  }>;
});

const orderInput = z.object({
  slug: z.string().min(1),
  exit_offer: z.union([z.boolean(), z.literal("product")]).optional(),
  method: z.enum(["pix", "card"]).optional(),
  quantity: z.number().int().min(1).max(20),
  variant: z.record(z.string(), z.string()),
  shipping_id: z.string().min(1),
  tracking: z.object(Object.fromEntries(["src", "sck", "utm_source", "utm_campaign", "utm_medium", "utm_content", "utm_term"].map((k) => [k, z.string().max(500).optional()]))).partial().optional(),
  customer: z.object({
    name: z.string().min(3),
    email: z.string().email(),
    phone: z.string().min(10),
    document: z.string().min(11),
  }),
  address: z.object({
    cep: z.string().min(8),
    street: z.string().min(2),
    number: z.string().min(1),
    complement: z.string().optional().default(""),
    district: z.string().min(2),
    city: z.string().min(2),
    state: z.string().min(2),
  }),
});

function orderNumber(): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${stamp}-${rand}`;
}

/** Cria o pedido no servidor: os valores vêm do banco, nunca do navegador. */
export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => orderInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: product, error } = await supabaseAdmin
      .from("products")
      .select("id, slug, title, price, previous_price, media, shipping, stock, active, store_id, variants, variant_combos, sections")
      .eq("slug", data.slug)
      .maybeSingle();

    if (error || !product || !product.active) {
      return { ok: false as const, error: "Produto indisponível." };
    }

    // Preço, estoque e validade da combinação vêm sempre do banco.
    const { comboKeyFor, variantPricing } = await import("./product-types");
    const groups = (Array.isArray(product.variants) ? product.variants : []) as Product["variants"];
    if (groups.length && !comboKeyFor(groups, data.variant)) {
      return { ok: false as const, error: "Selecione todas as opções do produto." };
    }
    const pricing = variantPricing(
      {
        price: Number(product.price),
        previous_price: Number(product.previous_price),
        stock: Number(product.stock ?? 0),
        variants: groups,
        variant_combos: (Array.isArray(product.variant_combos) ? product.variant_combos : []) as Product["variant_combos"],
      },
      data.variant,
    );
    if (!pricing.available) {
      return { ok: false as const, error: "Essa combinação está indisponível." };
    }
    if (pricing.stock < data.quantity) {
      return { ok: false as const, error: "Estoque insuficiente para essa quantidade." };
    }

    // Modalidade única e grátis (regra central em lib/shipping): nada de frete cobrado.
    const { shippingOptions } = await import("./shipping");
    const option = shippingOptions()[0]!;

    // Oferta de saída: desconto real recalculado no servidor a partir da config da loja/produto.
    let unitCents = Math.round(Number(pricing.price) * 100);
    let exitOfferInfo: Record<string, unknown> | null = null;
    const { data: storeRow } = product.store_id
      ? await supabaseAdmin.from("store_settings").select("checkout").eq("id", product.store_id).maybeSingle()
      : { data: null };
    if (data.exit_offer && product.store_id) {
      const { resolveExitOffer, resolveProductExitOffer, discountedUnitCents } = await import("./exit-offer");
      const cfg = storeRow?.checkout as { exit_offer?: unknown; product_exit_offer?: unknown } | null;
      const offer = data.exit_offer === "product"
        ? resolveProductExitOffer(cfg?.product_exit_offer, product.sections as never)
        : resolveExitOffer(cfg?.exit_offer, product.sections as never);
      if (offer) {
        const original = unitCents;
        unitCents = discountedUnitCents(unitCents, offer);
        exitOfferInfo = { source: data.exit_offer === "product" ? "product_page" : "checkout", original_unit_price: original / 100, discount_type: offer.discount_type, discount_value: offer.discount_value };
      }
    }
    // Formas de pagamento da loja: hoje só PIX cobra; desconto PIX recalculado aqui.
    const { resolvePaymentMethods, pixDiscountCents, cardProviderReady } = await import("./payment-methods");
    const methods = resolvePaymentMethods((storeRow?.checkout as { payment_methods?: unknown } | null)?.payment_methods);
    const isCard = data.method === "card";
    if (isCard ? !(methods.card.enabled && cardProviderReady(methods)) : !methods.pix.enabled) {
      return { ok: false as const, error: isCard ? "Pagamento com cartão indisponível nesta loja." : "Pagamento via PIX indisponível nesta loja." };
    }
    const unitPrice = unitCents / 100;
    const shippingCents = Math.round(Number(option.price ?? 0) * 100);
    const grossCents = unitCents * data.quantity + shippingCents;
    const pixOffCents = isCard ? 0 : pixDiscountCents(grossCents, methods);
    const subtotal = (unitCents * data.quantity) / 100;
    const shippingPrice = shippingCents / 100;
    const total = (grossCents - pixOffCents) / 100;
    const pixDiscountInfo = pixOffCents > 0 ? { amount: pixOffCents / 100, type: methods.pix.discount_type, value: methods.pix.discount_value } : null;
    const media = (product.media ?? []) as Array<{ type: string; url: string }>;

    let attribution: Record<string, string> = {};
    try {
      const { getRequestHeader } = await import("@tanstack/react-start/server");
      const { attributionFromHeaders } = await import("./meta.server");
      attribution = attributionFromHeaders((name) => getRequestHeader(name));
    } catch { attribution = {}; }

    const { data: created, error: insertError } = await supabaseAdmin
      .from("orders")
      .insert({
        order_number: orderNumber(),
        product_id: product.id,
        store_id: product.store_id,
        product_snapshot: {
          title: product.title,
          slug: product.slug,
          image: variantImage({ variants: groups, variant_combos: product.variant_combos ?? [], media } as never, data.variant) ?? null,
          variant_labels: Object.fromEntries(groups.filter((g) => data.variant[g.name]).map((g) => [g.label || g.name, g.options.find((o) => o.value === data.variant[g.name])?.label ?? data.variant[g.name]])),
          sku: pricing.sku,
          ...(exitOfferInfo ? { exit_offer: exitOfferInfo } : {}),
          ...(pixDiscountInfo ? { pix_discount: pixDiscountInfo } : {}),
        },

        variant: data.variant,
        quantity: data.quantity,
        unit_price: unitPrice,
        subtotal,
        shipping_label: option.label,
        shipping_price: shippingPrice,
        total,
        customer: data.customer,
        address: data.address,
        status: "aguardando_pagamento",
        payment: { provider: null, status: "pendente", ...(isCard ? { method: "card" } : {}) },
        meta_attribution: attribution,
        tracking_params: data.tracking ?? {},
      } as never)
      .select("order_number, total, access_token")
      .single();

    if (insertError || !created) {
      return { ok: false as const, error: "Não foi possível registrar o pedido. Tente novamente." };
    }

    return { ok: true as const, order_number: created.order_number, total: Number(created.total), access_token: created.access_token as string };
  });

export const getOrder = createServerFn({ method: "GET" })
  .inputValidator((data: { order_number: string }) =>
    z.object({ order_number: z.string().min(4) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("orders")
      .select(
        "order_number, status, product_id, quantity, unit_price, subtotal, shipping_label, shipping_price, total, product_snapshot, variant, customer, address, payment, created_at",
      )
      .eq("order_number", data.order_number)
      .maybeSingle();
    if (!row) return null;
    return {
      ...row,
      unit_price: Number(row.unit_price),
      subtotal: Number(row.subtotal),
      shipping_price: Number(row.shipping_price),
      total: Number(row.total),
    };
  });

/**
 * Cobrança PIX gerada pelo gateway da loja dona do produto.
 * Sem gateway ativo devolvemos configured:false — nunca um QR Code de demonstração.
 */
export const createPixCharge = createServerFn({ method: "POST" })
  .inputValidator((data: { order_number: string }) =>
    z.object({ order_number: z.string().min(4) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, total, status, store_id, product_id, quantity, unit_price, shipping_price, customer, address, product_snapshot, payment, transaction_id, provider_status, pix_expiration_date, tracking_params")
      .eq("order_number", data.order_number)
      .maybeSingle();

    if (!order) return { ok: false as const, configured: false as const, error: "Pedido não encontrado." };
    if (order.status === "pago") return { ok: false as const, configured: true as const, error: "Este pedido já foi pago." };

    const notConfigured = {
      ok: false as const,
      configured: false as const,
      order_number: order.order_number as string,
      total: Number(order.total),
    };

    if (!order.store_id) return notConfigured;

    // Se a cobrança já existe, devolvemos a mesma — sem duplicar no provedor.
    const saved = (order.payment ?? {}) as { qr_code?: string; copy_paste?: string; expires_in?: number; provider?: string };
    if (order.transaction_id && (saved.qr_code || saved.copy_paste)) {
      return {
        ok: true as const,
        configured: true as const,
        provider: saved.provider ?? "",
        order_number: order.order_number as string,
        total: Number(order.total),
        qr_code: saved.qr_code ?? null,
        copy_paste: saved.copy_paste ?? null,
        ...(() => {
          // Tempo restante calculado AGORA pelo relógio do servidor (não o valor salvo na criação).
          const exp = ((order as { pix_expiration_date?: string | null }).pix_expiration_date ?? (saved as { expiration_date?: string }).expiration_date ?? null) as string | null;
          const ms = exp ? parseGatewayDate(exp) : NaN;
          return Number.isFinite(ms)
            ? { expires_in: Math.max(0, Math.floor((ms - Date.now()) / 1000)), expires_at: new Date(ms).toISOString() }
            : { expires_in: saved.expires_in ?? 900, expires_at: null };
        })(),
      };
    }

    const { loadStorePayment, toGatewayConfig } = await import("@/lib/payments/resolve.server");
    const row = await loadStorePayment(order.store_id as string);
    if (!row || !row.enabled || row.provider === "none") {
      console.error("[pix] loja sem gateway ativo", order.store_id, Boolean(row));
      return notConfigured;
    }

    const { getProvider } = await import("@/lib/payments/providers.server");
    const gateway = getProvider(row.provider);
    if (!gateway) return notConfigured;

    const customer = (order.customer ?? {}) as { name?: string; email?: string; document?: string; phone?: string };
    const address = (order.address ?? {}) as { cep?: string; street?: string; number?: string; complement?: string; district?: string; city?: string; state?: string };

    // Valores sempre relidos do banco — produto ativo, da mesma loja, preço do pedido calculado no servidor.
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("id, title, store_id, active")
      .eq("id", order.product_id as string)
      .maybeSingle();
    if (!product || product.store_id !== order.store_id) return { ...notConfigured, configured: true as const, error: "Produto indisponível." };

    const cents = (v: unknown) => Math.round(Number(String(v ?? 0)) * 100);
    const quantity = Math.max(1, Number(order.quantity ?? 1));
    const unitCents = cents(order.unit_price);
    const feeCents = cents(order.shipping_price);
    const grossCents = unitCents * quantity + feeCents;
    // Total do pedido (calculado no servidor) já inclui o desconto PIX da loja.
    const amountCents = cents(order.total);
    const savedOff = (order.product_snapshot as { pix_discount?: { amount?: number } } | null)?.pix_discount?.amount;
    const offOk = savedOff == null ? amountCents <= grossCents : grossCents - amountCents === cents(savedOff);
    if (amountCents <= 0 || !offOk) {
      console.error("[pix] valor inconsistente", { order: order.order_number, grossCents, amountCents, savedOff });
      return { ...notConfigured, configured: true as const, error: "Não foi possível confirmar o valor do pedido." };
    }
    // Itens somam exatamente o valor cobrado (desconto PIX distribuído no item).
    const itemsCents = amountCents - feeCents;
    const pixItems = itemsCents % quantity === 0
      ? [{ title: product.title, unit_price: itemsCents / quantity, quantity, tangible: true, external_ref: product.id }]
      : [{ title: `${quantity}x ${product.title}`, unit_price: itemsCents, quantity: 1, tangible: true, external_ref: product.id }];
    console.info("[pix] create_started", { order: order.order_number, store: order.store_id, provider: row.provider, amountCents, previous_method: (order.payment as { method?: string } | null)?.method ?? "pix" });

    // Trava contra clique duplo: só uma geração por vez para o mesmo pedido.
    const staleIso = new Date(Date.now() - 60000).toISOString();
    const { data: locked } = await supabaseAdmin
      .from("orders")
      .update({ provider_status: "creating", updated_at: new Date().toISOString() } as never)
      .eq("id", order.id)
      .is("transaction_id", null)
      .or(`provider_status.is.null,provider_status.neq.creating,updated_at.lt.${staleIso}`)
      .select("id");
    if (!locked || locked.length === 0) {
      return { ...notConfigured, configured: true as const, error: "Seu PIX já está sendo gerado. Aguarde alguns segundos." };
    }
    const release = () => supabaseAdmin.from("orders").update({ provider_status: null } as never).eq("id", order.id).eq("provider_status", "creating");

    let postbackUrl: string | undefined;
    let checkoutUrl: string | undefined;
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const origin = new URL(getRequest().url).origin;
      checkoutUrl = `${origin}/pagamento`;
      if (origin.startsWith("https://")) postbackUrl = row.provider === "wappi" ? `${origin}/api/public/webhooks/wappi` : row.provider === "freepay" ? `${origin}/api/public/webhooks/freepay` : row.provider === "pinpay" ? `${origin}/api/public/webhooks/pinpay` : row.provider === "blackcat" ? `${origin}/api/public/webhooks/blackcat` : row.provider === "invictuspay" ? `${origin}/api/public/webhooks/invictuspay` : row.provider === "codefy" ? `${origin}/api/public/webhooks/codefy` : `${origin}/api/public/pagamentos/webhook`;
    } catch {
      postbackUrl = undefined;
    }
    const pixDays = Number((row.pix_config as { expires_in_days?: number }).expires_in_days ?? 1) || 1;

    let charge;
    try {
      charge = await gateway.createPix(toGatewayConfig(row), {
        orderNumber: order.order_number as string,
        amount: amountCents / 100,
        amountCents,
        description: product.title ?? `Pedido ${order.order_number}`,
        customer: {
          name: customer.name ?? "Cliente",
          email: customer.email ?? "",
          document: customer.document ?? "",
          ...(customer.phone ? { phone: customer.phone } : {}),
        },
        items: pixItems,
        shipping: {
          fee: feeCents,
          address: {
            street: address.street ?? "",
            street_number: address.number ?? "",
            complement: address.complement ?? "",
            zip_code: (address.cep ?? "").replace(/\D/g, ""),
            neighborhood: address.district ?? "",
            city: address.city ?? "",
            state: (address.state ?? "").toUpperCase(),
            country: "BR",
          },
        },
        ...(postbackUrl ? { postbackUrl } : {}),
        ...(checkoutUrl ? { checkoutUrl } : {}),
        metadata: { ...Object.fromEntries(Object.entries(((order as { tracking_params?: unknown }).tracking_params ?? {}) as Record<string, unknown>).filter(([, v]) => typeof v === "string") as [string, string][]), order_id: order.id as string, store_id: order.store_id as string },
        expiresInDays: pixDays,
      });
    } catch (err) {
      console.error("[pix] erro ao gerar", err instanceof Error ? err.message : "desconhecido");
      await release();
      return { ...notConfigured, configured: true as const, error: "Não foi possível gerar o PIX agora. Tente novamente." };
    }

    if (!charge.ok) {
      console.error("[pix] provedor recusou", JSON.stringify({ order: order.order_number, store: order.store_id, provider: row.provider, error: charge.error }));
      await release();
      return { ...notConfigured, configured: true as const, error: charge.error };
    }

    // Prazo de pagamento da loja: 15 minutos a partir da criação. A Wappi só aceita validade em
    // dias inteiros (pix.expires_in_days), então a cobrança no banco do cliente pode durar mais;
    // após 15 min o site trata o PIX como expirado (esconde o código e oferece "Gerar novo PIX").
    // Se o cliente pagar mesmo assim, o webhook/consulta continua confirmando o pedido normalmente.
    const PIX_WINDOW_MS = 15 * 60 * 1000;
    const nowMs = Date.now();
    // Data do gateway: datas sem fuso são lidas como horário de Brasília. Uma data que já passou
    // ou vence em menos de 2 min para uma cobrança recém-criada é inconsistente (fuso/unidade
    // errados) e é ignorada — nunca pode fazer um PIX novo nascer expirado.
    const rawGw = charge.expiration_date ? parseGatewayDate(charge.expiration_date) : NaN;
    const gatewayExpMs = Number.isFinite(rawGw) && rawGw > nowMs + 2 * 60 * 1000 ? rawGw : NaN;
    if (charge.expiration_date && !Number.isFinite(gatewayExpMs)) console.warn("[pix] validade do gateway ignorada", row.provider, charge.expiration_date);
    // Blackcat: a validade devolvida pelo gateway é a fonte de verdade (sem janela de 15 min).
    const expMs = (row.provider === "blackcat" || row.provider === "codefy") && Number.isFinite(gatewayExpMs) ? gatewayExpMs : Math.min(nowMs + PIX_WINDOW_MS, Number.isFinite(gatewayExpMs) ? gatewayExpMs : Infinity);
    const expIso = new Date(expMs).toISOString();
    charge = { ...charge, expiration_date: expIso, expires_in: Math.max(0, Math.floor((expMs - nowMs) / 1000)) };

    await supabaseAdmin
      .from("orders")
      .update({
        transaction_id: charge.transaction_id,
        payment_provider: row.provider,
        payment_method: "pix",
        provider_status: (charge.provider_status ?? "PENDING").toLowerCase(),
        e2e: charge.e2e ?? null,
        pix_expiration_date: charge.expiration_date ? new Date(charge.expiration_date).toISOString() : null,
        total_amount_cents: amountCents,
        payment: {
          provider: row.provider,
          status: "pendente",
          qr_code: charge.qr_code,
          copy_paste: charge.copy_paste,
          expires_in: charge.expires_in,
          ...(charge.payment_url ? { payment_url: charge.payment_url } : {}),
          ...(charge.expiration_date ? { expiration_date: charge.expiration_date } : {}),
        },
      } as never)
      .eq("id", order.id);

    console.info("[pix] create_result", { order: order.order_number, provider: row.provider, amountCents, status: charge.provider_status ?? "PENDING" });
    try { const { syncUtmifyOrder } = await import("./utmify.server"); await syncUtmifyOrder(order.id as string); } catch { /* nunca bloqueia o PIX */ }
    return {
      ok: true as const,
      configured: true as const,
      provider: row.provider,
      order_number: order.order_number as string,
      total: amountCents / 100,
      qr_code: charge.qr_code,
      copy_paste: charge.copy_paste,
      expires_in: charge.expires_in,
      expires_at: charge.expiration_date ? new Date(charge.expiration_date).toISOString() : new Date(Date.now() + charge.expires_in * 1000).toISOString(),
    };
  });

/** Status do pedido: confirma no provedor da loja enquanto estiver pendente. */
export const getPaymentStatus = createServerFn({ method: "GET" })
  .inputValidator((data: { order_number: string }) =>
    z.object({ order_number: z.string().min(4).max(64) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { checkOrderPaymentStatus } = await import("@/lib/payments/order-status.server");
    const result = await checkOrderPaymentStatus(data.order_number);
    return { status: result.status };
  });

const cardPayInput = z.object({
  order_number: z.string().min(4).max(64),
  installments: z.number().int().min(1).max(12),
  card: z.object({
    number: z.string().regex(/^\d{13,19}$/),
    holder_name: z.string().trim().min(3).max(60),
    expiration_month: z.number().int().min(1).max(12),
    expiration_year: z.number().int().min(2024).max(2100),
    cvv: z.string().regex(/^\d{3,4}$/),
  }),
});

/**
 * Cartão de crédito pelo gateway da loja (hoje FreePay). Valor e parcelas recalculados no servidor;
 * os dados do cartão só seguem em memória para o gateway — nunca são gravados nem logados.
 * Pago/recusado vêm somente do status real devolvido pelo gateway.
 */
export const payOrderWithCard = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => cardPayInput.parse(data))
  .handler(async ({ data }) => {
    const fail = (error: string) => ({ status: "error" as const, error });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, status, store_id, product_id, quantity, unit_price, shipping_price, total, customer, address, payment, provider_status")
      .eq("order_number", data.order_number)
      .maybeSingle();
    if (!order || !order.store_id) return fail("Pedido não encontrado.");
    if (order.status === "pago") return { status: "paid" as const, error: null };
    const savedPayment = (order.payment ?? {}) as Record<string, unknown>;
    if (savedPayment["method"] !== "card") return fail("Este pedido não foi criado para cartão.");

    const { data: storeRow } = await supabaseAdmin.from("store_settings").select("checkout").eq("id", order.store_id).maybeSingle();
    const { resolvePaymentMethods, cardProviderReady, installmentPlan, normalizeCardStatus } = await import("./payment-methods");
    const methods = resolvePaymentMethods((storeRow?.checkout as { payment_methods?: unknown } | null)?.payment_methods);
    if (!methods.card.enabled || !cardProviderReady(methods)) return fail("Pagamento com cartão indisponível nesta loja.");
    if (data.installments > methods.card.max_installments) return fail("Parcelamento indisponível.");

    const { loadStorePayment, toGatewayConfig } = await import("@/lib/payments/resolve.server");
    const row = await loadStorePayment(order.store_id as string);
    if (!row || !row.enabled || row.provider !== methods.card.provider) return fail("Pagamento com cartão indisponível nesta loja.");

    const { data: product } = await supabaseAdmin.from("products").select("id, title, store_id").eq("id", order.product_id as string).maybeSingle();
    if (!product || product.store_id !== order.store_id) return fail("Produto indisponível.");

    const cents = (v: unknown) => Math.round(Number(String(v ?? 0)) * 100);
    const quantity = Math.max(1, Number(order.quantity ?? 1));
    const unitCents = cents(order.unit_price);
    const feeCents = cents(order.shipping_price);
    const grossCents = unitCents * quantity + feeCents;
    if (grossCents !== cents(order.total) || grossCents <= 0) return fail("Não foi possível confirmar o valor do pedido.");
    const plan = installmentPlan(grossCents, methods).find((p) => p.n === data.installments);
    if (!plan) return fail("Parcelamento indisponível.");
    const amountCents = plan.totalCents;

    // Trava contra clique duplo; uma nova tentativa só é aceita depois de uma recusa real.
    const staleIso = new Date(Date.now() - 90000).toISOString();
    const { data: locked } = await supabaseAdmin
      .from("orders")
      .update({ provider_status: "creating", updated_at: new Date().toISOString() } as never)
      .eq("id", order.id)
      .neq("status", "pago")
      .or(`provider_status.is.null,provider_status.in.(refused,failed,error),and(provider_status.eq.creating,updated_at.lt.${staleIso})`)
      .select("id");
    if (!locked || locked.length === 0) return fail("Seu pagamento já está sendo processado. Aguarde alguns segundos.");

    const customer = (order.customer ?? {}) as { name?: string; email?: string; document?: string; phone?: string };
    const address = (order.address ?? {}) as { cep?: string; street?: string; number?: string; complement?: string; district?: string; city?: string; state?: string };
    let postbackUrl: string | undefined;
    let ip: string | undefined;
    try {
      const { getRequest, getRequestHeader } = await import("@tanstack/react-start/server");
      const origin = new URL(getRequest().url).origin;
      if (origin.startsWith("https://")) postbackUrl = `${origin}/api/public/webhooks/freepay`;
      ip = (getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for") ?? "").split(",")[0]?.trim() || undefined;
    } catch { /* sem request */ }

    const { createFreepayCardCharge } = await import("@/lib/payments/providers.server");
    const logFail = (kind: string, extra: Record<string, unknown>) =>
      console.error("[card] falha", { kind, store_id: order.store_id, order_id: order.id, order_number: order.order_number, provider: row.provider, payment_method: "card", at: new Date().toISOString(), ...extra });
    let charge: Awaited<ReturnType<typeof createFreepayCardCharge>>;
    try {
      charge = await createFreepayCardCharge(toGatewayConfig(row), {
        orderNumber: order.order_number as string,
        amountCents,
        installments: data.installments,
        card: data.card,
        customer: { name: customer.name ?? "Cliente", email: customer.email ?? "", document: customer.document ?? "", ...(customer.phone ? { phone: customer.phone } : {}) },
        items: [{ title: product.title, unit_price: Math.round(amountCents / quantity), quantity, tangible: true, external_ref: product.id }],
        shipping: {
          fee: 0,
          address: { street: address.street ?? "", street_number: address.number ?? "", complement: address.complement ?? "", zip_code: (address.cep ?? "").replace(/\D/g, ""), neighborhood: address.district ?? "", city: address.city ?? "", state: (address.state ?? "").toUpperCase(), country: "BR" },
        },
        ...(postbackUrl ? { postbackUrl } : {}),
        ...(ip ? { ip } : {}),
      });
    } catch (e) {
      // Exceção inesperada: libera a trava e oferece a recuperação pelo PIX.
      logFail("exception", { error: e instanceof Error ? e.message : String(e) });
      await supabaseAdmin.from("orders").update({ provider_status: null } as never).eq("id", order.id);
      return { status: "unavailable" as const, error: null };
    }

    if (!charge.ok) {
      const refused = normalizeCardStatus("freepay", charge.status) === "refused";
      await supabaseAdmin.from("orders").update({ provider_status: refused ? "refused" : null } as never).eq("id", order.id);
      logFail(refused ? "refused" : "technical", { provider_status: charge.status ?? null, error: charge.error });
      if (refused) return { status: "refused" as const, error: null };
      // Qualquer falha técnica/de processamento (timeout, rede, 4xx/5xx, resposta inválida) abre a
      // mensagem de recuperação. Sem transaction_id não houve cobrança registrada; se o gateway aprovar
      // em segundo plano, o webhook marca o pedido como pago e switchOrderToPix recusa gerar PIX.
      return { status: "unavailable" as const, error: null };
    }

    const result = normalizeCardStatus("freepay", charge.status);
    const internal = charge.status.toLowerCase() || "pending";
    const update: Record<string, unknown> = {
      transaction_id: charge.transaction_id,
      payment_provider: row.provider,
      payment_method: "credit_card",
      provider_status: internal,
      total_amount_cents: amountCents,
      payment: { ...savedPayment, provider: row.provider, method: "card", installments: data.installments, charged: amountCents / 100, gateway_status: charge.status, status: result === "paid" ? "pago" : result === "refused" ? "recusado" : "pendente" },
    };
    if (result === "paid") {
      update["status"] = "pago";
      update["paid_at"] = new Date().toISOString();
    }
    await supabaseAdmin.from("orders").update(update as never).eq("id", order.id);
    if (result === "paid") {
      const { sendPurchaseForOrder } = await import("@/lib/meta.server");
      await sendPurchaseForOrder(order.id as string).catch(() => undefined);
    }
    return { status: result === "paid" ? ("paid" as const) : result === "refused" ? ("refused" as const) : ("pending" as const), error: null };
  });

/**
 * Fallback cartão → PIX no MESMO pedido: só quando a tentativa de cartão não deixou cobrança
 * (sem transaction_id) e o pedido não está pago. Recalcula o total com o desconto PIX da loja.
 * Depois o cliente segue o fluxo normal de createPixCharge.
 */
export const switchOrderToPix = createServerFn({ method: "POST" })
  .inputValidator((data: { order_number: string }) => z.object({ order_number: z.string().min(4).max(64) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, status, store_id, quantity, unit_price, shipping_price, payment, transaction_id, provider_status, updated_at, product_snapshot, access_token")
      .eq("order_number", data.order_number)
      .maybeSingle();
    if (!order || !order.store_id) return { ok: false as const, reason: "not_found" as const };
    if (order.status === "pago") return { ok: false as const, reason: "paid" as const };
    const payment = (order.payment ?? {}) as Record<string, unknown>;
    if (payment["method"] !== "card") {
      // Já é PIX (ex.: segundo toque): segue o fluxo PIX normal sem alterar nada.
      return { ok: true as const, order_number: order.order_number as string, access_token: order.access_token as string };
    }
    // Tentativa de cartão em andamento: não gera PIX para evitar cobrança dupla.
    if (order.provider_status === "creating") return { ok: false as const, reason: "card_pending" as const };
    // Já existe transação de cartão: só libera o PIX se a falha estiver confirmada pelo gateway.
    if (order.transaction_id) {
      const FAILED = ["refused", "failed", "error", "canceled", "cancelled", "expired"];
      let st = String(order.provider_status ?? "").toLowerCase();
      if (!FAILED.includes(st)) {
        try {
          const { loadStorePayment, toGatewayConfig } = await import("@/lib/payments/resolve.server");
          const { getProvider } = await import("@/lib/payments/providers.server");
          const cfgRow = await loadStorePayment(order.store_id as string);
          const gw = cfgRow ? getProvider(cfgRow.provider) : null;
          if (!cfgRow || !gw) return { ok: false as const, reason: "card_pending" as const };
          st = String((await gw.getStatus(toGatewayConfig(cfgRow), order.transaction_id as string)).status ?? "").toLowerCase();
        } catch (e) {
          console.error("[card] status incerto ao trocar para PIX", { order_number: order.order_number, store_id: order.store_id, transaction_id: order.transaction_id, error: e instanceof Error ? e.message : String(e) });
          return { ok: false as const, reason: "card_pending" as const };
        }
        if (st === "paid") return { ok: false as const, reason: "paid" as const };
        if (!FAILED.includes(st)) return { ok: false as const, reason: "card_pending" as const };
      }
    }

    const { data: storeRow } = await supabaseAdmin.from("store_settings").select("checkout").eq("id", order.store_id).maybeSingle();
    const { resolvePaymentMethods, pixDiscountCents } = await import("./payment-methods");
    const methods = resolvePaymentMethods((storeRow?.checkout as { payment_methods?: unknown } | null)?.payment_methods);
    if (!methods.pix.enabled) return { ok: false as const, reason: "pix_disabled" as const };

    const cents = (v: unknown) => Math.round(Number(String(v ?? 0)) * 100);
    const grossCents = cents(order.unit_price) * Math.max(1, Number(order.quantity ?? 1)) + cents(order.shipping_price);
    const offCents = pixDiscountCents(grossCents, methods);
    const snapshot = { ...((order.product_snapshot ?? {}) as Record<string, unknown>) };
    delete snapshot["pix_discount"];
    if (offCents > 0) snapshot["pix_discount"] = { amount: offCents / 100, type: methods.pix.discount_type, value: methods.pix.discount_value };

    const base = supabaseAdmin
      .from("orders")
      .update({
        total: (grossCents - offCents) / 100,
        product_snapshot: snapshot,
        provider_status: null,
        transaction_id: null,
        payment_provider: null,
        payment_method: "pix",
        payment: { provider: null, status: "pendente", previous_method: "card", ...(order.transaction_id ? { previous_card_transaction: order.transaction_id } : {}) },
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", order.id)
      .neq("status", "pago")
      .or("provider_status.is.null,provider_status.neq.creating");
    // Só troca se a transação de cartão ainda for a mesma que foi conferida (evita corrida com o webhook).
    const { data: updated } = await (order.transaction_id ? base.eq("transaction_id", order.transaction_id as string) : base.is("transaction_id", null))
      .select("order_number, total, access_token");
    const row = updated?.[0];
    if (!row) return { ok: false as const, reason: "card_pending" as const };
    console.info("[pix] fallback_from_card", { order: order.order_number, store: order.store_id, previous_method: "card", new_method: "pix", amountCents: grossCents - offCents });
    return { ok: true as const, order_number: row.order_number as string, access_token: row.access_token as string };
  });
