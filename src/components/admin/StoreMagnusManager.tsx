import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getStoreMagnus, listStoreShipments, saveStoreMagnus, sendMagnusShipment, sendPendingMagnus, updateShipment } from "@/lib/magnus.functions";

const SEND_LABEL: Record<string, string> = { enviando: "Enviando", enviado: "Enviado", falhou: "Falhou", incerto: "Sem confirmação", manual: "Código manual" };
const DELIVERY_LABEL: Record<string, string> = {
  aguardando_postagem: "Aguardando postagem", postado: "Postado", em_transito: "Em trânsito",
  saiu_para_entrega: "Saiu para entrega", entregue: "Entregue", devolvido: "Devolvido", problema: "Problema na entrega",
};

export function StoreMagnusManager({ storeId }: { storeId: string }) {
  const load = useServerFn(getStoreMagnus);
  const save = useServerFn(saveStoreMagnus);
  const list = useServerFn(listStoreShipments);
  const send = useServerFn(sendMagnusShipment);
  const sendAll = useServerFn(sendPendingMagnus);
  const update = useServerFn(updateShipment);
  const cfg = useQuery({ queryKey: ["admin-magnus", storeId], queryFn: () => load({ data: { store_id: storeId } }) });
  const ships = useQuery({ queryKey: ["admin-magnus-ships", storeId], queryFn: () => list({ data: { store_id: storeId } }) });
  const [enabled, setEnabled] = useState(false);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState("");
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");

  useEffect(() => { if (cfg.data) { setEnabled(cfg.data.enabled); setToken(""); } }, [cfg.data]);

  async function run(kind: string, fn: () => Promise<void>) {
    setBusy(kind);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "Erro inesperado."); } finally { setBusy(""); await ships.refetch(); }
  }

  return <section className="rounded-xl bg-card p-4 shadow-card-soft">
    <h2 className="text-[15px] font-extrabold">Rastreamento — Magnus Frete</h2>
    <p className="mt-1 text-[11.5px] text-muted-foreground">Quando o pagamento é confirmado, o pedido desta loja é enviado uma única vez à Magnus Frete, que devolve o código de rastreio.</p>
    {cfg.isLoading ? <div className="grid place-items-center py-6"><Loader2 className="animate-spin text-muted-foreground" /></div> : <>
      <div className="mt-3 grid gap-3">
        <label className="flex items-center gap-2 text-[12.5px] font-semibold"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enviar pedidos pagos automaticamente</label>
        <label className="grid gap-1 text-[12px] font-semibold">Token da API Externa
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={cfg.data?.token_configured ? "•••••••••• (salvo — digite só para trocar)" : "Integrações → API Externa no painel Magnus Frete"} className="h-9 rounded-md border border-input bg-background px-2 text-[12.5px] font-normal" />
        </label>
        <p className="text-[11px] text-muted-foreground">A Magnus Frete não tem teste sem criar pedido: o token é validado no primeiro envio real.</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" className="rounded-full" disabled={!!busy} onClick={() => run("save", async () => {
          const r = await save({ data: { store_id: storeId, enabled, api_token: token.trim() } });
          if (!r.ok) { toast.error(r.error); return; }
          toast.success("Magnus Frete salva."); await cfg.refetch();
        })}>{busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
        <Button size="sm" variant="outline" className="rounded-full" disabled={!!busy || !cfg.data?.enabled} onClick={() => run("all", async () => {
          if (!confirm("Enviar à Magnus Frete todos os pedidos pagos (30 dias) que ainda não têm envio?")) return;
          const r = await sendAll({ data: { store_id: storeId } });
          toast.success(`${r.sent} enviado(s), ${r.failed} com falha.`);
        })}>{busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar pagos sem rastreio"}</Button>
      </div>
    </>}
    <div className="mt-5 border-t border-border pt-3">
      <p className="text-[13px] font-semibold">Pedidos pagos (30 dias)</p>
      <div className="relative mt-2">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar nome, telefone, pedido ou rastreio..." aria-label="Pesquisar pedidos" className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 text-[12.5px]" />
        {query && <button type="button" aria-label="Limpar pesquisa" onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
      </div>
      {(() => {
        const all = ships.data ?? [];
        const filtered = query.trim() ? all.filter((o) => shipmentMatchesQuery(o, query)) : all;
        return ships.isLoading ? <Loader2 className="mt-2 animate-spin text-muted-foreground" /> : all.length === 0 ? <p className="mt-2 text-[12px] text-muted-foreground">Nenhum pedido pago.</p> : filtered.length === 0 ? <p className="mt-2 text-[12px] text-muted-foreground">Nenhum pedido encontrado.</p> :
      <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
        {filtered.map((o) => {
          const sh = o.shipment;
          return <li key={o.id} className="grid gap-1.5 p-2.5 text-[12px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{o.order_number}</span>
              <span className="text-muted-foreground">{o.customer}</span>
              <span className={`ml-auto rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${!sh ? "bg-muted" : sh.send_status === "enviado" || sh.send_status === "manual" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>{sh ? SEND_LABEL[sh.send_status] ?? sh.send_status : "Não enviado"}</span>
            </div>
            <p className="truncate text-muted-foreground">{o.product}</p>
            {sh?.tracking_code && <p>Rastreio: <span className="font-mono font-semibold">{sh.tracking_code}</span></p>}
            {sh?.error && <p className="text-destructive">{sh.error}</p>}
            <div className="flex flex-wrap items-center gap-2">
              {(!sh || sh.send_status === "falhou") && <Button size="sm" variant="outline" className="h-7 rounded-full text-[11px]" disabled={!!busy || !cfg.data?.enabled} onClick={() => run(o.id, async () => {
                const r = await send({ data: { store_id: storeId, order_id: o.id, force: false } }); r.ok ? toast.success(r.message) : toast.error(r.message);
              })}>{sh ? "Tentar de novo" : "Enviar à Magnus"}</Button>}
              {sh?.send_status === "incerto" && <Button size="sm" variant="outline" className="h-7 rounded-full text-[11px]" disabled={!!busy} onClick={() => run(o.id, async () => {
                if (!confirm("A Magnus Frete pode já ter criado este envio. Confira no painel dela antes. Reenviar mesmo assim (pode duplicar)?")) return;
                const r = await send({ data: { store_id: storeId, order_id: o.id, force: true } }); r.ok ? toast.success(r.message) : toast.error(r.message);
              })}>Reenviar (conferi no painel)</Button>}
              {sh && <select aria-label="Status da entrega" value={sh.delivery_status} disabled={!!busy || sh.send_status === "enviando"} onChange={(e) => { const v = e.target.value; void run(o.id, async () => { await update({ data: { store_id: storeId, order_id: o.id, delivery_status: v as never } }); toast.success("Status atualizado."); }); }} className="h-7 rounded-md border border-input bg-background px-1 text-[11px]">
                {Object.entries(DELIVERY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>}
              {sh?.send_status !== "enviando" && <>
                <input value={codes[o.id] ?? ""} onChange={(e) => setCodes((c) => ({ ...c, [o.id]: e.target.value }))} placeholder={sh?.tracking_code ? "Corrigir código" : "Código manual"} className="h-7 w-32 rounded-md border border-input bg-background px-1.5 font-mono text-[11px]" />
                <Button size="sm" variant="ghost" className="h-7 text-[11px]" disabled={!!busy || !(codes[o.id] ?? "").trim()} onClick={() => run(o.id, async () => {
                  await update({ data: { store_id: storeId, order_id: o.id, tracking_code: codes[o.id]!.trim() } }); setCodes((c) => ({ ...c, [o.id]: "" })); toast.success("Código salvo.");
                })}>Salvar código</Button>
              </>}
            </div>
          </li>;
        })}
      </ul>;})()}
    </div>
  </section>;
}
