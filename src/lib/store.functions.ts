import { stableMediaUrl } from "@/lib/media-url";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Product, StoreSettings } from "./product-types";

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
    return row ? normalize(row as Record<string, unknown>) : null;
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
  quantity: z.number().int().min(1).max(20),
  variant: z.record(z.string(), z.string()),
  shipping_id: z.string().min(1),
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
      .select("id, slug, title, price, previous_price, media, shipping, stock, active, store_id, variants, variant_combos")
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

    const unitPrice = pricing.price;
    const unitCents = Math.round(Number(unitPrice) * 100);
    const shippingCents = Math.round(Number(option.price ?? 0) * 100);
    const subtotal = (unitCents * data.quantity) / 100;
    const shippingPrice = shippingCents / 100;
    const total = (unitCents * data.quantity + shippingCents) / 100;
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
          image:
            groups
              .map((group) => group.options.find((o) => o.value === data.variant[group.name])?.image)
              .find((url) => !!url) ?? media.find((m) => m.type === "image")?.url ?? null,
          sku: pricing.sku,
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
        payment: { provider: null, status: "pendente" },
        meta_attribution: attribution,
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
      .select("id, order_number, total, status, store_id, product_id, quantity, unit_price, shipping_price, customer, address, product_snapshot, payment, transaction_id, provider_status, pix_expiration_date")
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
        expires_in: saved.expires_in ?? 1800,
        expires_at: ((order as { pix_expiration_date?: string | null }).pix_expiration_date ?? (saved as { expiration_date?: string }).expiration_date ?? null) as string | null,
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
    const amountCents = unitCents * quantity + feeCents;
    if (amountCents !== cents(order.total) || amountCents <= 0) {
      return { ...notConfigured, configured: true as const, error: "Não foi possível confirmar o valor do pedido." };
    }

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
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const origin = new URL(getRequest().url).origin;
      if (origin.startsWith("https://")) postbackUrl = row.provider === "wappi" ? `${origin}/api/public/webhooks/wappi` : `${origin}/api/public/pagamentos/webhook`;
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
        items: [{ title: product.title, unit_price: unitCents, quantity, tangible: true, external_ref: product.id }],
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
        metadata: { order_id: order.id as string, store_id: order.store_id as string },
        expiresInDays: pixDays,
      });
    } catch (err) {
      console.error("[pix] erro ao gerar", err instanceof Error ? err.message : "desconhecido");
      await release();
      return { ...notConfigured, configured: true as const, error: "Não foi possível gerar o PIX agora. Tente novamente." };
    }

    if (!charge.ok) {
      console.error("[pix] provedor recusou", row.provider, charge.error);
      await release();
      return { ...notConfigured, configured: true as const, error: charge.error };
    }

    // Prazo de pagamento da loja: 15 minutos a partir da criação. A Wappi só aceita validade em
    // dias inteiros (pix.expires_in_days), então a cobrança no banco do cliente pode durar mais;
    // após 15 min o site trata o PIX como expirado (esconde o código e oferece "Gerar novo PIX").
    // Se o cliente pagar mesmo assim, o webhook/consulta continua confirmando o pedido normalmente.
    const PIX_WINDOW_MS = 15 * 60 * 1000;
    const gatewayExpMs = charge.expiration_date ? Date.parse(charge.expiration_date) : NaN;
    const expMs = Math.min(Date.now() + PIX_WINDOW_MS, Number.isFinite(gatewayExpMs) ? gatewayExpMs : Infinity);
    const expIso = new Date(expMs).toISOString();
    charge = { ...charge, expiration_date: expIso, expires_in: Math.max(0, Math.floor((expMs - Date.now()) / 1000)) };

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
