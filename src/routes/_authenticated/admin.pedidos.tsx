import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

import { adminOverview, listAdminOrders } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos | Administração" },
      { name: "description", content: "Acompanhe todos os pedidos e vendas com filtros por loja, status e data." },
      { property: "og:title", content: "Pedidos" },
      { property: "og:description", content: "Todos os pedidos das lojas com filtros." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error }: { error: unknown }) => <p className="p-6 text-center text-[14px] font-bold">{error instanceof Error ? error.message : "Erro ao carregar."}</p>,
  component: OrdersPage,
});

const STATUS: Record<string, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  pago: "Pago",
  reembolso_parcial: "Reembolso parcial",
  reembolsado: "Reembolsado",
  cancelado: "Cancelado",
  expirado: "Expirado",
};
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PAID = new Set(["pago", "reembolso_parcial"]);

function OrdersPage() {
  const list = useServerFn(listAdminOrders);
  const overview = useServerFn(adminOverview);
  const [storeId, setStoreId] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data: ov } = useQuery({ queryKey: ["admin-overview"], queryFn: () => overview() });
  const stores = ov?.stores ?? [];
  const storeName = (id: string | null) => stores.find((s) => s.id === id)?.name ?? "—";
  const { data = [], isFetching, error } = useQuery({
    queryKey: ["admin-orders", storeId, status, from, to],
    queryFn: () => list({ data: { store_id: storeId, status, from, to } }),
  });
  const summary = useMemo(() => {
    const paid = data.filter((o) => PAID.has(o.status));
    return { count: data.length, paid: paid.length, revenue: paid.reduce((s, o) => s + o.total, 0), pending: data.filter((o) => o.status === "aguardando_pagamento").length };
  }, [data]);
  const input = "rounded-lg border border-input bg-card px-3 py-2 text-[12.5px]";

  return (
    <main className="mx-auto max-w-[1000px] space-y-3 px-3 py-4">
      <Link to="/admin" search={{ aba: "pedidos" }} className="inline-flex items-center gap-1 text-[12.5px] font-bold text-primary"><ChevronLeft size={16} /> Voltar</Link>
      <section className="rounded-xl bg-card p-4 shadow-card-soft">
        <h1 className="text-[15px] font-extrabold">Todos os pedidos</h1>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <label className="text-[11px] font-semibold text-muted-foreground">Loja
            <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className={`mt-1 w-full ${input}`}>
              <option value="">Todas as lojas</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-semibold text-muted-foreground">Status
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={`mt-1 w-full ${input}`}>
              <option value="">Todos</option>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-semibold text-muted-foreground">De
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`mt-1 w-full ${input}`} />
          </label>
          <label className="text-[11px] font-semibold text-muted-foreground">Até
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`mt-1 w-full ${input}`} />
          </label>
        </div>
        {(storeId || status || from || to) && <button type="button" onClick={() => { setStoreId(""); setStatus(""); setFrom(""); setTo(""); }} className="mt-2 text-[12px] font-bold text-primary">Limpar filtros</button>}
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["Pedidos", String(summary.count)], ["Pagos", String(summary.paid)], ["Aguardando", String(summary.pending)], ["Vendido (pagos)", brl(summary.revenue)]].map(([l, v]) => (
          <div key={l} className="rounded-xl bg-card p-3 shadow-card-soft"><p className="text-[11px] text-muted-foreground">{l}</p><p className="text-[16px] font-bold">{v}</p></div>
        ))}
      </section>

      <section className="rounded-xl bg-card p-2 shadow-card-soft">
        {isFetching && <div className="grid place-items-center p-6"><Loader2 className="animate-spin text-muted-foreground" /></div>}
        {error && <p className="p-4 text-[13px] font-bold">{error.message}</p>}
        {!isFetching && data.length === 0 && <p className="p-4 text-[13px] text-muted-foreground">Nenhum pedido encontrado com esses filtros.</p>}
        <ul className="divide-y divide-border">
          {data.map((o) => (
            <li key={o.order_number} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-[12.5px]">
              <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${PAID.has(o.status) ? "bg-success/15 text-success" : o.status === "aguardando_pagamento" ? "bg-muted text-muted-foreground" : "bg-destructive/15 text-destructive"}`}>{STATUS[o.status] ?? o.status}</span>
              <span className="font-semibold">{o.order_number}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{o.product_title} · {o.quantity}x · {o.customer_name}</span>
              <span className="font-semibold">{brl(o.total)}</span>
              <span className="w-full text-[11px] text-muted-foreground">{storeName(o.store_id)} · {new Date(o.created_at).toLocaleString("pt-BR")}{o.paid_at ? ` · pago em ${new Date(o.paid_at).toLocaleString("pt-BR")}` : ""}{o.customer_email ? ` · ${o.customer_email}` : ""}</span>
            </li>
          ))}
        </ul>
        {data.length >= 1000 && <p className="p-3 text-[11px] text-muted-foreground">Mostrando os 1000 mais recentes. Use os filtros para refinar.</p>}
      </section>
    </main>
  );
}
