import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Acesso restrito ao administrador.");
}

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: products }, { data: orders }, { data: stores }] = await Promise.all([
      supabaseAdmin
        .from("products")
        .select("id, slug, name, title, price, previous_price, stock, active, sort_order, store_id, reviews")
        .order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("orders")
        .select("order_number, status, total, quantity, customer, product_snapshot, created_at, store_id, payment_provider, provider_status, payment")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("store_settings")
        .select("id, slug, name, active, is_default, logo_url, created_at")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true }),
    ]);

    return {
      stores: (stores ?? []).map((st) => ({
        ...st,
        product_count: (products ?? []).filter((p) => p.store_id === st.id).length,
      })),
      products: (products ?? []).map((p) => ({
        ...p,
        price: Number(p.price),
        previous_price: Number(p.previous_price),
        reviews: (Array.isArray(p.reviews) ? p.reviews : []) as Array<{ name: string; rating: number; date?: string; text: string; confirmed?: boolean; hidden?: boolean; photos?: string[]; avatar?: string | null }>,
      })),
      orders: (orders ?? []).map((o) => ({
        order_number: o.order_number,
        store_id: (o.store_id as string | null) ?? null,
        status: o.status,
        quantity: o.quantity,
        created_at: o.created_at,
        total: Number(o.total),
        customer: (o.customer ?? {}) as { name?: string; email?: string },
        product_snapshot: (o.product_snapshot ?? {}) as { title?: string },
        payment_provider: (o.payment_provider as string | null) ?? null,
        provider_status: (o.provider_status as string | null) ?? null,
        payment_url: (() => {
          const u = ((o.payment ?? {}) as { payment_url?: unknown }).payment_url;
          return typeof u === "string" && u.startsWith("https://") ? u : null;
        })(),
      })),

    };
  });

const updateInput = z.object({
  id: z.string().uuid(),
  price: z.number().positive().optional(),
  previous_price: z.number().positive().optional(),
  stock: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  store_id: z.string().uuid().optional(),
});

export const updateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin
      .from("products")
      .update(patch as never)
      .eq("id", id);

    if (error) return { ok: false as const, error: "Não foi possível salvar as alterações." };
    return { ok: true as const };
  });

/** Duplica o produto gerando novo ID e novo slug, mantendo o layout do template. */
export const duplicateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: source } = await supabaseAdmin
      .from("products")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!source) return { ok: false as const, error: "Produto não encontrado." };

    const { id: _id, created_at: _c, updated_at: _u, ...rest } = source as Record<string, unknown>;

    const base = String(source.slug).replace(/-copia(-\d+)?$/, "");
    let slug = `${base}-copia`;
    for (let i = 2; i < 50; i += 1) {
      const { data: exists } = await supabaseAdmin
        .from("products")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!exists) break;
      slug = `${base}-copia-${i}`;
    }

    const { data: created, error } = await supabaseAdmin
      .from("products")
      .insert({
        ...rest,
        slug,
        name: `${source.name} (cópia)`,
        active: false,
        sort_order: Number(source.sort_order ?? 0) + 1,
      } as never)

      .select("id, slug")
      .single();

    if (error || !created) return { ok: false as const, error: "Não foi possível duplicar o produto." };
    return { ok: true as const, id: created.id, slug: created.slug };
  });

