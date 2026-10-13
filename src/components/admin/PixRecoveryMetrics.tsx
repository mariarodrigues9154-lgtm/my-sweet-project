import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { brl } from "@/lib/format";
import { pixRecoveryMetrics } from "@/lib/admin.functions";
import { listPixRecoveryOrders, previewManualPixMessage, sendManualPixRecoveryMessage } from "@/lib/whatsapp-recovery.functions";

const COLS = [
  ["notices", "Avisos exibidos"],
  ["copies", "Códigos copiados"],
  ["chats", "Chats abertos"],
  ["renewed", "Novas cobranças"],
  ["recovered", "Pagamentos recuperados"],
] as const;
type MetricKey = (typeof COLS)[number][0];
const EVENT_OF: Record<Exclude<MetricKey, "recovered">, string> = { notices: "notice_shown", copies: "code_copied", chats: "chat_opened", renewed: "renewed" };
const ACTION: Record<string, string> = { notice_shown: "Viu o aviso", code_copied: "Copiou o código", chat_opened: "Abriu o chat", renewed: "Gerou nova cobrança" };
const STATE: Record<string, string> = { pendente: "PIX pendente", pago: "Pago", expirado: "Expirado", outro: "Outro" };
const FILTERS = [["todos", "Todos"], ["pendente", "PIX pendente"], ["pago", "Pago"], ["expirado", "Expirado"], ["enviada", "Mensagem enviada"], ["sem", "Sem mensagem"]] as const;

/** Métricas da recuperação de PIX pendente, separadas por loja. */
export function PixRecoveryMetricsPanel() {
  const load = useServerFn(pixRecoveryMetrics);
  const { data, isLoading } = useQuery({ queryKey: ["pix-recovery-metrics"], queryFn: () => load() });
  const [open, setOpen] = useState<{ store: string; metric: MetricKey | null } | null>(null);
  if (isLoading) return <div className="grid place-items-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  return (
    <section className="space-y-3">
      <p className="px-1 text-[12px] text-muted-foreground">Pagamento recuperado = pedido pago depois que o cliente viu o aviso, copiou o código, abriu o chat ou gerou uma nova cobrança. Toque em um card para ver os clientes.</p>
      {(data ?? []).map((s) => (
        <div key={s.store_id} className="rounded-xl bg-card p-4 shadow-card-soft">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="truncate text-[13.5px] font-extrabold">{s.name}</h2>
            <span className="shrink-0 text-[12px] font-bold text-success tnum">{brl(s.recovered_total)} recuperados</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {COLS.map(([k, label]) => {
              const active = open?.store === s.store_id && open.metric === k;
              return (
                <button key={k} type="button" onClick={() => setOpen(active ? { store: s.store_id, metric: null } : { store: s.store_id, metric: k })}
                  className={`rounded-lg p-2.5 text-left transition ${active ? "bg-primary text-primary-foreground" : "bg-surface hover:bg-muted"}`}>
                  <p className="text-[20px] font-extrabold tnum">{s[k]}</p>
                  <p className={`text-[11px] ${active ? "opacity-90" : "text-muted-foreground"}`}>{label}</p>
                </button>
              );
            })}
          </div>
          {open?.store === s.store_id ? (
            <OrdersList storeId={s.store_id} metric={open.metric} onClearMetric={() => setOpen({ store: s.store_id, metric: null })} onClose={() => setOpen(null)} />
          ) : (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setOpen({ store: s.store_id, metric: null })}>Ver clientes / PIX pendentes</Button>
          )}
        </div>
      ))}
      {!data?.length && <p className="text-[12.5px] text-muted-foreground">Nenhuma loja encontrada.</p>}
    </section>
  );
}

type Row = Awaited<ReturnType<typeof listPixRecoveryOrders>>[number];

