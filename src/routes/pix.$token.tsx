import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PixQr } from "@/components/checkout/PixQr";
import { brl } from "@/lib/format";
import { getPixOrders, renewExpiredPixOrder } from "@/lib/pix-recovery.functions";

export const Route = createFileRoute("/pix/$token")({
  head: () => ({
    meta: [
      { title: "Pagamento PIX do seu pedido" },
      { name: "description", content: "Veja e pague o PIX do seu pedido com segurança." },
      { property: "og:title", content: "Pagamento PIX do seu pedido" },
      { property: "og:description", content: "Veja e pague o PIX do seu pedido com segurança." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PixPage,
});

function PixPage() {
  const { token: initial } = Route.useParams();
  const [token, setToken] = useState(initial);
  const load = useServerFn(getPixOrders);
  const renew = useServerFn(renewExpiredPixOrder);
  const [busy, setBusy] = useState(false);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["pix-direct", token],
    queryFn: () => load({ data: { tokens: [token], direct: true } }),
    refetchInterval: (q) => (q.state.data?.[0]?.state === "pendente" ? 8000 : false),
  });
  const o = data?.[0];

  return (
    <main className="mx-auto max-w-[460px] space-y-3 px-4 py-6">
      {isLoading && <div className="grid min-h-[50vh] place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div>}
      {!isLoading && !o && <p className="py-10 text-center text-[14px] font-bold">Pedido não encontrado.</p>}
      {o && (
        <div className="rounded-xl bg-card p-4 shadow-card-soft">
          <p className="text-[12px] text-muted-foreground">{o.store.name} · Pedido #{o.order_number}</p>
          <div className="mt-2 flex gap-3">
            {o.product.image && <img src={o.product.image} alt="" className="h-16 w-16 rounded-lg object-cover" />}
            <div><p className="text-[13.5px] font-bold">{o.product.title}</p><p className="text-[18px] font-extrabold text-primary tnum">{brl(o.total)}</p></div>
          </div>
          {o.state === "pago" && <p className="mt-4 rounded-lg bg-surface p-3 text-center text-[14px] font-extrabold text-success">Pagamento confirmado! Obrigado.</p>}
          {o.state === "pendente" && o.copy_paste && (
            <div className="mt-4 space-y-3">
              <PixQr code={o.copy_paste} fallback={o.qr_code} className="mx-auto w-[220px]" />
              <p className="break-all rounded-lg bg-surface p-2 text-[11px]">{o.copy_paste}</p>
              <Button className="w-full" onClick={() => { navigator.clipboard.writeText(o.copy_paste!); toast.success("Código PIX copiado."); }}>Copiar código PIX</Button>
              <Button variant="outline" className="w-full" disabled={isFetching} onClick={() => refetch()}>Já paguei — verificar status</Button>
            </div>
          )}
          {o.state === "expirado" && (
            <div className="mt-4 space-y-3">
              <p className="text-[13px]">Este PIX expirou. Gere uma nova cobrança com o mesmo pedido:</p>
              <Button className="w-full" disabled={busy} onClick={async () => {
                setBusy(true);
                try { const r = await renew({ data: { token } }); if (r.ok) setToken(r.token); else toast.error(r.error); }
                finally { setBusy(false); }
              }}>{busy ? <Loader2 className="animate-spin" /> : "Gerar nova cobrança PIX"}</Button>
            </div>
          )}
          {o.state === "outro" && <p className="mt-4 text-[13px]">Este pedido não está mais aguardando pagamento.</p>}
        </div>
      )}
    </main>
  );
}