const storeInput = z.object({
  id: z.string().uuid().nullable(),
  slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífens no endereço."),
  active: z.boolean(),
  name: z.string().trim().min(2).max(80),
  logo_url: z.string().trim().max(2000).nullable(),
  footer_logo_url: z.string().trim().max(2000).nullable(),
  tagline: z.string().trim().max(160).nullable(),
  support_email: z.union([z.string().email(), z.literal("")]).nullable(),
  whatsapp: z.string().trim().max(30).nullable(),
  visit_url: z.string().trim().max(2000).nullable(),
  avatar_url: z.string().trim().max(2000).nullable(),
  cover_url: z.string().trim().max(2000).nullable(),
  banner_url: z.string().trim().max(2000).nullable(),
  banner_link: z.string().trim().max(2000).nullable(),
  verified: z.boolean(),
  sold_count: z.number().int().min(0),
  show_follow: z.boolean(),
  show_message: z.boolean(),
  show_visit: z.boolean().default(true),
  visit_clickable: z.boolean().default(true),
  favicon_url: z.string().trim().max(2000).nullish().transform((v) => v || null),
  show_footer: z.boolean().default(true),
  indicators: z.array(z.object({ value: z.string().trim().max(30), label: z.string().trim().max(40) })).max(3),
  featured_product_ids: z.array(z.string().uuid()).max(100),
  footer_text: z.string().trim().max(1000).nullable(),
  policies: z.object({ privacy: z.string().max(30000), refund: z.string().max(30000), terms: z.string().max(30000), shipping: z.string().max(30000) }),
  checkout: z.object({
    checkout_model: z.enum(["v1", "v2"]).optional().default("v1"),
    logo_url: z.string().trim().max(2000).nullish(),
    primary_color: z.union([z.string().regex(/^#[0-9a-fA-F]{6}$/), z.literal("")]).nullish(),
    title: z.string().trim().max(60).nullish(),
    note: z.string().trim().max(300).nullish(),
    verified_home: z.boolean().optional(),
    verified_product: z.boolean().optional(),
    verified_checkout: z.boolean().optional(),
    verified_footer: z.boolean().optional(),
    display_name: z.string().trim().max(80).nullish(),
    show_name: z.boolean().optional(),
    discount_title: z.string().trim().max(80).nullish(),
    show_discount: z.boolean().optional(),
    legal_text: z.string().trim().max(1500).nullish(),
    show_legal: z.boolean().optional(),
    show_rating: z.boolean().optional(),
    rating_from_product: z.boolean().optional(),
    rating_text: z.string().trim().max(60).nullish(),
    rating_value: z.number().min(0).max(5).nullish(),
    rating_max: z.string().trim().max(10).nullish(),
    pix_recovery: z.object({
      enabled: z.boolean().optional(),
      show_notice: z.boolean().optional(),
      allow_copy: z.boolean().optional(),
      allow_chat: z.boolean().optional(),
      show_badge: z.boolean().optional(),
      title: z.string().trim().max(80).optional(),
      copy_label: z.string().trim().max(40).optional(),
      chat_label: z.string().trim().max(40).optional(),
    }).optional(),
    exit_offer: z.object({
      enabled: z.boolean().optional(),
      style: z.enum(["default", "aggressive"]).optional(),
      badge: z.string().trim().max(60).optional(),
      title: z.string().trim().max(120).optional(),
      text: z.string().trim().max(600).optional(),
      timer_enabled: z.boolean().optional(),
      timer_minutes: z.number().min(1).max(120).optional(),
      timer_text: z.string().trim().max(120).optional(),
      discount_type: z.enum(["percent", "fixed"]).optional(),
      discount_value: z.number().min(0).max(100000).optional(),
      button_text: z.string().trim().max(80).optional(),
      decline_text: z.string().trim().max(120).optional(),
    }).optional(),
    product_terms: z.object({
      enabled: z.boolean().optional(),
      title: z.string().trim().max(80).optional(),
      text: z.string().max(5000).optional(),
    }).optional(),
    popups: z.object({
      enabled: z.boolean().optional(),
      source: z.enum(["manual", "reviews", "real", "manual_reviews", "both"]).optional(),
      review_title: z.string().trim().max(120).optional(),
      review_message: z.string().trim().max(200).optional(),
      review_secondary: z.string().trim().max(120).optional(),
      review_max_chars: z.number().min(20).max(300).optional(),
      review_show_location: z.boolean().optional(),
      review_use_order_location: z.boolean().optional(),
      review_confirmed_only: z.boolean().optional(),
      real_time: z.boolean().optional(),
      position: z.enum(["bottom-left", "bottom-right", "top-left", "top-right"]).optional(),
      delay: z.number().min(0).max(600).optional(),
      visible: z.number().min(1).max(120).optional(),
      interval: z.number().min(1).max(3600).optional(),
      order: z.enum(["sequence", "random"]).optional(),
      animation: z.enum(["slide-fade", "fade", "slide", "none"]).optional(),
      show_close: z.boolean().optional(),
      real_title: z.string().trim().max(120).optional(),
      real_message: z.string().trim().max(200).optional(),
      real_badge: z.string().trim().max(30).optional(),
      show_photo: z.boolean().optional(), show_name: z.boolean().optional(), show_location: z.boolean().optional(), show_location_icon: z.boolean().optional(), show_product: z.boolean().optional(), show_secondary: z.boolean().optional(), show_badge: z.boolean().optional(), show_time: z.boolean().optional(),
      badge_text: z.string().trim().max(30).optional(),
      badge_color: z.enum(["accent", "primary", "success", "verified", "foreground"]).optional(),
      items: z.array(z.object({
        id: z.string().min(1).max(60),
        active: z.boolean().optional(),
        image: z.string().trim().max(2000).nullish(),
        name: z.string().trim().max(80).optional(),
        location: z.string().trim().max(80).optional(),
        title: z.string().trim().max(120).optional(),
        message: z.string().trim().max(300).optional(),
        secondary: z.string().trim().max(80).optional(),
        product_id: z.string().uuid().nullish(),
        product_name: z.string().trim().max(200).optional(),
        use_current_product: z.boolean().optional(),
        verified: z.boolean().optional(),
        minutes: z.number().int().min(0).max(100000).optional(),
        time_text: z.string().trim().max(40).optional(),
        product_text: z.string().trim().max(200).optional(),
        badge_text: z.string().trim().max(30).optional(),
        scope: z.enum(["all", "selected", "one"]).optional(),
        product_ids: z.array(z.string().uuid()).max(200).optional(),
      })).max(50).optional(),
    }).optional(),
  }),
  ai_support: z
    .object({
      enabled: z.boolean().optional(),
      ships_brazil: z.boolean().optional(),
      warranty_text: z.string().trim().max(1000).optional(),
      store_info: z.string().trim().max(4000).optional(),
      extra_info: z.string().trim().max(4000).optional(),
      support_phone: z.string().trim().max(30).optional(),
      whatsapp_enabled: z.boolean().optional(),
      phone_enabled: z.boolean().optional(),
      forward_enabled: z.boolean().optional(),
      whatsapp_message: z.string().trim().max(300).optional(),
    })
    .optional()
    .default({}),
});

const ADMIN_STORE_COLUMNS =
  "id, slug, active, is_default, name, logo_url, footer_logo_url, tagline, support_email, whatsapp, visit_url, avatar_url, cover_url, banner_url, banner_link, verified, sold_count, show_follow, show_message, show_visit, visit_clickable, favicon_url, show_footer, indicators, featured_product_ids, footer_text, policies, checkout, ai_support";

export const getAdminStore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: store }, { data: products }] = await Promise.all([
      supabaseAdmin.from("store_settings").select(ADMIN_STORE_COLUMNS).eq("id", data.id).maybeSingle(),
      supabaseAdmin.from("products").select("id, title, active").eq("store_id", data.id).order("sort_order"),
    ]);
    if (!store) throw new Error("Loja não encontrada.");
    return {
      store: {
        ...store,
        indicators: (store.indicators ?? []) as Array<{ value: string; label: string }>,
        policies: (store.policies ?? { privacy: "", refund: "", terms: "", shipping: "" }) as { privacy: string; refund: string; terms: string; shipping: string },
        checkout: (store.checkout ?? {}) as import("@/lib/product-types").CheckoutSettings,
        ai_support: (store.ai_support ?? {}) as import("@/lib/product-types").StoreAiSupport,
      },
      products: products ?? [],
    };
  });

