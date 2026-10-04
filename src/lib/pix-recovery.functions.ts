import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { resolvePixRecovery, type ResolvedPixRecovery } from "./product-types";

// Token de acesso do pedido: hex de 48 caracteres (banco) ou UUID (pedidos antigos).
const Token = z.string().regex(/^[0-9a-fA-F-]{32,64}$/);

export type PixOrderState = "pendente" | "pago" | "expirado" | "outro";

export type PixOrderView = {
  token: string;
  order_number: string;
  state: PixOrderState;
  store: { id: string; name: string; logo_url: string | null; avatar_url: string | null; pix: ResolvedPixRecovery };
  product: { title: string; image: string | null; slug: string | null };
  quantity: number;
  total: number;
  copy_paste: string | null;
  qr_code: string | null;
  expires_at: string | null;
  created_at: string;
};

/**
 * Recupera pedidos PIX lembrados no navegador pelo token de acesso do pedido.
 * Nunca cria cobrança: apenas devolve o PIX já salvo e reconfirma o status no provedor.
 * Não devolve dados do cliente (nome, CPF, endereço).
 */
export const getPixOrders = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ tokens: z.array(Token).max(10) }).parse(data))
  .handler(async ({ data }): Promise<PixOrderView[]> => {
    if (!data.tokens.length) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("orders")
      .select("access_token, order_number, status, store_id, product_snapshot, quantity, total, payment, transaction_id, pix_expiration_date, created_at")
      .in("access_token", data.tokens);
    if (!rows?.length) return [];

    const storeIds = [...new Set(rows.map((r) => r.store_id).filter(Boolean))] as string[];
    const { data: stores } = storeIds.length
      ? await supabaseAdmin.from("store_settings").select("id, name, logo_url, avatar_url, checkout").in("id", storeIds)
      : { data: [] };
    const { stableMediaUrl } = await import("./media-url");
    const { checkOrderPaymentStatus } = await import("@/lib/payments/order-status.server");

    const out: PixOrderView[] = [];
    for (const r of rows) {
      if (!r.store_id || !r.transaction_id) continue;
      const pay = (r.payment ?? {}) as { copy_paste?: string; qr_code?: string; expiration_date?: string };
      const expiresAt = (r.pix_expiration_date as string | null) ?? pay.expiration_date ?? null;
      let status = r.status as string;
      const expired = !!expiresAt && new Date(expiresAt).getTime() <= Date.now();
      // Confirmação real no provedor (mesma rotina do checkout); nunca por ação do cliente.
      if (status === "aguardando_pagamento" && !expired) {
        try { status = (await checkOrderPaymentStatus(r.order_number as string)).status; } catch { /* mantém */ }
      }
      const state: PixOrderState =
        status === "pago" || status === "aprovado" ? "pago" : status === "aguardando_pagamento" ? (expired ? "expirado" : "pendente") : "outro";
      const s = stores?.find((x) => x.id === r.store_id);
      const pix = resolvePixRecovery(((s?.checkout ?? {}) as { pix_recovery?: unknown }).pix_recovery);
      // Loja com a recuperação desligada: nada aparece na loja (pedido continua salvo).
      if (!pix.enabled) continue;
      const snap = (r.product_snapshot ?? {}) as { title?: string; image?: string | null; slug?: string };
      out.push({
        token: r.access_token as string,
        order_number: r.order_number as string,
        state,
        store: { id: r.store_id as string, name: (s?.name as string) ?? "Loja", logo_url: (s?.logo_url as string | null) ?? null, avatar_url: (s?.avatar_url as string | null) ?? null, pix },
        product: { title: snap.title ?? "", image: snap.image ? stableMediaUrl(snap.image) : null, slug: snap.slug ?? null },
        quantity: Number(r.quantity ?? 1),
        total: Number(r.total),
        copy_paste: state === "pendente" ? pay.copy_paste ?? null : null,
        qr_code: state === "pendente" ? pay.qr_code ?? null : null,
        expires_at: expiresAt,
        created_at: r.created_at as string,
      });
    }
    return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
  });

