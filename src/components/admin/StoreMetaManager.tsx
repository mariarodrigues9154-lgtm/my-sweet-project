import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getStoreMetaSettings, listMetaEventLogs, saveStoreMetaSettings, sendMetaTestEvents, testStoreMetaPixel } from "@/lib/meta.functions";

export function StoreMetaManager({ storeId }: { storeId: string }) {
  const load = useServerFn(getStoreMetaSettings);
  const save = useServerFn(saveStoreMetaSettings);
  const test = useServerFn(testStoreMetaPixel);
  const { data, refetch, isLoading } = useQuery({ queryKey: ["admin-meta", storeId], queryFn: () => load({ data: { store_id: storeId } }) });
  const [enabled, setEnabled] = useState(false);
  const [pixelId, setPixelId] = useState("");
  const [trackPending, setTrackPending] = useState(true);
  const [token, setToken] = useState("");
  const [removeToken, setRemoveToken] = useState(false);
  const [testCode, setTestCode] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "test">("");
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled); setPixelId(data.pixel_id); setTrackPending(data.track_pending); setTestCode(data.test_event_code); setToken(""); setRemoveToken(false);
  }, [data]);

  async function onSave() {
    setBusy("save");
    try {
      const result = await save({ data: { store_id: storeId, enabled, pixel_id: pixelId.trim(), track_pending: trackPending, capi_token: token.trim(), remove_capi_token: removeToken, test_event_code: testCode.trim() } });
      if (!result.ok) { toast.error(result.error); return; }
      toast.success("Meta Pixel salvo.");
      await refetch();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setBusy(""); }
  }

  async function onTest() {
    setBusy("test");
    try { setTestResult(await test({ data: { store_id: storeId } })); }
    finally { setBusy(""); }
  }

  return <section className="rounded-xl bg-card p-4 shadow-card-soft">
    <h2 className="text-[15px] font-extrabold">Meta Pixel e Rastreamento</h2>
    <p className="mt-1 text-[11.5px] text-muted-foreground">Pixel exclusivo desta loja. Os eventos nunca são enviados para o Pixel de outra loja.</p>
    {isLoading ? <div className="grid place-items-center py-6"><Loader2 className="animate-spin text-muted-foreground" /></div> : <>
      <dl className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-surface p-3 text-[11.5px]">
        <dt className="text-muted-foreground">Meta Pixel</dt><dd className="font-semibold">{data?.enabled && data.pixel_id ? "Ativo" : "Inativo"}</dd>
        <dt className="text-muted-foreground">Pixel ID</dt><dd className="font-semibold">{data?.pixel_masked || "—"}</dd>
        <dt className="text-muted-foreground">Conversions API</dt><dd className="font-semibold">{data?.capi_configured ? "Configurada" : "Não configurada"}</dd>
        <dt className="text-muted-foreground">Rastreamento de PIX pendente</dt><dd className="font-semibold">{data?.track_pending ? "Ativado" : "Desativado"}</dd>
      </dl>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Toggle label={`Ativar Meta Pixel: ${enabled ? "Ativado" : "Desativado"}`} checked={enabled} onChange={setEnabled} />
        <Toggle label={`Rastrear PIX não pago (PaymentPending): ${trackPending ? "Ativado" : "Desativado"}`} checked={trackPending} onChange={setTrackPending} />
        <Field label="Pixel ID" value={pixelId} placeholder="123456789012345" onChange={(v) => setPixelId(v.replace(/\D/g, ""))} />
        <Field label="Conversions API Access Token" value={token} type="password" placeholder={data?.capi_masked || "Cole o token (opcional)"} onChange={(v) => { setToken(v); setRemoveToken(false); }} />
        <Field label="Meta Test Event Code (opcional, expira em 24h)" value={testCode} placeholder="TEST12345" onChange={setTestCode} />
        {data?.capi_configured && <Toggle label="Remover token da Conversions API ao salvar" checked={removeToken} onChange={setRemoveToken} />}
      </div>

      <div className="mt-3 rounded-lg border border-border p-3 text-[11.5px]">
        <p className="font-semibold">Evento de compra</p>
        <label className="mt-1 flex items-center gap-2 text-muted-foreground"><input type="checkbox" checked disabled /> Enviar Purchase somente quando o pagamento for confirmado</label>
        <p className="mt-1 text-muted-foreground">PIX gerado e não pago nunca é contado como compra.</p>
      </div>

      {testResult && <p className={`mt-3 text-[12px] font-semibold ${testResult.ok ? "text-success" : "text-destructive"}`}>{testResult.message}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="rounded-full" disabled={busy !== ""} onClick={() => void onTest()}>{busy === "test" ? "Testando..." : "Testar Pixel"}</Button>
        <Button type="button" className="rounded-full px-6 font-extrabold" disabled={busy !== ""} onClick={() => void onSave()}>{busy === "save" ? "Salvando..." : "Salvar"}</Button>
      </div>
      <MetaTestMode storeId={storeId} pixelId={data?.pixel_id ?? ""} hasCode={Boolean(data?.test_event_code)} hasToken={Boolean(data?.capi_configured)} />
      <MetaEventLog storeId={storeId} />
    </>}
  </section>;
}

