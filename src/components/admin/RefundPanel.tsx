import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";

import { brl } from "@/lib/format";
import { listOrderRefunds, refreshRefunds, requestRefund } from "@/lib/refunds.functions";

const LABEL: Record<string, string> = {
  solicitado: "Solicitado",
  processando: "Em processamento",
  concluido: "Concluído",
  falhou: "Falhou",
  manual: "Fazer no provedor",
};

export function RefundPanel({ orderNumber, onChanged }: { orderNumber: string; onChanged: () => void }) {
  const list = useServerFn(listOrderRefunds);
  const request = useServerFn(requestRefund);
  const refresh = useServerFn(refreshRefunds);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["refunds", orderNumber], queryFn: () => list({ data: { order_number: orderNumber } }) });
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (isLoading || !data) return <div className="py-3"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>;

  const canRefund = (data.order_status === "pago" || data.order_status === "reembolso_parcial") && data.available_cents > 0;

  async function submit() {
    const cents = Math.round(Number(amount.replace(/\./g, "").replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents <= 0) return setMsg("Informe um valor válido.");
    if (!confirm(`Confirmar reembolso de ${brl(cents / 100)}?`)) return;
    setBusy(true); setMsg(null);
    try {
      const r = await request({ data: { order_number: orderNumber, amount_cents: cents, ...(reason ? { reason } : {}) } });
      setMsg(r.ok ? (r.manual ? "Registrado. Este provedor não faz estorno automático: conclua no painel dele." : "Reembolso enviado ao provedor.") : r.error);
      if (r.ok) { setAmount(""); setReason(""); onChanged(); }
      await refetch();
    } finally { setBusy(false); }
  }

  async function update() {
    setBusy(true);
    try { await refresh({ data: { order_number: orderNumber } }); await refetch(); onChanged(); } finally { setBusy(false); }
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-bold">Reembolso PIX · disponível {brl(data.available_cents / 100)}</p>
        <button type="button" onClick={update} disabled={busy} className="inline-flex items-center gap-1 text-[11.5px] font-bold text-primary disabled:opacity-50">
          <RefreshCw className="size-3.5" /> Atualizar
        </button>
      </div>
      {canRefund ? (
        <div className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)_auto]">
          <input inputMode="decimal" placeholder="Valor (R$)" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-lg border border-input bg-card px-3 py-2 text-[13px]" />
          <input placeholder="Motivo (opcional)" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-lg border border-input bg-card px-3 py-2 text-[13px]" />
          <div className="flex gap-2">
            <button type="button" onClick={() => setAmount((data.available_cents / 100).toFixed(2).replace(".", ","))} className="rounded-full border border-border px-3 py-2 text-[12px] font-bold">Total</button>
            <button type="button" onClick={submit} disabled={busy} className="rounded-full bg-primary px-4 py-2 text-[12px] font-extrabold text-primary-foreground disabled:opacity-50">Reembolsar</button>
          </div>
        </div>
      ) : (
        <p className="text-[11.5px] text-muted-foreground">Reembolso disponível apenas para pedidos pagos com saldo a devolver.</p>
      )}
      {msg && <p className="text-[11.5px] font-bold">{msg}</p>}
      {data.refunds.length > 0 && (
        <ul className="divide-y divide-border">
          {data.refunds.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-2 py-1.5 text-[11.5px]">
              <div className="min-w-0">
                <p className="font-bold">{brl(r.amount_cents / 100)} · {new Date(r.created_at).toLocaleString("pt-BR")}</p>
                {r.reason && <p className="truncate text-muted-foreground">{r.reason}</p>}
                {r.error && r.status !== "concluido" && <p className="text-muted-foreground">{r.error}</p>}
              </div>
              <span className={`shrink-0 font-extrabold ${r.status === "concluido" ? "text-success" : r.status === "falhou" ? "text-destructive" : ""}`}>{LABEL[r.status] ?? r.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