/**
 * Pedidos PIX criados antes do token de acesso: o checkout já guardava o número do
 * último pedido no navegador. Devolve o token apenas se o pedido ainda tem PIX gerado,
 * para que passe a aparecer no aviso e no chat. Nenhum dado pessoal é retornado.
 */
export const claimLegacyPixOrders = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ order_numbers: z.array(z.string().min(4).max(40)).max(5) }).parse(data))
  .handler(async ({ data }): Promise<Array<{ token: string; store_id: string }>> => {
    if (!data.order_numbers.length) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("orders")
      .select("access_token, store_id, transaction_id")
      .in("order_number", data.order_numbers)
      .gte("created_at", since);
    return (rows ?? [])
      .filter((r) => r.store_id && r.transaction_id && r.access_token)
      .map((r) => ({ token: r.access_token as string, store_id: r.store_id as string }));
  });

/**
 * Gera um novo pedido + PIX a partir de um pedido expirado, com o mesmo produto,
 * variação, quantidade, cliente e endereço. Preço e frete são recalculados no servidor.
 */
export const renewExpiredPixOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ token: Token }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: o } = await supabaseAdmin
      .from("orders")
      .select("status, store_id, product_snapshot, variant, quantity, shipping_label, customer, address, payment, pix_expiration_date")
      .eq("access_token", data.token)
      .maybeSingle();
    if (!o) return { ok: false as const, error: "Pedido não encontrado." };
    const pay = (o.payment ?? {}) as { expiration_date?: string };
    const exp = (o.pix_expiration_date as string | null) ?? pay.expiration_date ?? null;
    const expired = o.status === "aguardando_pagamento" && !!exp && new Date(exp).getTime() <= Date.now();
    if (!expired) return { ok: false as const, error: "Este pedido não está expirado." };

    const slug = ((o.product_snapshot ?? {}) as { slug?: string }).slug;
    if (!slug) return { ok: false as const, error: "Produto indisponível." };
    const { SHIPPING } = await import("./shipping");
    const option = { id: SHIPPING.id };

    const { createOrder, createPixCharge } = await import("./store.functions");
    const created = await createOrder({
      data: {
        slug,
        quantity: Number(o.quantity ?? 1),
        variant: (o.variant ?? {}) as Record<string, string>,
        shipping_id: option.id,
        customer: o.customer as never,
        address: o.address as never,
      },
    }).catch(() => null);
    if (!created || !created.ok) return { ok: false as const, error: created && !created.ok ? created.error : "Não foi possível criar o novo pedido." };
    const charge = await createPixCharge({ data: { order_number: created.order_number } }).catch(() => null);
    if (!charge || !(charge as { ok?: boolean }).ok) return { ok: false as const, error: "Não foi possível gerar o novo PIX. Tente novamente." };
    const { data: newOrder } = await supabaseAdmin.from("orders").select("id").eq("order_number", created.order_number).maybeSingle();
    if (newOrder && o.store_id) await supabaseAdmin.from("pix_recovery_events").insert({ store_id: o.store_id as string, order_id: newOrder.id, event_type: "renewed" });
    return { ok: true as const, token: created.access_token, store_id: o.store_id as string, order_number: created.order_number };
  });

/** Registra um evento da recuperação de PIX (métricas por loja). Só aceita pedidos reais via token. */
export const trackPixRecoveryEvent = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ token: Token, event: z.enum(["notice_shown", "code_copied", "chat_opened"]) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: o } = await supabaseAdmin.from("orders").select("id, store_id").eq("access_token", data.token).maybeSingle();
    if (!o?.store_id) return { ok: false };
    if (data.event === "notice_shown") {
      // Um aviso por pedido a cada 12h, para não inflar a contagem a cada página.
      const since = new Date(Date.now() - 12 * 3600000).toISOString();
      const { count } = await supabaseAdmin.from("pix_recovery_events").select("id", { count: "exact", head: true })
        .eq("order_id", o.id).eq("event_type", "notice_shown").gte("created_at", since);
      if (count) return { ok: true };
    }
    await supabaseAdmin.from("pix_recovery_events").insert({ store_id: o.store_id, order_id: o.id, event_type: data.event });
    return { ok: true };
  });
