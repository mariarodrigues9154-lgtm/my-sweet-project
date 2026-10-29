import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Loader2, Plug, Plus, Pencil, Power, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PAYMENT_PROVIDERS, providerSpec, type PaymentProviderId } from "@/lib/payments/catalog";
import { getStorePaymentSettings, saveStorePaymentSettings, testStoreGateway, activateStoreGateway, setStorePaymentsEnabled } from "@/lib/store-payments.functions";

type GatewayId = Exclude<PaymentProviderId, "none">;

export function StorePaymentsManager({ storeId }: { storeId: string }) {
  const load = useServerFn(getStorePaymentSettings);
  const save = useServerFn(saveStorePaymentSettings);
  const test = useServerFn(testStoreGateway);
  const activate = useServerFn(activateStoreGateway);
  const toggle = useServerFn(setStorePaymentsEnabled);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["store-payments", storeId], queryFn: () => load({ data: { store_id: storeId } }) });
  const [provider, setProvider] = useState<GatewayId | null>(null);
  const [adding, setAdding] = useState(false);
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");
  const [publicData, setPublicData] = useState<Record<string, string>>({});
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [results, setResults] = useState<Record<string, { ok: boolean; text: string }>>({});
  useEffect(() => { setProvider(null); setAdding(false); setSecrets({}); setResults({}); }, [storeId]);
  const gateways = data?.gateways ?? [];
  const available = PAYMENT_PROVIDERS.filter((item) => item.supportsPix && !gateways.some((g) => g.provider === item.id));
  const saved = gateways.find((g) => g.provider === provider);
  const spec = providerSpec(provider ?? "none");
  const hookPath = provider && !["mercadopago", "asaas"].includes(provider) ? `/api/public/webhooks/${provider}` : "/api/public/pagamentos/webhook";
  const webhookUrl = typeof window === "undefined" ? hookPath : `${window.location.origin}${hookPath}`;

  function openEditor(id: GatewayId, isNew = false) {
    const row = gateways.find((g) => g.provider === id);
    setProvider(id); setAdding(isNew); setEnvironment(row?.environment === "production" ? "production" : "sandbox");
    setPublicData(row?.public_data ?? {}); setSecrets({}); setEditing({}); setCopied(false);
  }
  async function action(key: string, run: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setBusy(key);
    try {
      const result = await run();
      if (!result.ok) { toast.error(result.error ?? "Não foi possível concluir."); return false; }
      toast.success(success); await refetch(); return true;
    } catch { toast.error("Não foi possível concluir. A configuração anterior foi mantida."); return false; }
    finally { setBusy(null); }
  }
  async function handleSave() {
    if (!provider) return;
    const done = await action("save", () => save({ data: { store_id: storeId, provider, environment, public_data: publicData, secret_data: secrets } }), "Credenciais salvas.");
    if (done) { setProvider(null); setAdding(false); setSecrets({}); }
  }
  async function handleTest(id: GatewayId) {
    setBusy(`test:${id}`);
    try {
      const result = await test({ data: { store_id: storeId, provider: id } });
      setResults((current) => ({ ...current, [id]: { ok: result.ok, text: result.ok ? "Conexão confirmada." : result.error } }));
    } catch { setResults((current) => ({ ...current, [id]: { ok: false, text: "Erro de comunicação. Tente novamente." } })); }
    finally { setBusy(null); }
  }

  return (
    <section className="mt-3 rounded-xl bg-card p-4 shadow-card-soft">
      <div className="flex items-center gap-2"><Plug size={16} className="text-primary" /><h2 className="text-[15px] font-extrabold">Checkout e Pagamentos</h2></div>
      {isLoading ? <div className="grid min-h-[120px] place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div> : error ? <p role="alert" className="mt-3 text-sm text-destructive">Não foi possível carregar os gateways. <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar novamente</Button></p> : (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
            <label htmlFor={`payments-${storeId}`} className="text-[12.5px] font-bold">Pagamentos ativos nesta loja</label>
            <Switch id={`payments-${storeId}`} checked={data?.enabled ?? false} disabled={busy !== null} onCheckedChange={(enabled) => action("toggle", () => toggle({ data: { store_id: storeId, enabled } }), enabled ? "Pagamentos ativados." : "Pagamentos desativados.")} />
          </div>
          <h3 className="text-[13px] font-extrabold">Gateways de pagamento</h3>
          {gateways.length === 0 && <p className="text-xs text-muted-foreground">Nenhum gateway cadastrado.</p>}
          <div className="space-y-2">
            {gateways.map((gateway) => {
              const active = data?.provider === gateway.provider;
              const id = gateway.provider as GatewayId;
              const result = results[id];
              return <article key={id} aria-label={providerSpec(id).name} className={`rounded-lg border p-3 ${active ? "border-primary bg-primary/5" : "border-border"}`}>
                <div className="flex items-center justify-between gap-2"><h4 className="text-[13px] font-extrabold">{providerSpec(id).name}</h4><span className={`flex items-center gap-1 text-[10px] font-extrabold ${active ? "text-primary" : "text-muted-foreground"}`}>{active && <Check size={13} />}{active ? "ATIVO" : "INATIVO"}</span></div>
                <p className="mt-1 text-[11px] text-muted-foreground">Credenciais: {gateway.configured ? "salvas" : "configuração incompleta"}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!active && <Button size="sm" disabled={busy !== null || !gateway.configured} onClick={() => action(`activate:${id}`, () => activate({ data: { store_id: storeId, provider: id } }), `${providerSpec(id).name} ativado para novos pedidos PIX.`)}><Power size={13} />{busy === `activate:${id}` ? <Loader2 size={13} className="animate-spin" /> : "Ativar"}</Button>}
                  <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => handleTest(id)}>{busy === `test:${id}` ? <Loader2 size={13} className="animate-spin" /> : <Plug size={13} />}Testar conexão</Button>
                  <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => openEditor(id)}><Pencil size={13} />Editar credenciais</Button>
                </div>
                {result && <p role="status" className={`mt-2 text-xs ${result.ok ? "text-primary" : "text-destructive"}`}>{result.text}</p>}
              </article>;
            })}
          </div>
          {!provider && available.length > 0 && <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => { const first = available[0]; if (first) openEditor(first.id as GatewayId, true); }}><Plus size={14} />Adicionar gateway</Button>}
          {provider && <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between"><h3 className="text-[13px] font-extrabold">{adding ? "Adicionar gateway" : `Credenciais — ${spec.name}`}</h3><Button size="icon" variant="ghost" aria-label="Fechar edição do gateway" disabled={busy !== null} onClick={() => { setProvider(null); setSecrets({}); setAdding(false); }}><X size={16} /></Button></div>
            {adding && <label className="block text-xs font-bold">Gateway de pagamento<select aria-label="Gateway de pagamento" value={provider} onChange={(e) => openEditor(e.target.value as GatewayId, true)} className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-[13px]">{available.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
            {spec.docs && <p className="text-[11px] text-muted-foreground">Onde encontrar: {spec.docs}</p>}
            {!spec.singleEnvironment && <label className="block text-xs font-bold">Ambiente<select value={environment} onChange={(e) => setEnvironment(e.target.value as "sandbox" | "production")} className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-[13px]"><option value="sandbox">Teste (sandbox)</option><option value="production">Produção (cobranças reais)</option></select></label>}
            <div className="grid gap-2 sm:grid-cols-2">{spec.fields.map((field) => {
              const locked = field.secret && saved?.secrets_masked[field.key] && !editing[field.key];
              return <label key={field.key} className="block text-[11.5px] font-bold text-muted-foreground">{field.label}{field.required ? " *" : ""}
                {locked ? <div className="mt-1 flex items-center gap-2"><span className="flex h-11 min-w-0 flex-1 items-center rounded-lg border border-input bg-muted/40 px-3">••••••••••••••</span><Button variant="outline" size="sm" onClick={() => setEditing((current) => ({ ...current, [field.key]: true }))}>Alterar</Button></div> : <input type={field.secret ? "password" : "text"} autoComplete="off" value={field.secret ? secrets[field.key] ?? "" : publicData[field.key] ?? ""} onChange={(e) => field.secret ? setSecrets((current) => ({ ...current, [field.key]: e.target.value })) : setPublicData((current) => ({ ...current, [field.key]: e.target.value }))} className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-[13px] font-normal text-foreground" />}
                {field.hint && <span className="mt-1 block text-[10.5px] font-normal">{field.hint}</span>}
              </label>;
            })}</div>
            <div className="border-t border-border pt-3"><p className="text-[11.5px] font-bold">Aviso de pagamento (webhook)</p><p className="mt-1 break-all text-[11px] text-muted-foreground">{webhookUrl}</p><Button variant="outline" size="sm" className="mt-2" onClick={async () => { try { await navigator.clipboard.writeText(webhookUrl); setCopied(true); } catch { toast.error("Não foi possível copiar o endereço."); } }}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copiado" : "Copiar endereço"}</Button></div>
            <Button disabled={busy !== null} onClick={handleSave}>{busy === "save" && <Loader2 size={14} className="animate-spin" />}Salvar credenciais</Button>
          </div>}
        </div>
      )}
    </section>
  );
}