/** Cria (id null) ou atualiza uma loja. */
export const updateStoreProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...fields } = data;
    // Espelho público (só o liga/desliga) para a página esconder as perguntas sem expor ai_support.
    (fields as { checkout: Record<string, unknown> }).checkout = { ...fields.checkout, ai_enabled: fields.ai_support?.enabled !== false };
    const { data: clash } = await supabaseAdmin.from("store_settings").select("id").eq("slug", fields.slug).maybeSingle();
    if (clash && clash.id !== id) return { ok: false as const, error: "Já existe uma loja com esse endereço." };
    if (id) {
      const { error } = await supabaseAdmin.from("store_settings").update(fields as never).eq("id", id);
      if (error) return { ok: false as const, error: "Não foi possível salvar a loja." };
      return { ok: true as const, id };
    }
    const { data: created, error } = await supabaseAdmin.from("store_settings").insert(fields as never).select("id").single();
    if (error || !created) return { ok: false as const, error: "Não foi possível criar a loja." };
    return { ok: true as const, id: created.id as string };
  });

export const createStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ name: z.string().trim().min(2).max(80) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const base = data.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "loja";
    let slug = base;
    for (let i = 2; i < 100; i += 1) {
      const { data: exists } = await supabaseAdmin.from("store_settings").select("id").eq("slug", slug).maybeSingle();
      if (!exists) break;
      slug = `${base}-${i}`;
    }
    const { data: created, error } = await supabaseAdmin
      .from("store_settings")
      .insert({ name: data.name, slug, active: false, is_default: false } as never)
      .select("id")
      .single();
    if (error || !created) return { ok: false as const, error: "Não foi possível criar a loja." };
    return { ok: true as const, id: created.id as string };
  });

