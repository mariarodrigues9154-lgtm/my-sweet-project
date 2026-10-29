import { describe, expect, it, vi, beforeEach } from "vitest";
import { gatewaySettingsDto, missingGatewayFields, originalOrderProvider } from "./gateway-settings";

const state = vi.hoisted(() => ({ active: "westpay", enabled: true, calls: [] as Array<{ table: string; filters: Record<string,string> }>, rows: [
  { store_id: "loja-a", provider: "umbrellapag", environment: "production", public_data: {}, secret_data: { api_key: "segredo-a" }, pix_config: {} },
  { store_id: "loja-a", provider: "westpay", environment: "production", public_data: {}, secret_data: { public_key: "public-a", secret_key: "west-a" }, pix_config: {} },
  { store_id: "loja-b", provider: "umbrellapag", environment: "production", public_data: {}, secret_data: { api_key: "segredo-b" }, pix_config: {} },
] }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (table: string) => {
  const filters: Record<string,string> = {};
  const query = { select: () => query, eq: (key: string, value: string) => { filters[key] = value; return query; }, maybeSingle: async () => {
    state.calls.push({ table, filters });
    return { error: null, data: table === "store_payment_settings" ? { provider: state.active, enabled: state.enabled } : state.rows.find((row) => row.store_id === filters.store_id && row.provider === filters.provider) ?? null };
  } }; return query;
} } }));
import { loadStorePayment, loadOrderPayment, toGatewayConfig } from "./resolve.server";

beforeEach(() => { state.calls = []; state.active = "westpay"; state.enabled = true; });
describe("Gerenciador de gateways por loja", () => {
  it("mantém duas credenciais independentes e seleciona WestPay para compras novas", async () => {
    const active = await loadStorePayment("loja-a");
    expect(active?.provider).toBe("westpay"); expect(active?.secret_data.secret_key).toBe("west-a");
    const inactive = await loadStorePayment("loja-a", "umbrellapag"); expect(inactive?.secret_data.api_key).toBe("segredo-a");
  });
  it("troca o seletor sem redigitar credenciais e permite voltar", async () => {
    state.active = "umbrellapag"; expect((await loadStorePayment("loja-a"))?.secret_data.api_key).toBe("segredo-a");
    state.active = "westpay"; expect((await loadStorePayment("loja-a"))?.secret_data.secret_key).toBe("west-a");
  });
  it("pedido PIX antigo usa UmbrellaPag mesmo depois de ativar WestPay", async () => {
    const old = await loadOrderPayment("loja-a", { payment_provider: "umbrellapag" });
    expect(old?.provider).toBe("umbrellapag"); expect(old && toGatewayConfig(old).secrets.api_key).toBe("segredo-a");
  });
  it("webhook de gateway inativo obtém suas próprias credenciais mesmo com pagamentos desligados", async () => {
    state.enabled = false; const old = await loadStorePayment("loja-a", "umbrellapag");
    expect(old?.provider).toBe("umbrellapag"); expect(old?.enabled).toBe(false); expect(old?.secret_data.api_key).toBe("segredo-a");
  });
  it("lojas nunca compartilham credenciais", async () => {
    expect((await loadStorePayment("loja-b", "umbrellapag"))?.secret_data.api_key).toBe("segredo-b");
    expect(await loadStorePayment("loja-b", "westpay")).toBeNull();
  });
  it("provedor inexistente não usa fallback para o gateway ativo", async () => {
    expect(await loadOrderPayment("loja-a", { payment_provider: "invictuspay" })).toBeNull();
  });
  it("pedido sem identidade de gateway não consulta o seletor atual", async () => {
    expect(await loadOrderPayment("loja-a", {})).toBeNull(); expect(state.calls).toHaveLength(0);
  });
  it("pedidos legados usam o provedor original no JSON", () => {
    expect(originalOrderProvider({ payment: { provider: "umbrellapag" } })).toBe("umbrellapag");
    expect(originalOrderProvider({ payment_provider: "westpay", payment: { provider: "umbrellapag" } })).toBe("westpay");
  });
  it("resposta do painel não expõe nenhuma parte dos segredos", () => {
    const dto = gatewaySettingsDto(state.rows[1]); expect(JSON.stringify(dto)).not.toContain("west-a"); expect(JSON.stringify(dto)).not.toContain("public-a"); expect(dto.secrets_masked.secret_key).toBe("••••••••••••••");
  });
  it("ativação exige as duas credenciais WestPay", () => {
    expect(missingGatewayFields({ provider: "westpay", environment: "production", public_data: {}, secret_data: { public_key: "pk" } })).toEqual(["SECRET_KEY"]);
  });
  it("ativação exige a API Key da UmbrellaPag", () => {
    expect(missingGatewayFields({ provider: "umbrellapag", environment: "production", public_data: {}, secret_data: {} })).toEqual(["API Key"]);
  });
  it("atualizar a leitura preserva gateways e credenciais", async () => {
    expect(await loadStorePayment("loja-a", "umbrellapag")).toEqual(await loadStorePayment("loja-a", "umbrellapag"));
  });
});