import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { brl } from "@/lib/format";
import { pixRecoveryMetrics } from "@/lib/admin.functions";

const COLS = [
  ["notices", "Avisos exibidos"],
  ["copies", "Códigos copiados"],
  ["chats", "Chats abertos"],
  ["renewed", "Novas cobranças"],
  ["recovered", "Pagamentos recuperados"],
] as const;

/** Métricas da recuperação de PIX pendente, separadas por loja. */
export function PixRecoveryMetricsPanel() {
  const load = useServerFn(pixRecoveryMetrics);
  const { data, isLoading } = useQuery({ queryKey: ["pix-recovery-metrics"], queryFn: () => load() });
  if (isLoading) return <div className="grid place-items-center py-10"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  return (
    <section className="space-y-3">
      <p className="px-1 text-[12px] text-muted-foreground">Pagamento recuperado = pedido pago depois que o cliente viu o aviso, copiou o código, abriu o chat ou gerou uma nova cobrança.</p>
      {(data ?? []).map((s) => (
        <div key={s.store_id} className="rounded-xl bg-card p-4 shadow-card-soft">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="truncate text-[13.5px] font-extrabold">{s.name}</h2>
            <span className="shrink-0 text-[12px] font-bold text-success tnum">{brl(s.recovered_total)} recuperados</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {COLS.map(([k, label]) => (
              <div key={k} className="rounded-lg bg-surface p-2.5">
                <p className="text-[20px] font-extrabold tnum">{s[k]}</p>
                <p className="text-[11px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
      {!data?.length && <p className="text-[12.5px] text-muted-foreground">Nenhuma loja encontrada.</p>}
    </section>
  );
}