export const duplicateStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: source } = await supabaseAdmin.from("store_settings").select("*").eq("id", data.id).maybeSingle();
    if (!source) return { ok: false as const, error: "Loja não encontrada." };
    const { id: _i, created_at: _c, updated_at: _u, ...rest } = source as Record<string, unknown>;
    const base = String(source.slug).replace(/-copia(-\d+)?$/, "");
    let slug = `${base}-copia`;
    for (let i = 2; i < 100; i += 1) {
      const { data: exists } = await supabaseAdmin.from("store_settings").select("id").eq("slug", slug).maybeSingle();
      if (!exists) break;
      slug = `${base}-copia-${i}`;
    }
    const { data: created, error } = await supabaseAdmin
      .from("store_settings")
      .insert({ ...rest, slug, name: `${source.name} (cópia)`, is_default: false, active: false, featured_product_ids: [] } as never)
      .select("id")
      .single();
    if (error || !created) return { ok: false as const, error: "Não foi possível duplicar a loja." };
    return { ok: true as const, id: created.id as string };
  });

export const deleteStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: store } = await supabaseAdmin.from("store_settings").select("is_default").eq("id", data.id).maybeSingle();
    if (!store) return { ok: false as const, error: "Loja não encontrada." };
    if (store.is_default) return { ok: false as const, error: "A loja principal não pode ser excluída." };
    const [{ count: products }, { count: orders }] = await Promise.all([
      supabaseAdmin.from("products").select("id", { count: "exact", head: true }).eq("store_id", data.id),
      supabaseAdmin.from("orders").select("id", { count: "exact", head: true }).eq("store_id", data.id),
    ]);
    if ((products ?? 0) > 0) return { ok: false as const, error: "Mova ou exclua os produtos desta loja antes de excluí-la." };
    if ((orders ?? 0) > 0) return { ok: false as const, error: "Esta loja tem pedidos registrados e não pode ser excluída. Desative-a." };
    const { error } = await supabaseAdmin.from("store_settings").delete().eq("id", data.id);
    if (error) return { ok: false as const, error: "Não foi possível excluir a loja." };
    return { ok: true as const };
  });

/** Edita, oculta ou exclui (review null) uma avaliação pelo índice. */
export const updateReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      productId: z.string().uuid(),
      index: z.number().int().min(0),
      review: z.lazy(() => reviewSchema).nullable(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin.from("products").select("reviews").eq("id", data.productId).maybeSingle();
    if (!p) return { ok: false as const, error: "Produto não encontrado." };
    const reviews = Array.isArray(p.reviews) ? [...(p.reviews as unknown[])] : [];
    if (data.index >= reviews.length) return { ok: false as const, error: "Avaliação não encontrada." };
    if (data.review) reviews[data.index] = data.review;
    else reviews.splice(data.index, 1);
    const { error } = await supabaseAdmin.from("products").update({ reviews } as never).eq("id", data.productId);
    if (error) return { ok: false as const, error: "Não foi possível salvar a avaliação." };
    return { ok: true as const };
  });

// ---------------- Gestão completa de produtos ----------------

/** Texto opcional: aceita ausente/null/"" e devolve sempre string. */
const optStr = (max: number) => z.string().trim().max(max).nullish().transform((v) => v ?? "");
const optBool = z.boolean().nullish().transform((v) => v ?? undefined);
const strList = (max: number, count: number) =>
  z
    .array(z.string().nullish())
    .nullish()
    .transform((a) => (a ?? []).map((s) => (s ?? "").trim()).filter(Boolean).map((s) => s.slice(0, max)).slice(0, count));

const mediaSchema = z.object({
  type: z.enum(["image", "video"]),
  url: z.string().min(1).max(2000),
  poster: z.string().max(2000).nullable().optional(),
  alt: z.string().max(300).nullable().optional(),
});

const protectionSchema = z
  .object({
    title: optStr(120),
    subtitle: optStr(220),
    items: strList(180, 12),
  })
  .nullish()
  .transform((v) => v ?? { title: "", subtitle: "", items: [] });
