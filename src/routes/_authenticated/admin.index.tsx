import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { brl } from "@/lib/format";
import { adminOverview } from "@/lib/admin.functions";
import { ProductManager } from "@/components/admin/ProductManager";
import { ReviewsList, StoresList } from "@/components/admin/AdminLists";
import { RefundPanel } from "@/components/admin/RefundPanel";

const TABS = [
  ["lojas", "Lojas"],
  ["produtos", "Produtos"],
  ["avaliacoes", "Avaliações"],
  ["pedidos", "Pedidos"],
] as const;
type Tab = (typeof TABS)[number][0];

export const Route = createFileRoute("/_authenticated/admin/")({
  validateSearch: (search: Record<string, unknown>): { aba?: Tab } => {
    const aba = search["aba"];
    return TABS.some(([key]) => key === aba) ? { aba: aba as Tab } : {};
  },
  head: () => ({
    meta: [
      { title: "Administração | Lojas, produtos e avaliações" },
      { name: "description", content: "Gerencie todas as lojas, produtos, avaliações e pedidos em um só lugar." },
      { property: "og:title", content: "Administração das lojas" },
      { property: "og:description", content: "Gerencie lojas, produtos, avaliações e pedidos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error }: { error: unknown }) => (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <p className="text-[14px] font-bold">{error instanceof Error ? error.message : "Erro ao carregar."}</p>
        <Link to="/" className="mt-3 inline-block text-[13px] font-bold text-primary">Voltar para a loja</Link>
      </div>
    </div>
  ),
  component: AdminHome,
});

function AdminHome() {
  const { aba = "lojas" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const load = useServerFn(adminOverview);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["admin-overview"], queryFn: () => load() });
  const [orderFilter, setOrderFilter] = useState("");
  const [openRefund, setOpenRefund] = useState<string | null>(null);

  if (isLoading) {
    return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;
  }
  if (error || !data) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-6 text-center">
        <p className="max-w-sm text-[14px] font-bold">
          Acesso restrito ao administrador. A primeira conta criada é a administradora; outras contas não têm acesso.
        </p>
      </div>
    );
  }

  const stores = data.stores.map((s) => ({ id: s.id, name: s.name }));
  const reviewCount = data.products.reduce((n, p) => n + p.reviews.length, 0);
  const counts: Record<Tab, number> = { lojas: data.stores.length, produtos: data.products.length, avaliacoes: reviewCount, pedidos: data.orders.length };
  const orders = data.orders.filter((o) => !orderFilter || o.store_id === orderFilter);

  return (
    <main className="mx-auto max-w-[1000px] space-y-3 px-3 py-4">
      <nav className="flex gap-1 overflow-x-auto rounded-full bg-card p-1 shadow-card-soft">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => void navigate({ search: { aba: key }, replace: true })}
            className={`shrink-0 rounded-full px-4 py-2 text-[12.5px] font-extrabold ${aba === key ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {label} <span className="opacity-70">({counts[key]})</span>
          </button>
        ))}
      </nav>

      {aba === "lojas" && <StoresList stores={data.stores} onChanged={refetch} />}
      {aba === "produtos" && <ProductManager products={data.products} stores={stores} onChanged={refetch} />}
      {aba === "avaliacoes" && <ReviewsList products={data.products} stores={stores} onChanged={refetch} />}
      {aba === "pedidos" && (
        <section className="rounded-xl bg-card p-4 shadow-card-soft">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[13px] font-extrabold">Pedidos recentes</h2>
            <Link to="/admin/pedidos" className="rounded-full bg-primary px-3 py-1.5 text-[12px] font-bold text-primary-foreground">Ver todos os pedidos e filtros</Link>
            {stores.length > 1 && (
              <select value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)} className="rounded-lg border border-input bg-card px-3 py-2 text-[12.5px]">
                <option value="">Todas as lojas</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>
          {orders.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-muted-foreground">Nenhum pedido registrado ainda.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {orders.map((order) => (
                <li key={order.order_number} className="py-2.5">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold">{order.order_number}</p>
                    <p className="truncate text-[11.5px] text-muted-foreground">
                      {order.customer?.name ?? "—"} · {order.product_snapshot?.title ?? "—"} · {order.quantity} un.
                    </p>
                    {order.payment_provider && (
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className={`rounded px-1.5 py-0.5 font-bold ${pixBadge(order.provider_status).cls}`}>PIX {pixBadge(order.provider_status).label}</span>
                        {order.payment_url && (
                          <a href={order.payment_url} target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline">Link da Wappi</a>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[13px] font-extrabold tnum">{brl(order.total)}</p>
                    <p className="text-[11px] uppercase text-muted-foreground">{order.status.replace(/_/g, " ")}</p>
                    {["pago", "reembolso_parcial", "reembolsado"].includes(order.status) && (
                      <button type="button" onClick={() => setOpenRefund(openRefund === order.order_number ? null : order.order_number)} className="text-[11.5px] font-bold text-primary">
                        {openRefund === order.order_number ? "Fechar" : "Reembolso"}
                      </button>
                    )}
                  </div>
                  </div>
                  {openRefund === order.order_number && <RefundPanel orderNumber={order.order_number} onChanged={refetch} />}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}

function pixBadge(status: string | null): { label: string; cls: string } {
  const s = (status ?? "").toLowerCase();
  if (s === "paid" || s === "confirmed") return { label: "CONFIRMED", cls: "bg-success/15 text-success" };
  if (["refused", "expired", "error", "cancelled", "canceled", "refunded", "chargeback"].includes(s)) return { label: "CANCELLED", cls: "bg-destructive/15 text-destructive" };
  return { label: "PENDING", cls: "bg-muted text-muted-foreground" };
}
