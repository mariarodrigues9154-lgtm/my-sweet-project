/**
 * Configuração de pagamentos de cada loja. Credenciais privadas nunca são
 * devolvidas ao navegador: o painel recebe apenas a versão mascarada.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { maskSecret, providerSpec } from "@/lib/payments/catalog";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !data) throw new Error("Acesso restrito ao administrador.");
}

const providerId = z.enum(["none", "wappi", "pinpay", "mercadopago", "asaas"]);

const settingsInput = z.object({
  store_id: z.string().uuid(),
  provider: providerId,
  enabled: z.boolean(),
  environment: z.enum(["sandbox", "production"]),
  public_data: z.record(z.string(), z.string().trim().max(500)).default({}),
  /** Apenas os campos que o admin digitou agora; vazio mantém o valor salvo. */
  secret_data: z.record(z.string(), z.string().trim().max(500)).default({}),
});

type Row = {
  provider: string;
  enabled: boolean;
  environment: string;
  public_data: Record<string, string>;
  secret_data: Record<string, string>;
};

async function readRow(storeId: string): Promise<Row> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("store_payment_settings")
    .select("provider, enabled, environment, public_data, secret_data")
    .eq("store_id", storeId)
    .maybeSingle();
  if (!data) return { provider: "none", enabled: false, environment: "sandbox", public_data: {}, secret_data: {} };
  return {
    provider: data.provider as string,
    enabled: Boolean(data.enabled),
    environment: data.environment as string,
    public_data: (data.public_data ?? {}) as Record<string, string>,
    secret_data: (data.secret_data ?? {}) as Record<string, string>,
  };
}

export const getStorePaymentSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ store_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const row = await readRow(data.store_id);
    const masked: Record<string, string> = {};
    for (const [key, value] of Object.entries(row.secret_data)) {
      if (value) masked[key] = maskSecret(value);
    }
    return {
      provider: row.provider,
      enabled: row.enabled,
      environment: row.environment,
      public_data: row.public_data,
      secrets_masked: masked,
    };
  });

export const saveStorePaymentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => settingsInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const current = await readRow(data.store_id);
    const spec = providerSpec(data.provider);
    const keys = new Set(spec.fields.map((f) => f.key));

    // Trocar de provedor descarta credenciais antigas; mesma escolha preserva o que não foi redigitado.
    const base = current.provider === data.provider ? current.secret_data : {};
    const secrets: Record<string, string> = {};
    for (const field of spec.fields.filter((f) => f.secret)) {
      const typed = (data.secret_data[field.key] ?? "").trim();
      const kept = base[field.key] ?? "";
      const value = typed || kept;
      if (value) secrets[field.key] = value;
    }
    const publicData: Record<string, string> = {};
    for (const field of spec.fields.filter((f) => !f.secret)) {
      const value = (data.public_data[field.key] ?? "").trim();
      if (value) publicData[field.key] = value;
    }

    if (data.enabled && data.provider === "none") {
      return { ok: false as const, error: "Escolha um gateway antes de ativar os pagamentos." };
    }
    if (data.enabled) {
      const missing = spec.fields.filter((f) => f.required && !(f.secret ? secrets[f.key] : publicData[f.key]) && keys.has(f.key));
      if (missing.length > 0) {
        return { ok: false as const, error: "Preencha as credenciais obrigatórias antes de ativar este gateway." };
      }
    }

    const { error } = await supabaseAdmin.from("store_payment_settings").upsert(
      {
        store_id: data.store_id,
        provider: data.provider,
        enabled: data.enabled,
        environment: data.environment,
        public_data: publicData,
        secret_data: secrets,
      } as never,
      { onConflict: "store_id" },
    );
    if (error) return { ok: false as const, error: "Não foi possível salvar a configuração de pagamentos." };
    return { ok: true as const };
  });

export const testStoreGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ store_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const row = await readRow(data.store_id);
    if (row.provider === "none") return { ok: false as const, error: "Nenhum gateway selecionado." };

    const { getProvider } = await import("@/lib/payments/providers.server");
    const provider = getProvider(row.provider);
    if (!provider) return { ok: false as const, error: "Gateway não disponível." };

    try {
      const result = await provider.testConnection({
        provider: row.provider as never,
        environment: row.environment === "production" ? "production" : "sandbox",
        secrets: row.secret_data,
        publicData: row.public_data,
      });
      if (!result.ok) return { ok: false as const, error: result.error ?? "Não foi possível autenticar. Verifique suas credenciais." };
      if (result.company?.id) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: cur } = await supabaseAdmin.from("store_payment_settings").select("pix_config").eq("store_id", data.store_id).maybeSingle();
        const pixConfig = { ...((cur?.pix_config ?? {}) as Record<string, unknown>), company_id: result.company.id };
        await supabaseAdmin.from("store_payment_settings").update({ pix_config: pixConfig } as never).eq("store_id", data.store_id);
      }
      return { ok: true as const, company: { fantasy_name: result.company?.fantasy_name ?? null, status: result.company?.status ?? null } };
    } catch {
      return { ok: false as const, error: "Não foi possível falar com o provedor agora. Tente novamente." };
    }
  });