const creatorVideoSchema = z.object({
  handle: optStr(80),
  thumb: optStr(2000),
  video: z.string().trim().max(2000).nullish().transform((v) => v || null),
  name: optStr(80),
  title: optStr(80),
  description: optStr(300),
  rating: z.number().min(1).max(5).nullish().transform((v) => v ?? null),
  show_name: optBool,
  show_handle: optBool,
  show_title: optBool,
  show_stars: optBool,
  avatar: optStr(2000),
  show_avatar: optBool,
  verified: optBool,
  show_rating_number: optBool,
  show_description: optBool,
});
const sectionsSchema = z
  .object({
    videos_subtitle: optStr(200),
    videos_title: optStr(120),
    videos_count: optStr(30),
    videos_show_count: optBool,
    videos_show_more: optBool,
    videos_more_text: optStr(40),
    videos_show_icon: optBool,
    videos_show_hint: optBool,
    videos_hint_text: optStr(40),
    videos_card_style: z.enum(["overlay", "below"]).nullish().transform((v) => v ?? undefined),
    about_title: optStr(120),
    reviews_page_size: z.number().int().min(1).max(20).nullish().transform((v) => v ?? undefined),
    description_title: optStr(120),
    qa_enabled: optBool,
    qa_title: optStr(120),
    qa_subtitle: optStr(200),
    qa_placeholder: optStr(120),
    qa_ai_info: optStr(4000),
    popup_mode: z.enum(["store", "on", "off"]).nullish().transform((v) => v ?? undefined),
    exit_offer_mode: z.enum(["store", "on", "off"]).nullish().transform((v) => v ?? undefined),
    exit_offer: z.object({
        enabled: z.boolean().optional(),
        style: z.enum(["default", "aggressive"]).optional(),
        badge: z.string().trim().max(60).optional(),
        title: z.string().trim().max(120).optional(),
        text: z.string().trim().max(600).optional(),
        timer_enabled: z.boolean().optional(),
        timer_minutes: z.number().min(1).max(120).optional(),
        timer_text: z.string().trim().max(120).optional(),
        discount_type: z.enum(["percent", "fixed"]).optional(),
        discount_value: z.number().min(0).max(100000).optional(),
        button_text: z.string().trim().max(80).optional(),
        decline_text: z.string().trim().max(120).optional(),
    }).partial().optional(),
  })
  .nullish()
  .transform((v) => v ?? {});
const reviewSchema = z.object({
  name: z.string().trim().min(1).max(100),
  rating: z.number().min(1).max(5),
  date: optStr(80),
  text: z.string().trim().min(1).max(3000),
  confirmed: optBool,
  hidden: optBool,
  photos: strList(2000, 20),
  avatar: z.string().trim().max(2000).nullish().transform((v) => v || null),
});
const descriptionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), text: z.string().trim().min(1).max(300) }),
  z.object({ type: z.literal("subheading"), text: z.string().trim().min(1).max(300) }),
  z.object({ type: z.literal("paragraph"), text: z.string().trim().min(1).max(5000) }),
  z.object({ type: z.literal("spacer"), size: z.enum(["sm", "md", "lg"]).nullish().transform((v) => v ?? "md") }),
  z.object({ type: z.literal("list"), items: strList(500, 30) }),
  z.object({ type: z.literal("image"), url: z.string().trim().min(1).max(2000), alt: optStr(300), caption: optStr(300) }),
  z.object({ type: z.literal("video"), url: z.string().trim().min(1).max(2000), poster: optStr(2000) }),
]);

const FIELD_LABELS: Record<string, string> = {
  name: "o nome do produto",
  title: "o título do produto",
  slug: "o endereço (slug) do produto",
  price: "o preço atual",
  previous_price: "o preço anterior",
  stock: "o estoque",
  rating: "a nota",
  reviews_count: "a quantidade de avaliações",
  sold_count: "a quantidade de vendidos",
  media: "as imagens",
  specs: "as especificações",
  creator_videos: "os vídeos de criadores",
  reviews: "as avaliações",
  description: "a descrição",
  variants: "as variações do produto",
  variant_combos: "as combinações de variações",
  display: "os textos e métricas exibidas",



};

/** Converte erro de validação em mensagem legível (nunca JSON técnico). */
function friendlyParse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.output<T> {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const issue = r.error.issues[0];
  const key = String(issue?.path[0] ?? "");
  const idx = typeof issue?.path[1] === "number" ? ` (item ${(issue.path[1] as number) + 1})` : "";
  const label = FIELD_LABELS[key] ?? "os campos obrigatórios";
  throw new Error(`Revise ${label}${idx} antes de salvar.`);
}

const variantGroupSchema = z.object({
  name: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(40),
  use_image: z.boolean().optional().default(false),
  options: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(60),
        value: z.string().trim().min(1).max(60),
        image: optStr(2000),
      }),
    )
    .max(60),
});

const variantComboSchema = z.object({
  key: z.string().trim().min(1).max(400),
  price: z.number().min(0).nullable().optional(),
  previous_price: z.number().min(0).nullable().optional(),
  stock: z.number().int().min(0).nullable().optional(),
  sku: optStr(80),
  active: z.boolean().optional().default(true),
});