function MetaTestMode({ storeId, pixelId, hasCode, hasToken }: { storeId: string; pixelId: string; hasCode: boolean; hasToken: boolean }) {
  const send = useServerFn(sendMetaTestEvents);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; message: string; results: Array<{ event: string; ok: boolean; error?: string }> } | null>(null);
  async function run() {
    setBusy(true);
    try { setRes(await send({ data: { store_id: storeId } })); await qc.invalidateQueries({ queryKey: ["admin-meta-logs", storeId] }); }
    catch (e) { setRes({ ok: false, message: e instanceof Error ? e.message : "Falha no teste.", results: [] }); }
    finally { setBusy(false); }
  }
  return <div className="mt-6 rounded-lg border border-primary/40 bg-primary/5 p-3">
    <p className="text-[13px] font-extrabold">Modo de teste</p>
    <p className="mt-1 text-[11.5px] text-muted-foreground">Envia eventos de exemplo que aparecem só na aba "Eventos de teste" da Meta. Não contam como vendas reais nem afetam suas campanhas.</p>
    <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-[11.5px] text-muted-foreground">
      <li>No Gerenciador de Eventos da Meta, abra seu Pixel{pixelId ? ` (${pixelId})` : ""} → <b>Eventos de teste</b> e copie o código (ex.: TEST12345).</li>
      <li>Cole no campo "Meta Test Event Code" acima e clique em <b>Salvar</b> {hasCode ? "✓" : ""}.</li>
      <li>Clique em <b>Enviar eventos de teste</b> e veja PageView, ViewContent, AddToCart, InitiateCheckout e Purchase chegarem na Meta.</li>
      <li>Para testar o navegador, na mesma aba da Meta digite o endereço da loja em "Testar eventos do navegador" e navegue pelo produto e checkout.</li>
    </ol>
    {!hasToken && <p className="mt-2 text-[11.5px] font-semibold text-destructive">O teste pelo servidor precisa do Access Token salvo.</p>}
    <Button type="button" variant="outline" className="mt-3 rounded-full" disabled={busy} onClick={() => void run()}>{busy ? "Enviando..." : "Enviar eventos de teste"}</Button>
    {res && <div className="mt-3 text-[12px]">
      <p className={`font-semibold ${res.ok ? "text-success" : "text-destructive"}`}>{res.message}</p>
      {res.results.length > 0 && <ul className="mt-2 space-y-1">{res.results.map((r) => <li key={r.event} className="flex flex-wrap gap-2"><span className={r.ok ? "text-success" : "text-destructive"}>{r.ok ? "✓" : "✗"}</span><span className="font-medium">{r.event}</span>{r.error && <span className="break-words text-destructive">{r.error}</span>}</li>)}</ul>}
    </div>}
  </div>;
}

function MetaEventLog({ storeId }: { storeId: string }) {
  const list = useServerFn(listMetaEventLogs);
  const [onlyFailures, setOnlyFailures] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const { data = [], isFetching, refetch } = useQuery({ queryKey: ["admin-meta-logs", storeId, onlyFailures], queryFn: () => list({ data: { store_id: storeId, only_failures: onlyFailures } }) });
  return <div className="mt-6 border-t border-border pt-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-[13px] font-semibold">Histórico de eventos enviados à Meta</p>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-[11.5px] text-muted-foreground"><input type="checkbox" checked={onlyFailures} onChange={(e) => setOnlyFailures(e.target.checked)} /> Só falhas</label>
        <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => void refetch()}>{isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Atualizar"}</Button>
      </div>
    </div>
    <p className="mt-1 text-[11px] text-muted-foreground">Envios feitos pelo servidor (compras confirmadas e testes). Últimos 100.</p>
    {data.length === 0 ? <p className="mt-3 text-[12px] text-muted-foreground">Nenhum evento registrado ainda.</p> :
    <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
      {data.map((e) => <li key={e.id} className="p-3 text-[12px]">
        <button type="button" className="flex w-full flex-wrap items-center gap-2 text-left" onClick={() => setOpen(open === e.id ? null : e.id)}>
          <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${e.ok ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>{e.ok ? "Enviado" : "Falhou"}</span>
          <span className="font-medium">{e.event_name}</span>
          {e.order_number && <span className="text-muted-foreground">Pedido {e.order_number}</span>}
          {e.test_mode && <span className="rounded bg-muted px-1.5 text-[10px]">teste</span>}
          <span className="ml-auto text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR")}</span>
        </button>
        {open === e.id && <div className="mt-2 space-y-0.5 rounded bg-muted/50 p-2 text-[11px] text-muted-foreground">
          <p>Origem: {e.source}</p>
          {e.event_id && <p>ID do evento: {e.event_id}</p>}
          <p>Resposta HTTP: {e.http_status ?? "sem resposta"}</p>
          {e.error && <p className="break-words text-destructive">Detalhe: {e.error}</p>}
        </div>}
      </li>)}
    </ul>}
  </div>;
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label className="block min-w-0"><span className="mb-1 block text-[11px] font-semibold text-muted-foreground">{label}</span><input type={type} value={value} placeholder={placeholder} autoComplete="off" onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-[13px] outline-none focus:border-primary" /></label>;
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[11.5px] font-semibold"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}
