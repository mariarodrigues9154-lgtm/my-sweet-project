import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !data) throw new Error("Acesso restrito ao administrador.");
}

/** Só aceita scripts hospedados pela própria UTMify. */
function utmifySrc(code: string): string | null {
  const m = code.match(/https:\/\/cdn\.utmify\.com\.br\/[A-Za-z0-9/_.\-]+\.js/);
  return m ? m[0] : null;
}
function pixelIdFrom(code: string): string | null {
  const m = code.match(/pixelId\s*=\s*["']([A-Za-z0-9_\-]{4,80})["']/);
  return m ? m[1]! : null;
}

/** Configuração pública: apenas os endereços dos scripts oficiais. */
export const getStoreUtmifyScripts = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ store_id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { loadUtmifySettings } = await import("./utmify.server");
    const row = await loadUtmifySettings(data.store_id);
    if (!row) return null;
    return {
      utm_script_src: row.utm_script_enabled ? row.utm_script_src : null,
      pixel_script_src: row.pixel_enabled ? row.pixel_script_src : null,
      pixel_id: row.pixel_enabled ? row.pixel_id : null,
    };
  });

export const getStoreUtmify = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ store_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { loadUtmifySettings } = await import("./utmify.server");
    const row = await loadUtmifySettings(data.store_id);
    return {
      enabled: row?.enabled ?? false,
      token_configured: Boolean(row?.api_token),
      utm_script_enabled: row?.utm_script_enabled ?? false,
      utm_script_src: row?.utm_script_src ?? "",
      pixel_enabled: row?.pixel_enabled ?? false,
      pixel_id: row?.pixel_id ?? "",
      pixel_script_src: row?.pixel_script_src ?? "",
    };
  });

export const saveStoreUtmify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    store_id: z.string().uuid(),
    enabled: z.boolean(),
    api_token: z.string().trim().max(300).default(""),
    utm_script_enabled: z.boolean(),
    utm_script_code: z.string().max(5000).default(""),
    pixel_enabled: z.boolean(),
    pixel_code: z.string().max(5000).default(""),
  }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { loadUtmifySettings } = await import("./utmify.server");
    const current = await loadUtmifySettings(data.store_id);
    const token = data.api_token || current?.api_token || null;
    if (data.enabled && !token) return { ok: false as const, error: "Informe a credencial de API da UTMify antes de ativar." };
    const utmSrc = data.utm_script_code.trim() ? utmifySrc(data.utm_script_code) : current?.utm_script_src ?? null;
    if (data.utm_script_code.trim() && !utmSrc) return { ok: false as const, error: "Não encontrei o script oficial da UTMify (cdn.utmify.com.br) no código de UTMs." };
    if (data.utm_script_enabled && !utmSrc) return { ok: false as const, error: "Cole o script de UTMs antes de ativar." };
    let pixelSrc = current?.pixel_script_src ?? null;
    let pixelId = current?.pixel_id ?? null;
    if (data.pixel_code.trim()) {
      pixelSrc = utmifySrc(data.pixel_code); pixelId = pixelIdFrom(data.pixel_code);
      if (!pixelSrc || !pixelId) return { ok: false as const, error: "Não encontrei o pixelId e o script oficial da UTMify no código do Pixel." };
    }
    if (data.pixel_enabled && (!pixelSrc || !pixelId)) return { ok: false as const, error: "Cole o código do Pixel antes de ativar." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("store_utmify_settings").upsert({
      store_id: data.store_id, enabled: data.enabled, api_token: token,
      utm_script_enabled: data.utm_script_enabled, utm_script_src: utmSrc,
      pixel_enabled: data.pixel_enabled, pixel_id: pixelId, pixel_script_src: pixelSrc, updated_at: new Date().toISOString(),
    } as never, { onConflict: "store_id" });
    if (error) return { ok: false as const, error: "Não foi possível salvar a integração UTMify." };
    return { ok: true as const };
  });

export const testStoreUtmify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ store_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { loadUtmifySettings, testUtmify } = await import("./utmify.server");
    const row = await loadUtmifySettings(data.store_id);
    if (!row?.api_token) return { ok: false, message: "Salve a credencial de API primeiro." };
    const r = await testUtmify(data.store_id, row.api_token);
    return r.ok
      ? { ok: true, message: "A UTMify aceitou o pedido de teste (não é salvo no dashboard)." }
      : { ok: false, message: `A UTMify recusou (HTTP ${r.status || "sem resposta"}): ${r.error ?? ""}`.slice(0, 300) };
  });

export const listUtmifyLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ store_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin.from("utmify_logs").select("id, order_number, status, ok, http_status, error, test_mode, created_at").eq("store_id", data.store_id).order("created_at", { ascending: false }).limit(100);
    return rows ?? [];
  });

/** Reenvia pedidos dos últimos 7 dias cujo status ainda não chegou à UTMify. */
export const resyncStoreUtmify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ store_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const { data: rows } = await supabaseAdmin.from("orders").select("id, status, utmify_sent_status, transaction_id")
      .eq("store_id", data.store_id).gte("created_at", since).in("status", ["pago", "aguardando_pagamento"]).limit(300);
    const pending = (rows ?? []).filter((r) => (r.status === "pago" && r.utmify_sent_status !== "paid") || (r.status === "aguardando_pagamento" && r.transaction_id && !r.utmify_sent_status));
    const { syncUtmifyOrder } = await import("./utmify.server");
    for (const r of pending) await syncUtmifyOrder(r.id);
    return { count: pending.length };
  });