/** Textos e métricas exibidas na página do produto, popup e checkout. */
const displaySchema = z
  .object({
    rating_source: z.enum(["auto", "manual"]).optional(),
    rating: z.number().min(0).max(5).nullish(),
    reviews_source: z.enum(["auto", "manual"]).optional(),
    reviews_count: z.number().int().min(0).nullish(),
    reviews_label: optStr(40),
    sold_source: z.enum(["auto", "manual"]).optional(),
    sold_count: z.number().int().min(0).nullish(),
    sold_label: optStr(40),
    badge1_show: z.boolean().optional(),
    badge1_text: optStr(60),
    badge2_show: z.boolean().optional(),
    badge2_text: optStr(60),
    rs_title: optStr(80),
    rs_source: z.enum(["auto", "manual"]).optional(),
    rs_count: z.number().int().min(0).nullish(),
    rs_rating: z.number().min(0).max(5).nullish(),
    rs_max: optStr(10),
  })
  .default(() => ({}) as never);

const detailsInput = z.object({

  id: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  title: z.string().trim().min(2).max(300),
  subtitle: z.string().trim().max(300).nullable(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífens."),
  price: z.number().positive(),
  previous_price: z.number().positive(),
  stock: z.number().int().min(0),
  active: z.boolean(),
  warranty: z.string().trim().max(300).nullable(),
  rating: z.number().min(0).max(5),
  reviews_count: z.number().int().min(0),
  sold_count: z.number().int().min(0),
  media: z.array(mediaSchema).max(20),
  specs: z.array(z.object({ label: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(300) })).max(40),
  protection: protectionSchema,
  creator_videos: z.array(creatorVideoSchema).max(7),
  reviews: z.array(reviewSchema).max(1000),
  description: z.array(descriptionSchema).max(120),
  sections: sectionsSchema,
  variants: z.array(variantGroupSchema).max(8),
  variant_combos: z.array(variantComboSchema).max(400),
  display: displaySchema,

});

export const getAdminProduct = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin
      .from("products")
      .select("id, slug, name, title, subtitle, price, previous_price, stock, active, warranty, rating, reviews_count, sold_count, media, specs, protection, creator_videos, reviews, description, sections, variants, variant_combos, display, offer")
      .eq("id", data.id)
      .maybeSingle();
    if (!p) throw new Error("Produto não encontrado.");
    return {
      ...p,
      price: Number(p.price),
      previous_price: Number(p.previous_price),
      media: (p.media ?? []) as z.infer<typeof mediaSchema>[],
      specs: (p.specs ?? []) as { label: string; value: string }[],
      protection: (p.protection ?? {}) as import("@/lib/product-types").Protection,
      creator_videos: (p.creator_videos ?? []) as import("@/lib/product-types").CreatorVideo[],
      reviews: (p.reviews ?? []) as import("@/lib/product-types").Review[],
      description: (p.description ?? []) as import("@/lib/product-types").DescriptionBlock[],
      sections: (p.sections ?? {}) as import("@/lib/product-types").ProductSections,
      variants: (p.variants ?? []) as import("@/lib/product-types").VariantGroup[],
      variant_combos: (p.variant_combos ?? []) as import("@/lib/product-types").VariantCombo[],
      display: (p.display ?? {}) as import("@/lib/product-types").ProductDisplay,
      offer: (p.offer ?? {}) as import("@/lib/product-types").Offer,

    };
  });

export const saveProductDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => friendlyParse(detailsInput, data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    if (data.previous_price < data.price)
      return { ok: false as const, error: "O preço anterior deve ser maior ou igual ao preço atual." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: clash } = await supabaseAdmin
      .from("products")
      .select("id")
      .eq("slug", data.slug)
      .neq("id", data.id)
      .maybeSingle();
    if (clash) return { ok: false as const, error: "Já existe outro produto com esse endereço (slug)." };
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin.from("products").update(patch as never).eq("id", id);
    if (error) return { ok: false as const, error: "Não foi possível salvar o produto." };
    return { ok: true as const };
  });

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "produto";
}

