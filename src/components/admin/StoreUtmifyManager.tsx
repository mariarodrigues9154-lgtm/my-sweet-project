import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getStoreUtmify, listUtmifyLogs, resyncStoreUtmify, saveStoreUtmify, testStoreUtmify } from "@/lib/utmify.functions";

const STATUS_LABEL: Record<string, string> = { waiting_payment: "PIX gerado", paid: "Pago", refunded: "Reembolsado" };

export function StoreUtmifyManager({ storeId }: { storeId: string }) {
  const load = useServerFn(getStoreUtmify);
  const save = useServerFn(saveStoreUtmify);
  const test = useServerFn(testStoreUtmify);
  const resync = useServerFn(resyncStoreUtmify);
  const logsFn = useServerFn(listUtmifyLogs);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-utmify", storeId], queryFn: () => load({ data: { store_id: storeId } }) });
  const logs = useQuery({ queryKey: ["admin-utmify-logs", storeId], queryFn: () => logsFn({ data: { store_id: storeId } }) });
  const [enabled, setEnabled] = useState(false);
  const [token, setToken] = useState("");
  const [utmOn, setUtmOn] = useState(false);
  const [utmCode, setUtmCode] = useState("");
  const [pixelOn, setPixelOn] = useState(false);
  const [pixelCode, setPixelCode] = useState("");
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled); setUtmOn(data.utm_script_enabled); setPixelOn(data.pixel_enabled); setToken(""); setUtmCode(""); setPixelCode("");
  }, [data]);

  async function run(kind: string, fn: () => Promise<void>) {
    setBusy(kind);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "Erro inesperado."); } finally { setBusy(""); }
  }

  return <section className="rounded-xl bg-card p-4 shadow-card-soft">
    <h2 className="text-[15px] font-extrabold">Integração UTMify</h2>
    <p className="mt-1 text-[11.5px] text-muted-foreground">Envia à UTMify os pedidos desta loja: “PIX gerado” quando o PIX é criado e “Pago” só quando o gateway confirma o pagamento.</p>
    {isLoading ? <div className="grid place-items-center py-6"><Loader2 className="animate-spin text-muted-foreground" /></div> : <>
      <dl className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-surface p-3 text-[11.5px]">
        <dt className="text-muted-foreground">Envio de vendas</dt><dd className="font-semibold">{data?.enabled && data.token_configured ? "Ativo" : "Inativo"}</dd>
        <dt className="text-muted-foreground">Credencial de API</dt><dd className="font-semibold">{data?.token_configured ? "Salva" : "Não configurada"}</dd>
        <dt className="text-muted-foreground">Script de UTMs</dt><dd className="font-semibold">{data?.utm_script_enabled ? "Instalado" : "Desligado"}</dd>
        <dt className="text-muted-foreground">Pixel UTMify</dt><dd className="font-semibold">{data?.pixel_enabled ? `Ativo (${data.pixel_id})` : "Desligado"}</dd>
      </dl>
      <div className="mt-4 grid gap-3">
        <label className="flex items-center gap-2 text-[12.5px] font-semibold"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enviar vendas para a UTMify</label>
        <label className="grid gap-1 text-[12px] font-semibold">Credencial de API (x-api-token)
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={data?.token_configured ? "•••••••••• (salva — digite só para trocar)" : "Cole a credencial criada na UTMify"} className="h-9 rounded-md border border-input bg-background px-2 text-[12.5px] font-normal" />
        </label>
        <label className="flex items-center gap-2 text-[12.5px] font-semibold"><input type="checkbox" checked={utmOn} onChange={(e) => setUtmOn(e.target.checked)} /> Instalar script de UTMs</label>
        <textarea value={utmCode} onChange={(e) => setUtmCode(e.target.value)} rows={3} placeholder={data?.utm_script_src ? `Instalado: ${data.utm_script_src} — cole de novo só para trocar` : "Cole aqui o script de UTMs gerado na sua conta UTMify"} className="rounded-md border border-input bg-background p-2 font-mono text-[11px]" />
        <label className="flex items-center gap-2 text-[12.5px] font-semibold"><input type="checkbox" checked={pixelOn} onChange={(e) => setPixelOn(e.target.checked)} /> Ativar Pixel da UTMify</label>
        <textarea value={pixelCode} onChange={(e) => setPixelCode(e.target.value)} rows={3} placeholder={data?.pixel_script_src ? `Instalado: Pixel ${data.pixel_id} — cole de novo só para trocar` : "Cole aqui o código do Pixel gerado na sua conta UTMify"} className="rounded-md border border-input bg-background p-2 font-mono text-[11px]" />
        <p className="text-[11px] text-muted-foreground">Só scripts hospedados pela UTMify são aceitos. A compra não é disparada pelo Pixel da UTMify: ela chega pela API, sem duplicar com o Meta Pixel.</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" className="rounded-full" disabled={!!busy} onClick={() => run("save", async () => {
          const r = await save({ data: { store_id: storeId, enabled, api_token: token.trim(), utm_script_enabled: utmOn, utm_script_code: utmCode, pixel_enabled: pixelOn, pixel_code: pixelCode } });
          if (!r.ok) { toast.error(r.error); return; }
          toast.success("Integração UTMify salva."); await refetch();
        })}>{busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
        <Button size="sm" variant="outline" className="rounded-full" disabled={!!busy} onClick={() => run("test", async () => { setResult(await test({ data: { store_id: storeId } })); await logs.refetch(); })}>{busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Testar sem venda real"}</Button>
        <Button size="sm" variant="outline" className="rounded-full" disabled={!!busy} onClick={() => run("resync", async () => { const r = await resync({ data: { store_id: storeId } }); toast.success(`${r.count} pedido(s) reenviado(s).`); await logs.refetch(); })}>{busy === "resync" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reenviar pendentes (7 dias)"}</Button>
      </div>
      {result && <p className={`mt-2 text-[12px] font-semibold ${result.ok ? "text-success" : "text-destructive"}`}>{result.message}</p>}
      <div className="mt-5 border-t border-border pt-3">
        <p className="text-[13px] font-semibold">Registros de sincronização</p>
        {(logs.data ?? []).length === 0 ? <p className="mt-2 text-[12px] text-muted-foreground">Nenhum envio ainda.</p> :
        <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
          {(logs.data ?? []).map((l) => <li key={l.id} className="p-2.5 text-[12px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${l.ok ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>{l.ok ? "Enviado" : "Falhou"}</span>
              <span className="font-medium">{STATUS_LABEL[l.status] ?? l.status}</span>
              {l.order_number && <span className="text-muted-foreground">{l.order_number}</span>}
              {l.test_mode && <span className="rounded bg-muted px-1.5 text-[10px]">teste</span>}
              <span className="ml-auto text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
            </div>
            {l.error && <p className="mt-1 break-words text-[11px] text-destructive">{l.error}</p>}
          </li>)}
        </ul>}
      </div>
    </>}
  </section>;
}