function OrdersList({ storeId, metric, onClearMetric, onClose }: { storeId: string; metric: MetricKey | null; onClearMetric: () => void; onClose: () => void }) {
  const list = useServerFn(listPixRecoveryOrders);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["pix-recovery-orders", storeId], queryFn: () => list({ data: { store_id: storeId } }) });
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("todos");
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<Row | null>(null);

  const term = q.trim().toLowerCase();
  const rows = (data ?? []).filter((r) => {
    if (metric === "recovered" ? !r.recovered : metric ? !r.events.includes(EVENT_OF[metric]) : false) return false;
    if (filter === "enviada" && r.whatsapp?.status !== "enviada") return false;
    if (filter === "sem" && r.whatsapp) return false;
    if ((filter === "pendente" || filter === "pago" || filter === "expirado") && r.state !== filter) return false;
    if (term && !(r.customer.toLowerCase().includes(term) || r.order_number.toLowerCase().includes(term) || r.phone_digits_tail.includes(term.replace(/\D/g, "") || "§"))) return false;
    return true;
  });

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-extrabold">Clientes / PIX pendentes{metric && <span className="ml-1 font-semibold text-muted-foreground">· {COLS.find((c) => c[0] === metric)?.[1]}</span>}</h3>
        <div className="flex gap-1">
          {metric && <Button variant="ghost" size="sm" onClick={onClearMetric}>Limpar card</Button>}
          <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <select value={filter} onChange={(e) => setFilter(e.target.value as never)} className="rounded-lg border border-input bg-card px-3 py-2 text-[12px]">
          {FILTERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome, pedido ou telefone" className="min-w-[180px] flex-1 rounded-lg border border-input bg-card px-3 py-2 text-[12px]" />
      </div>

      {isLoading ? <div className="grid place-items-center py-6"><Loader2 className="animate-spin text-muted-foreground" /></div>
        : !rows.length ? <p className="py-4 text-[12px] text-muted-foreground">Nenhum pedido encontrado.</p>
        : (
          <>
            {/* Desktop */}
            <div className="mt-3 hidden overflow-x-auto md:block">
              <table className="w-full text-[11.5px]">
                <thead className="text-left text-muted-foreground">
                  <tr>{["Cliente", "Pedido", "WhatsApp", "Valor", "Produto", "Data", "Status", "Última ação", "Mensagem", ""].map((h) => <th key={h} className="px-2 py-1.5 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.id} className="align-top">
                      <td className="px-2 py-2 font-bold">{r.customer || "—"}</td>
                      <td className="px-2 py-2 tnum">#{r.order_number}</td>
                      <td className="px-2 py-2 tnum">{r.phone}</td>
                      <td className="px-2 py-2 tnum">{brl(r.total)}</td>
                      <td className="max-w-[140px] truncate px-2 py-2">{r.product}</td>
                      <td className="px-2 py-2 tnum">{fmt(r.created_at)}</td>
                      <td className="px-2 py-2"><StateBadge s={r.state} /></td>
                      <td className="px-2 py-2">{r.last_action ? `${ACTION[r.last_action.type] ?? r.last_action.type} · ${fmt(r.last_action.at)}` : "—"}</td>
                      <td className="px-2 py-2"><WaStatus r={r} /></td>
                      <td className="px-2 py-2"><Actions r={r} onSend={() => setTarget(r)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <ul className="mt-3 space-y-2 md:hidden">
              {rows.map((r) => (
                <li key={r.id} className="rounded-lg bg-surface p-3 text-[12px]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-extrabold">{r.customer || "—"}</p>
                      <p className="text-muted-foreground">Pedido #{r.order_number} · {r.phone}</p>
                    </div>
                    <StateBadge s={r.state} />
                  </div>
                  <p className="mt-1 truncate">{r.product}</p>
                  <p className="font-bold tnum">{brl(r.total)} <span className="font-normal text-muted-foreground">· {fmt(r.created_at)}</span></p>
                  {r.last_action && <p className="text-muted-foreground">{ACTION[r.last_action.type] ?? r.last_action.type} · {fmt(r.last_action.at)}</p>}
                  <div className="mt-1"><WaStatus r={r} /></div>
                  <div className="mt-2"><Actions r={r} onSend={() => setTarget(r)} /></div>
                </li>
              ))}
            </ul>
          </>
        )}
      {target && <SendDialog row={target} onClose={() => setTarget(null)} onSent={() => { setTarget(null); void refetch(); }} />}
    </div>
  );
}

function Actions({ r, onSend }: { r: Row; onSend: () => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {r.state === "pendente" && <Button size="sm" onClick={onSend}>{r.whatsapp?.status === "falha" ? "Tentar novamente" : "Enviar WhatsApp"}</Button>}
      <Button size="sm" variant="outline" asChild><Link to="/admin/pedidos">Ver pedido</Link></Button>
    </div>
  );
}

function WaStatus({ r }: { r: Row }) {
  if (!r.whatsapp) return <span className="text-muted-foreground">Sem mensagem</span>;
  const w = r.whatsapp;
  if (w.status === "enviada") return <span className="text-success">✅ Enviado {w.manual ? "(manual) " : ""}{ago(w.at)}</span>;
  if (w.status === "falha") return <span className="text-destructive">❌ Falha no envio</span>;
  return <span className="text-muted-foreground">{w.status === "nao_enviada" ? "Não enviada" : w.status}</span>;
}

function StateBadge({ s }: { s: string }) {
  const cls = s === "pago" ? "bg-success/15 text-success" : s === "pendente" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground";
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${cls}`}>{STATE[s] ?? s}</span>;
}

function SendDialog({ row, onClose, onSent }: { row: Row; onClose: () => void; onSent: () => void }) {
  const preview = useServerFn(previewManualPixMessage);
  const send = useServerFn(sendManualPixRecoveryMessage);
  const { data, isLoading } = useQuery({ queryKey: ["pix-manual-preview", row.id], queryFn: () => preview({ data: { order_id: row.id } }), staleTime: 0 });
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const r = await send({ data: { order_id: row.id } });
      if (r.ok) { toast.success("✅ Mensagem enviada com sucesso"); onSent(); } else toast.error(r.error);
    } catch { toast.error("Não foi possível enviar. Tente novamente."); }
    finally { setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Enviar mensagem para {row.customer.split(" ")[0] || "o cliente"} no WhatsApp?</DialogTitle></DialogHeader>
        {row.whatsapp?.status === "enviada" && <p className="rounded-lg bg-surface p-2 text-[12px]">Última mensagem: enviada {ago(row.whatsapp.at)}.</p>}
        {isLoading ? <div className="grid place-items-center py-6"><Loader2 className="animate-spin text-muted-foreground" /></div>
          : data && !data.ok ? <p className="text-[12.5px] text-destructive">{data.error}</p>
          : data?.ok && (
            <div>
              <p className="text-[11.5px] font-semibold text-muted-foreground">Mensagem que será enviada:</p>
              <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-surface p-3 font-sans text-[12.5px]">{data.text}</pre>
              {!data.has_phone && <p className="mt-2 text-[12px] text-destructive">Telefone do cliente inválido.</p>}
              {data.expired && <p className="mt-2 text-[12px] text-destructive">Este PIX expirou.</p>}
            </div>
          )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={go} disabled={busy || !data?.ok || !data.has_phone || data.expired}>{busy ? <Loader2 className="animate-spin" /> : "Enviar agora"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}
function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  if (m < 1440) return `há ${Math.round(m / 60)} h`;
  return `em ${fmt(iso)}`;
}