/** Cria um produto novo já no template (frete, proteção e termos herdados da loja), sem copiar conteúdo. */
export const createBlankProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ name: z.string().trim().min(2).max(160), price: z.number().positive(), stock: z.number().int().min(0), store_id: z.string().uuid().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: defaultStore } = await supabaseAdmin.from("store_settings").select("id").eq("is_default", true).maybeSingle();
    const { data: template } = await supabaseAdmin
      .from("products")
      .select("offer, shipping, protection, terms, warranty, sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const base = slugify(data.name);
    let slug = base;
    for (let i = 2; i < 100; i += 1) {
      const { data: exists } = await supabaseAdmin.from("products").select("id").eq("slug", slug).maybeSingle();
      if (!exists) break;
      slug = `${base}-${i}`;
    }
    const { data: created, error } = await supabaseAdmin
      .from("products")
      .insert({
        slug,
        store_id: data.store_id ?? defaultStore?.id ?? null,
        name: data.name,
        title: data.name,
        price: data.price,
        previous_price: data.price,
        stock: data.stock,
        active: false,
        rating: 5,
        reviews_count: 0,
        sold_count: 0,
        offer: template?.offer ?? {},
        shipping: template?.shipping ?? {},
        protection: template?.protection ?? {},
        terms: template?.terms ?? null,
        warranty: template?.warranty ?? null,
        media: [],
        variants: [],
        specs: [],
        description: [],
        creator_videos: [],
        reviews: [],
        sort_order: Number(template?.sort_order ?? 0) + 1,
      } as never)
      .select("id, slug")
      .single();
    if (error || !created) return { ok: false as const, error: "Não foi possível criar o produto." };
    return { ok: true as const, id: created.id as string, slug: created.slug as string };
  });

/** Ajuste em massa: aplica mudança de preço (%) e/ou estoque/ativação a vários produtos de uma vez. */
export const bulkUpdateProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(200),
        price_percent: z.number().min(-90).max(500).nullable(),
        stock: z.number().int().min(0).nullable(),
        stock_add: z.number().int().min(-100000).max(100000).nullable(),
        active: z.boolean().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin.from("products").select("id, price, previous_price, stock").in("id", data.ids);
    let updated = 0;
    for (const r of rows ?? []) {
      const patch: Record<string, unknown> = {};
      if (data.price_percent !== null) {
        const np = Math.round(Number(r.price) * (1 + data.price_percent / 100) * 100) / 100;
        if (np <= 0) continue;
        patch["price"] = np;
        if (Number(r.previous_price) < np) patch["previous_price"] = np;
      }
      if (data.stock !== null) patch["stock"] = data.stock;
      else if (data.stock_add !== null) patch["stock"] = Math.max(0, Number(r.stock) + data.stock_add);
      if (data.active !== null) patch["active"] = data.active;
      if (!Object.keys(patch).length) continue;
      const { error } = await supabaseAdmin.from("products").update(patch as never).eq("id", r.id);
      if (!error) updated += 1;
    }
    return { ok: true as const, updated };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("orders").select("id", { count: "exact", head: true }).eq("product_id", data.id);
    if (count) return { ok: false as const, error: "Produto tem pedidos registrados — desative-o em vez de excluir." };
    const { error } = await supabaseAdmin.from("products").delete().eq("id", data.id);
    if (error) return { ok: false as const, error: "Não foi possível excluir o produto." };
    return { ok: true as const };
  });

/** Recebe a imagem em base64, grava no armazenamento privado e devolve um link assinado de longa duração. */
export const uploadProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        filename: z.string().min(1).max(200),
        contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif", "image/x-icon", "image/vnd.microsoft.icon"]),
        base64: z.string().min(10).max(11_000_000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const ext = data.contentType.includes("icon") ? "ico" : data.contentType.split("/")[1];
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from("product-images")
      .upload(path, bytes, { contentType: data.contentType, upsert: false });
    if (error) return { ok: false as const, error: "Falha ao enviar a imagem." };
    const { data: signed } = await supabaseAdmin.storage
      .from("product-images")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (!signed?.signedUrl) return { ok: false as const, error: "Falha ao gerar o link da imagem." };
    return { ok: true as const, url: signed.signedUrl };
  });

/** Upload direto do navegador (vídeos grandes): o servidor só autoriza e assina. */
const mediaTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "video/mp4", "video/webm", "video/quicktime"] as const;
export const createMediaUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ filename: z.string().min(1).max(200), contentType: z.enum(mediaTypes) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ext = (data.filename.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
    const path = `uploads/${crypto.randomUUID()}.${ext}`;
    const { data: signed, error } = await supabaseAdmin.storage.from("product-images").createSignedUploadUrl(path);
    if (error || !signed) return { ok: false as const, error: "Não foi possível preparar o envio." };
    return { ok: true as const, path, token: signed.token };
  });

export const finalizeMediaUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ path: z.string().regex(/^uploads\/[a-f0-9-]+\.[a-z0-9]+$/) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage.from("product-images").createSignedUrl(data.path, 60 * 60 * 24 * 365 * 10);
    if (error || !signed) return { ok: false as const, error: "Arquivo não encontrado após o envio." };
    return { ok: true as const, url: `/api/public/media/${data.path}` };
  });

