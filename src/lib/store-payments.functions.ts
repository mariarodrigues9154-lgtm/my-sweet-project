/** Admin-only gateway registry; returns presence markers, never saved secrets. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { providerSpec } from "@/lib/payments/catalog";
import { gatewaySettingsDto, missingGatewayFields } from "@/lib/payments/gateway-settings";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !data) throw new Error("Acesso restrito ao administrador.");
}
const providerId = z.enum(["wappi", "freepay", "pinpay", "blackcat", "invictuspay", "codefy", "umbrellapag", "westpay", "venuspay", "pixxblack", "mercadopago", "asaas"]);
const storeInput = z.object({ store_id: z.string().uuid() });
const gatewayInput = storeInput.extend({ provider: providerId });
const settingsInput = gatewayInput.extend({
  environment: z.enum(["sandbox", "production"]),
  public_data: z.record(z.string(), z.string().trim().max(500)).default({}),
  secret_data: z.record(z.string(), z.string().trim().max(500)).default({}),
});

export const getStorePaymentSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [selector, gateways] = await Promise.all([
      supabaseAdmin.from("store_payment_settings").select("provider,enabled").eq("store_id", data.store_id).maybeSingle(),
      supabaseAdmin.from("store_payment_gateways").select("provider,environment,public_data,secret_data,updated_at").eq("store_id", data.store_id).order("created_at"),
    ]);
    if (selector.error || gateways.error) throw new Error("Não foi possível carregar os gateways.");
    return { provider: selector.data?.provider ?? "none", enabled: selector.data?.enabled ?? false,
      gateways: (gateways.data ?? []).map((row) => ({ ...gatewaySettingsDto({ ...row, public_data: row.public_data as Record<string,string>, secret_data: row.secret_data as Record<string,string> }), updated_at: row.updated_at })),
    };
  });

export const saveStorePaymentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => settingsInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const spec = providerSpec(data.provider);
    const publicData = Object.fromEntries(spec.fields.filter((f) => !f.secret).map((f) => [f.key, data.public_data[f.key] ?? ""]));
    const secrets = Object.fromEntries(spec.fields.filter((f) => f.secret && data.secret_data[f.key]).map((f) => [f.key, data.secret_data[f.key] ?? ""]));
    const { loadStorePayment } = await import("@/lib/payments/resolve.server");
    const current = await loadStorePayment(data.store_id, data.provider);
    const missing = missingGatewayFields({ provider: data.provider, environment: data.environment, public_data: publicData, secret_data: { ...current?.secret_data, ...secrets } });
    if (missing.length) return { ok: false as const, error: `Preencha: ${missing.join(", ")}.` };
    const { error } = await supabaseAdmin.rpc("save_store_payment_gateway", {
      p_store_id: data.store_id, p_provider: data.provider, p_environment: data.environment, p_public_data: publicData, p_secret_data: secrets,
    });
    if (error) return { ok: false as const, error: "Não foi possível salvar este gateway. A configuração anterior foi mantida." };
    return { ok: true as const };
  });

export const activateStoreGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => gatewayInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("activate_store_payment_gateway", { p_store_id: data.store_id, p_provider: data.provider });
    return error ? { ok: false as const, error: "Não foi possível ativar. Confira as credenciais salvas; o gateway anterior foi mantido." } : { ok: true as const };
  });

export const setStorePaymentsEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeInput.extend({ enabled: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("store_payment_settings").update({ enabled: data.enabled }).eq("store_id", data.store_id).select("store_id").maybeSingle();
    return error || !row ? { ok: false as const, error: "Não foi possível alterar os pagamentos." } : { ok: true as const };
  });

export const testStoreGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => gatewayInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { loadStorePayment, toGatewayConfig } = await import("@/lib/payments/resolve.server");
    const row = await loadStorePayment(data.store_id, data.provider);
    if (!row || missingGatewayFields(row).length) return { ok: false as const, error: "Salve as credenciais obrigatórias deste gateway antes do teste." };
    const { getProvider } = await import("@/lib/payments/providers.server");
    const provider = getProvider(row.provider);
    if (!provider) return { ok: false as const, error: "Gateway não disponível." };
    try {
      const result = await provider.testConnection(toGatewayConfig(row));
      // Never forward arbitrary provider content or account data to the browser.
      if (!result.ok) {
        const detail = result.error ?? "";
        const error = /autentic|credencia|chave|token|key/i.test(detail) ? "Falha de autenticação. Confira as credenciais deste gateway." : /tentativ|limite|aguarde/i.test(detail) ? "Limite de consultas do provedor. Aguarde antes de testar novamente." : "O provedor recusou a consulta ou está indisponível. Tente novamente.";
        // WestPay builds a credential-free message with the real HTTP status/provider text.
        return { ok: false as const, error: (data.provider === "westpay" || data.provider === "venuspay" || data.provider === "pixxblack") && detail ? detail : error };
      }
      return { ok: true as const };
    } catch {
      return { ok: false as const, error: "Erro de comunicação com o provedor. Tente novamente." };
    }
  });
