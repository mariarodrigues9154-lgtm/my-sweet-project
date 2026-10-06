import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Loader2, Plug } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PAYMENT_PROVIDERS, providerSpec, type PaymentProviderId } from "@/lib/payments/catalog";
import { getStorePaymentSettings, saveStorePaymentSettings, testStoreGateway } from "@/lib/store-payments.functions";

const WEBHOOK_PATH = "/api/public/pagamentos/webhook";

export function StorePaymentsManager({ storeId }: { storeId: string }) {
  const load = useServerFn(getStorePaymentSettings);
  const save = useServerFn(saveStorePaymentSettings);
  const test = useServerFn(testStoreGateway);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["store-payments", storeId],
    queryFn: () => load({ data: { store_id: storeId } }),
  });

  const [provider, setProvider] = useState<PaymentProviderId>("none");
  const [enabled, setEnabled] = useState(false);
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");
  const [publicData, setPublicData] = useState<Record<string, string>>({});
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!data) return;
    setProvider(data.provider as PaymentProviderId);
    setEnabled(data.enabled);
    setEnvironment(data.environment === "production" ? "production" : "sandbox");
    setPublicData(data.public_data ?? {});
    setSecrets({});
    setEditing({});
  }, [data]);

  const spec = providerSpec(provider);
  const hookPath = provider === "wappi" ? "/api/public/webhooks/wappi" : provider === "pinpay" ? "/api/public/webhooks/pinpay" : WEBHOOK_PATH;
  const webhookUrl = typeof window === "undefined" ? hookPath : `${window.location.origin}${hookPath}`;

  async function handleSave() {
    setBusy("save");
    const result = await save({ data: { store_id: storeId, provider, enabled, environment, public_data: publicData, secret_data: secrets } });
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Pagamentos salvos.");
    await refetch();
  }

  async function handleTest() {
    setBusy("test");
    const result = await test({ data: { store_id: storeId } });
    setBusy(null);
    if (result.ok) {
      const c = "company" in result ? result.company : null;
      const detail = [c?.fantasy_name ? `Empresa: ${c.fantasy_name}` : "", c?.status ? `Status: ${c.status}` : ""].filter(Boolean).join(" · ");
      toast.success(provider === "wappi" ? "Wappi Brasil conectada com sucesso." : "Conexão com o provedor confirmada.", detail ? { description: detail } : undefined);
    } else toast.error(result.error);
  }

  return (
    <section className="mt-3 rounded-xl bg-card p-4 shadow-card-soft">
      <div className="flex items-center gap-2">
        <Plug size={16} className="text-primary" />
        <h2 className="text-[15px] font-extrabold">Checkout e Pagamentos</h2>
      </div>
      <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
        Cada loja usa o seu próprio recebedor. As credenciais ficam guardadas apenas no servidor e nunca aparecem no site.
      </p>

      {isLoading ? (
        <div className="grid min-h-[120px] place-items-center">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="text-[11.5px] font-bold text-muted-foreground">Gateway de pagamento</span>
            <select
              value={provider}
              onChange={(event) => {
                setProvider(event.target.value as PaymentProviderId);
                setSecrets({});
                setPublicData({});
              }}
              className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-[13.5px] font-semibold"
            >
              {PAYMENT_PROVIDERS.filter((item) => item.id === "none" || item.id === "wappi" || item.id === "pinpay" || item.id === provider).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          {provider !== "none" && (
            <>
              {spec.docs && <p className="text-[11px] text-muted-foreground">Onde encontrar: {spec.docs}</p>}

              {!spec.singleEnvironment && <label className="block">
                <span className="text-[11.5px] font-bold text-muted-foreground">Ambiente</span>
                <select
                  value={environment}
                  onChange={(event) => setEnvironment(event.target.value as "sandbox" | "production")}
                  className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-[13.5px] font-semibold"
                >
                  <option value="sandbox">Teste (sandbox)</option>
                  <option value="production">Produção (cobranças reais)</option>
                </select>
              </label>}

              <div className="grid gap-2 sm:grid-cols-2">
                {spec.fields.map((field) => {
                  const savedMask = data?.secrets_masked?.[field.key];
                  const locked = field.secret && savedMask && !editing[field.key];
                  return (
                    <label key={field.key} className="block">
                      <span className="text-[11.5px] font-bold text-muted-foreground">
                        {field.label}
                        {field.required ? " *" : ""}
                      </span>
                      {locked ? (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="flex h-11 flex-1 items-center rounded-lg border border-input bg-muted/40 px-3 text-[13.5px]">••••••••••••••</span>
                          <Button type="button" variant="outline" size="sm" className="h-11 text-[12px] font-bold" onClick={() => setEditing((c) => ({ ...c, [field.key]: true }))}>
                            Alterar credencial
                          </Button>
                        </div>
                      ) : (
                        <input
                          type={field.secret ? "password" : "text"}
                          autoComplete="off"
                          value={field.secret ? (secrets[field.key] ?? "") : (publicData[field.key] ?? "")}
                          onChange={(event) => {
                            const value = event.target.value;
                            if (field.secret) setSecrets((current) => ({ ...current, [field.key]: value }));
                            else setPublicData((current) => ({ ...current, [field.key]: value }));
                          }}
                          className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-[13.5px]"
                        />
                      )}
                      {field.hint && <span className="mt-1 block text-[10.5px] text-muted-foreground">{field.hint}</span>}
                    </label>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className="flex w-full items-center justify-between rounded-lg border border-input px-3 py-3 text-left"
              >
                <span className="text-[12.5px] font-bold">
                  {enabled ? "Pagamentos ativos nesta loja" : "Pagamentos desativados nesta loja"}
                </span>
                <span className={`h-5 w-9 rounded-full transition ${enabled ? "bg-primary" : "bg-muted"}`}>
                  <span className={`block size-4 translate-y-0.5 rounded-full bg-background transition ${enabled ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                </span>
              </button>

              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-[11.5px] font-bold">Aviso de pagamento (webhook)</p>
                <p className="mt-1 break-all text-[11px] text-muted-foreground">{webhookUrl}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 h-9 text-[12px] font-bold"
                  onClick={async () => {
                    await navigator.clipboard.writeText(webhookUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copiado" : "Copiar endereço"}
                </Button>
                <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
                  Cole este endereço no painel do provedor. O pedido só é marcado como pago depois que o provedor confirma.
                </p>
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleSave} disabled={busy !== null} className="h-11 flex-1 text-[13px] font-extrabold">
              {busy === "save" ? <Loader2 size={16} className="animate-spin" /> : "Salvar pagamentos"}
            </Button>
            {provider !== "none" && (
              <Button type="button" variant="outline" onClick={handleTest} disabled={busy !== null} className="h-11 text-[13px] font-bold">
                {busy === "test" ? <Loader2 size={16} className="animate-spin" /> : "Testar conexão"}
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