export const listAdminOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      store_id: z.string().uuid().or(z.literal("")).default(""),
      status: z.string().max(40).default(""),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    // Datas no fuso de Brasília (UTC-3).
    let q = context.supabase
      .from("orders")
      .select("order_number, status, total, quantity, customer, product_snapshot, created_at, paid_at, store_id, payment_provider, provider_status")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (data.store_id) q = q.eq("store_id", data.store_id);
    if (data.status) q = q.eq("status", data.status);
    if (data.from) q = q.gte("created_at", `${data.from}T00:00:00-03:00`);
    if (data.to) q = q.lte("created_at", `${data.to}T23:59:59.999-03:00`);
    const { data: rows, error } = await q;
    if (error) throw new Error("Não foi possível carregar os pedidos.");
    return (rows ?? []).map((o: any) => ({
      order_number: o.order_number as string,
      status: o.status as string,
      total: Number(o.total),
      quantity: o.quantity as number,
      created_at: o.created_at as string,
      paid_at: (o.paid_at as string | null) ?? null,
      store_id: (o.store_id as string | null) ?? null,
      provider_status: (o.provider_status as string | null) ?? null,
      customer_name: String((o.customer ?? {}).name ?? ""),
      customer_email: String((o.customer ?? {}).email ?? ""),
      product_title: String((o.product_snapshot ?? {}).title ?? ""),
    }));
  });

/** Importação de avaliações: baixa imagens de URLs externas para o armazenamento próprio. */
export const importReviewImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ urls: z.array(z.string().trim().url().max(2000)).min(1).max(30) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const types: Record<string, string> = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
    const results: Record<string, { ok: true; url: string } | { ok: false; error: string }> = {};
    await Promise.all(
      [...new Set(data.urls)].map(async (src) => {
        try {
          if (!/^https?:\/\//i.test(src)) throw new Error("URL inválida");
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 15000);
          const res = await fetch(src, { signal: ctrl.signal, redirect: "follow" }).finally(() => clearTimeout(timer));
          if (!res.ok) throw new Error(`Imagem não encontrada (HTTP ${res.status})`);
          const ct = (res.headers.get("content-type") || "").split(";")[0]!.trim().toLowerCase();
          const ext = types[ct];
          if (!ext) throw new Error("O link não é uma imagem JPG, PNG, WEBP ou GIF");
          const buf = new Uint8Array(await res.arrayBuffer());
          if (buf.byteLength > 10 * 1024 * 1024) throw new Error("Imagem maior que 10 MB");
          const path = `uploads/${crypto.randomUUID()}.${ext}`;
          const { error } = await supabaseAdmin.storage.from("product-images").upload(path, buf, { contentType: ct === "image/jpg" ? "image/jpeg" : ct, upsert: false });
          if (error) throw new Error("Falha ao salvar a imagem");
          results[src] = { ok: true, url: `/api/public/media/${path}` };
        } catch (err) {
          results[src] = { ok: false, error: err instanceof Error && err.name !== "AbortError" ? err.message : "Tempo esgotado ao baixar a imagem" };
        }
      }),
    );
    return { results };
  });

export type PixRecoveryMetrics = { store_id: string; name: string; notices: number; copies: number; chats: number; renewed: number; recovered: number; recovered_total: number };

/** Métricas da recuperação de PIX por loja (avisos, cópias, chats, novas cobranças e pagamentos recuperados). */
export const pixRecoveryMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PixRecoveryMetrics[]> => {
    await assertAdmin(context);
    const sb = context.supabase;
    const [{ data: stores }, { data: events }] = await Promise.all([
      sb.from("store_settings").select("id, name").order("created_at"),
      sb.from("pix_recovery_events").select("store_id, order_id, event_type").limit(20000),
    ]);
    const ids = [...new Set((events ?? []).map((e: any) => e.order_id as string))];
    const paid = new Map<string, number>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data: rows } = await sb.from("orders").select("id, total, status").in("id", ids.slice(i, i + 200)).in("status", ["pago", "aprovado"]);
      for (const r of rows ?? []) paid.set(r.id as string, Number(r.total));
    }
    return (stores ?? []).map((s: any) => {
      const ev = (events ?? []).filter((e: any) => e.store_id === s.id);
      const n = (t: string) => ev.filter((e: any) => e.event_type === t).length;
      const rec = [...new Set(ev.map((e: any) => e.order_id as string))].filter((id) => paid.has(id));
      return { store_id: s.id, name: s.name, notices: n("notice_shown"), copies: n("code_copied"), chats: n("chat_opened"), renewed: n("renewed"), recovered: rec.length, recovered_total: rec.reduce((t, id) => t + (paid.get(id) ?? 0), 0) };
    });
  });
