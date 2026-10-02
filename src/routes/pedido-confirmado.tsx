import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { z } from "zod";

import { StoreLogo } from "@/components/store/StoreHeader";
import { brl, deliveryWindow } from "@/lib/format";
import type { OrderSummary } from "@/lib/product-types";
import { getOrder, getStoreSettings } from "@/lib/store.functions";
import { checkoutTheme } from "@/lib/checkout-theme";
import { trackPurchase, useMetaPageView } from "@/lib/meta-pixel";

const searchSchema = z.object({ pedido: z.string().optional() });

export const Route = createFileRoute("/pedido-confirmado")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ pedido: search.pedido }),
  loader: async ({ deps }) => {
    const [store, order] = await Promise.all([
      getStoreSettings(deps.pedido ? { data: { orderNumber: deps.pedido } } : undefined),
      deps.pedido ? getOrder({ data: { order_number: deps.pedido } }) : Promise.resolve(null),
    ]);
    return { store: store!, order };
  },
  head: () => ({
    meta: [
      { title: "Pedido confirmado | Obrigado pela compra" },
      { name: "description", content: "Seu pedido foi recebido com sucesso e já está em preparação." },
      { property: "og:title", content: "Pedido confirmado" },
      { property: "og:description", content: "Seu pedido foi recebido com sucesso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <p className="text-[14px] text-muted-foreground">Não conseguimos carregar o pedido agora.</p>
    </div>
  ),
  component: Confirmed,
});

function Confirmed() {
  const data = Route.useLoaderData();
  const store = data.store;
  const order = data.order as OrderSummary | null;
  useMetaPageView(store.id || null, () => {
    if (order && order.status === "pago") void trackPurchase(store.id, { order_number: order.order_number, total: order.total, quantity: order.quantity, unit_price: order.unit_price, product_id: (order as { product_id?: string | null }).product_id ?? null });
  });


  return (
    <div className="min-h-screen bg-surface" style={checkoutTheme(store)}>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-[520px] items-center px-4">
          <StoreLogo store={{ ...store, logo_url: store.checkout?.logo_url || store.logo_url }} />
        </div>
      </header>

      <main className="mx-auto max-w-[520px] space-y-2 px-3 py-4">
        <section className="rounded-xl bg-card p-5 text-center shadow-card-soft">
          <CheckCircle2 size={44} className="mx-auto text-success" />
          <h1 className="mt-3 text-[19px] font-extrabold">Pagamento aprovado</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Seu pedido foi recebido com sucesso.
          </p>
          {order && (
            <p className="mt-3 inline-block rounded-full bg-surface px-3 py-1.5 text-[12px] font-bold">
              Pedido {order.order_number}
            </p>
          )}
        </section>

        {order ? (
          <section className="space-y-2 rounded-xl bg-card p-3.5 text-[12.5px] shadow-card-soft">
            <h2 className="text-[13px] font-extrabold">Resumo</h2>
            <Row label="Produto" value={order.product_snapshot?.title ?? "—"} />
            <Row label="Quantidade" value={String(order.quantity)} />
            <Row label="Subtotal" value={brl(order.subtotal)} />
            <Row
              label={`Frete${order.shipping_label ? ` (${order.shipping_label})` : ""}`}
              value={order.shipping_price > 0 ? brl(order.shipping_price) : "Grátis"}
            />
            <Row label="Total" value={brl(order.total)} />
            <Row label="E-mail" value={order.customer?.email ?? "—"} />
            <Row
              label="Endereço"
              value={
                order.address["street"]
                  ? `${order.address["street"]}, ${order.address["number"]} · ${order.address["district"]} · ${order.address["city"]}/${order.address["state"]} · ${order.address["cep"]}`
                  : "—"
              }

            />
            <Row label="Prazo estimado" value={`Entrega entre ${deliveryWindow(4, 9)}`} />
          </section>
        ) : (
          <section className="rounded-xl bg-card p-3.5 text-center text-[12.5px] text-muted-foreground shadow-card-soft">
            Informe o número do pedido no endereço para ver o resumo completo.
          </section>
        )}

        <Link
          to="/"
          className="block rounded-full cta-gradient py-3.5 text-center text-[14px] font-extrabold text-primary-foreground shadow-cta-glow"
        >
          Voltar para a loja
        </Link>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border pb-1.5 last:border-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right font-semibold">{value}</span>
    </div>
  );
}
