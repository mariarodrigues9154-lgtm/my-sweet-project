import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !data) throw new Error("Acesso restrito ao administrador.");
}

const mask = (v: string | null) => (v ? `•••••${v.slice(-4)}` : "");

/** Configuração pública do Pixel da loja (apenas o que o navegador precisa). */
export const getStorePixel = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ store_id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { loadMetaSettings } = await import("./meta.server");
    const row = await loadMetaSettings(data.store_id);
    if (!row || !row.enabled || !row.pixel_id) return null;
    return { pixel_id: row.pixel_id, track_pending: row.track_pending };
  });

export const getStoreMetaSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ store_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { loadMetaSettings, activeTestCode } = await import("./meta.server");
    const row = await loadMetaSettings(data.store_id);
    return {
      enabled: row?.enabled ?? false,
      pixel_id: row?.pixel_id ?? "",
      pixel_masked: mask(row?.pixel_id ?? null),
      track_pending: row?.track_pending ?? true,
      capi_configured: Boolean(row?.capi_token),
      capi_masked: row?.capi_token ? "••••••••••••" : "",
      test_event_code: row && activeTestCode(row) ? row.test_event_code ?? "" : "",
    };
  });

export const saveStoreMetaSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      store_id: z.string().uuid(),
      enabled: z.boolean(),
      pixel_id: z.string().trim().regex(/^\d{0,20}$/, "O Pixel ID deve conter apenas números."),
      track_pending: z.boolean(),
      capi_token: z.string().trim().max(600).default(""),
      remove_capi_token: z.boolean().default(false),
      test_event_code: z.string().trim().max(40).default(""),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    if (data.enabled && data.pixel_id.length < 10) return { ok: false as const, error: "Informe um Pixel ID válido antes de ativar." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadMetaSettings } = await import("./meta.server");
    const current = await loadMetaSettings(data.store_id);
    const token = data.remove_capi_token ? null : data.capi_token || current?.capi_token || null;
    const testChanged = (current?.test_event_code ?? "") !== data.test_event_code;
    const { error } = await supabaseAdmin.from("store_meta_settings" as never).upsert(
      {
        store_id: data.store_id,
        enabled: data.enabled,
        pixel_id: data.pixel_id || null,
        track_pending: data.track_pending,
        capi_token: token,
        test_event_code: data.test_event_code || null,
        test_event_code_set_at: data.test_event_code ? (testChanged ? new Date().toISOString() : current?.test_event_code_set_at ?? new Date().toISOString()) : null,
      } as never,
      { onConflict: "store_id" },
    );
    if (error) return { ok: false as const, error: "Não foi possível salvar o Meta Pixel." };
    return { ok: true as const };
  });

/** Valida a configuração sem enviar compra: formato do Pixel e acesso do token ao Pixel. */
export const testStoreMetaPixel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ store_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { loadMetaSettings } = await import("./meta.server");
    const row = await loadMetaSettings(data.store_id);
    if (!row?.pixel_id) return { ok: false as const, message: "Salve um Pixel ID primeiro." };
    if (!row.enabled) return { ok: false as const, message: "O Pixel está salvo, mas desativado." };
    if (!row.capi_token) return { ok: true as const, message: "Pixel pronto no navegador. Conversions API não configurada." };
    // Token da CAPI só tem permissão para enviar eventos: valida com um POST marcado como teste
    // (aparece apenas em "Eventos de teste", nunca conta como evento real).
    const testCode = row.test_event_code?.trim() || "TEST_CONEXAO";
    const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(row.pixel_id)}/events?access_token=${encodeURIComponent(row.capi_token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        test_event_code: testCode,
        data: [{ event_name: "PageView", event_time: Math.floor(Date.now() / 1000), event_id: `conn_${Date.now()}`, action_source: "website", user_data: { external_id: ["teste_conexao"], client_user_agent: "painel-teste" } }],
      }),
    });
    const { logMetaEvent } = await import("./meta.server");
    if (res.ok) {
      await logMetaEvent({ store_id: data.store_id, event_name: "Teste de conexão", ok: true, http_status: res.status, source: "painel" });
      return { ok: true as const, message: "Pixel e Conversions API prontos. A Meta aceitou o token." };
    }
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    await logMetaEvent({ store_id: data.store_id, event_name: "Teste de conexão", ok: false, http_status: res.status, error: body.error?.message ?? "sem detalhes", source: "painel" });
    return { ok: false as const, message: `A Meta recusou o token [${res.status}]: ${body.error?.message ?? "sem detalhes"}` };
  });

export const listMetaEventLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ store_id: z.string().uuid(), only_failures: z.boolean().default(false) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    let q = context.supabase.from("meta_event_logs").select("id, event_name, event_id, order_number, source, ok, http_status, error, test_mode, created_at").eq("store_id", data.store_id).order("created_at", { ascending: false }).limit(100);
    if (data.only_failures) q = q.eq("ok", false);
    const { data: rows, error } = await q;
    if (error) throw new Error("Não foi possível carregar o histórico.");
    return (rows ?? []) as Array<{ id: string; event_name: string; event_id: string | null; order_number: string | null; source: string; ok: boolean; http_status: number | null; error: string | null; test_mode: boolean; created_at: string }>;
  });

/** Modo de teste: envia eventos de exemplo com o Test Event Code (aparecem só em "Eventos de teste" da Meta). */
export const sendMetaTestEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ store_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { loadMetaSettings, activeTestCode, sendCapiEvent } = await import("./meta.server");
    const row = await loadMetaSettings(data.store_id);
    if (!row?.pixel_id) return { ok: false as const, results: [], message: "Salve um Pixel ID primeiro." };
    if (!row.capi_token) return { ok: false as const, results: [], message: "Salve o Access Token da Conversions API para usar o modo de teste." };
    if (!activeTestCode(row)) return { ok: false as const, results: [], message: "Cole o Test Event Code da Meta e clique em Salvar antes de testar." };
    const now = Math.floor(Date.now() / 1000);
    const stamp = Date.now();
    const custom = { currency: "BRL", value: 1, content_ids: ["teste"], content_type: "product", content_name: "Produto de teste" };
    const names = ["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "Purchase"];
    const results: Array<{ event: string; ok: boolean; error?: string }> = [];
    for (const name of names) {
      const r = await sendCapiEvent({ ...row, enabled: true }, {
        event_name: name, event_time: now, event_id: `test_${name}_${stamp}`, action_source: "website",
        user_data: { external_id: [`teste_${stamp}`], client_user_agent: "painel-teste" },
        ...(name === "PageView" ? {} : { custom_data: name === "Purchase" ? { ...custom, order_id: `TESTE-${stamp}` } : custom }),
      }, { store_id: data.store_id });
      results.push({ event: name, ok: r.ok, ...(r.error ? { error: r.error } : {}) });
    }
    const ok = results.every((r) => r.ok);
    return { ok, results, message: ok ? "Os 5 eventos de teste foram aceitos pela Meta. Confira em Gerenciador de Eventos → Eventos de teste." : "Alguns eventos foram recusados pela Meta. Veja os detalhes abaixo." };
  });
