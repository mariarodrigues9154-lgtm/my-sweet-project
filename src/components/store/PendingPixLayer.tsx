import { useEffect, useState } from "react";
import { useRouterState, Link } from "@tanstack/react-router";
import { Check, ChevronLeft, Copy, MessageCircle, X } from "lucide-react";

import { brl } from "@/lib/format";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";

import { forgetPixOrders, openOrderChat, rememberPixOrder, useStorePixOrders } from "@/lib/pix-orders";
import { renewExpiredPixOrder } from "@/lib/pix-recovery.functions";
import type { PixOrderView } from "@/lib/pix-recovery.functions";

const HIDDEN = /^\/(pagamento|admin|auth|reset-password|pedido-confirmado)/;
const STATE_LABEL: Record<PixOrderView["state"], string> = {
  pendente: "Aguardando pagamento",
  pago: "Pagamento confirmado",
  expirado: "Este PIX expirou",
  outro: "Pedido atualizado",
};

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(o: PixOrderView) {
    if (!o.copy_paste || o.state !== "pendente") return;
    try { await navigator.clipboard.writeText(o.copy_paste); } catch {
      const t = document.createElement("textarea"); t.value = o.copy_paste; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
    }
    setCopied(o.token);
    window.setTimeout(() => setCopied(null), 2500);
  }
  return { copied, copy };
}

/** Aviso flutuante + chat do pedido para recuperar o PIX depois de sair do checkout. */
export function PendingPixLayer() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { orders, pending } = useStorePixOrders();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [chat, setChat] = useState<{ open: boolean; token: string | null }>({ open: false, token: null });
  const { copied, copy } = useCopy();

  useEffect(() => {
    setDismissed(Object.keys(window.sessionStorage).filter((k) => k.startsWith("loja:pix-dismiss:")).map((k) => k.slice(17)));
    const open = (e: Event) => setChat({ open: true, token: (e as CustomEvent<string | null>).detail });
    window.addEventListener("loja:open-order-chat", open);
    return () => window.removeEventListener("loja:open-order-chat", open);
  }, []);

  if (HIDDEN.test(path)) return null;
  const card = pending.find((o) => o.store.pix.show_notice && !dismissed.includes(o.token));

  return (
    <>
      {card && !chat.open && (
        <div className="fixed inset-x-0 top-14 z-40 px-3">
          <div className="relative mx-auto max-w-[480px] rounded-2xl border border-border bg-card p-3 shadow-sheet-up">
            <button type="button" aria-label="Fechar aviso" onClick={() => { window.sessionStorage.setItem(`loja:pix-dismiss:${card.token}`, "1"); setDismissed((d) => [...d, card.token]); }} className="absolute right-2 top-2 grid size-7 place-items-center text-muted-foreground"><X size={16} /></button>
            <div className="flex items-start gap-2.5 pr-6">
              <StoreAvatar o={card} />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold">{card.store.pix.title}</p>
                <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">Seu pedido #{card.order_number} foi criado, mas o pagamento via PIX ainda está <span className="font-semibold text-primary">PENDENTE</span>.</p>
              </div>
            </div>
            <div className={`mt-2.5 grid gap-2 ${card.store.pix.allow_copy && card.store.pix.allow_chat ? "grid-cols-2" : "grid-cols-1"}`}>
              {card.store.pix.allow_copy && <button type="button" onClick={() => void copy(card)} className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary text-[12.5px] font-medium text-primary-foreground">
                {copied === card.token ? <><Check size={15} /> Código PIX copiado!</> : <><Copy size={15} /> {card.store.pix.copy_label}</>}
              </button>}
              {card.store.pix.allow_chat && <button type="button" onClick={() => setChat({ open: true, token: card.token })} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border text-[12.5px] font-medium">
                <MessageCircle size={15} /> {card.store.pix.chat_label}
              </button>}
            </div>
          </div>
        </div>
      )}
      {chat.open && <OrderChat orders={orders.filter((o) => o.store.pix.allow_chat)} token={chat.token} onPick={(t) => setChat({ open: true, token: t })} onClose={() => setChat({ open: false, token: null })} copied={copied} copy={copy} />}
    </>
  );
}

function StoreAvatar({ o }: { o: PixOrderView }) {
  const src = o.store.avatar_url || o.store.logo_url;
  return src
    ? <img src={src} alt={o.store.name} className="size-9 shrink-0 rounded-full border border-border bg-card object-contain" />
    : <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-[13px] font-semibold text-primary">{o.store.name.slice(0, 1)}</span>;
}

function OrderChat({ orders, token, onPick, onClose, copied, copy }: { orders: PixOrderView[]; token: string | null; onPick: (t: string | null) => void; onClose: () => void; copied: string | null; copy: (o: PixOrderView) => Promise<void> }) {
  const current = orders.find((o) => o.token === token) ?? (orders.length === 1 ? orders[0] : undefined);
  const storeName = orders[0]?.store.name ?? "Loja";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/35 sm:items-center sm:p-3" onClick={onClose}>
      <section className="flex max-h-[88dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-2xl bg-card shadow-sheet-up sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-3 py-2.5">
          {current && orders.length > 1 ? <button type="button" aria-label="Voltar" onClick={() => onPick(null)} className="grid size-8 place-items-center"><ChevronLeft size={20} /></button> : current ? <StoreAvatar o={current} /> : <span />}
          <div className="min-w-0"><p className="truncate text-[14px] font-semibold">{storeName}</p><p className="text-[11px] text-muted-foreground">{current ? `Pedido #${current.order_number}` : "Mensagens dos seus pedidos"}</p></div>
          <button type="button" onClick={onClose} aria-label="Fechar conversa" className="grid size-8 place-items-center"><X size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto bg-surface p-3">
          {!orders.length && <p className="py-10 text-center text-[13px] text-muted-foreground">Nenhuma mensagem por aqui.</p>}
          {!current && orders.map((o) => (
            <button key={o.token} type="button" onClick={() => onPick(o.token)} className="mb-2 flex w-full items-center gap-3 rounded-xl bg-card p-3 text-left shadow-card-soft">
              {o.product.image ? <img src={o.product.image} alt="" className="size-11 rounded-lg object-cover" /> : <span className="size-11 rounded-lg bg-muted" />}
              <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">Pedido #{o.order_number}</span><span className="block truncate text-[12px] text-muted-foreground">{o.product.title}</span></span>
              <span className={`shrink-0 text-[11.5px] font-medium ${o.state === "pago" ? "text-success" : o.state === "pendente" ? "text-primary" : "text-muted-foreground"}`}>{o.state === "pendente" ? "Aguardando PIX" : o.state === "pago" ? "Pago" : o.state === "expirado" ? "Expirado" : "Atualizado"}</span>
            </button>
          ))}
          {current && <Thread o={current} copied={copied} copy={copy} onClose={onClose} onRenewed={onPick} />}
        </div>
      </section>
    </div>
  );
}

function Thread({ o, copied, copy, onClose, onRenewed }: { o: PixOrderView; copied: string | null; copy: (o: PixOrderView) => Promise<void>; onClose: () => void; onRenewed: (t: string | null) => void }) {
  const renew = useServerFn(renewExpiredPixOrder);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function regenerate() {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const r = await renew({ data: { token: o.token } });
      if (!r.ok) { setErr(r.error); return; }
      rememberPixOrder(r.token, r.store_id);
      forgetPixOrders([o.token]);
      await qc.invalidateQueries({ queryKey: ["pix-orders"] });
      onRenewed(r.token);
    } catch { setErr("Não foi possível gerar o novo PIX. Tente novamente."); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-2">
      <p className="text-center text-[11px] text-muted-foreground">{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(o.created_at))}</p>
      <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-card p-3 text-[13px] leading-relaxed shadow-card-soft">
        {o.state === "pendente" && <p>Seu pedido <strong className="font-semibold">#{o.order_number}</strong> foi criado, mas o pagamento via PIX ainda está <strong className="font-semibold text-primary">PENDENTE</strong>.</p>}
        {o.state === "pago" && <p>Pagamento do pedido <strong className="font-semibold">#{o.order_number}</strong> confirmado! Obrigado pela compra, já estamos preparando o envio.</p>}
        {o.state === "expirado" && <p>O PIX do pedido <strong className="font-semibold">#{o.order_number}</strong> expirou e não pode mais ser pago.</p>}
        {o.state === "outro" && <p>O pedido <strong className="font-semibold">#{o.order_number}</strong> foi atualizado.</p>}
        <div className="mt-2 flex gap-2.5 rounded-lg bg-surface p-2">
          {o.product.image && <img src={o.product.image} alt="" className="size-12 shrink-0 rounded-md object-cover" />}
          <div className="min-w-0 text-[12px]">
            <p className="line-clamp-2">Produto: {o.product.title}</p>
            <p className="text-muted-foreground">Quantidade: {o.quantity}</p>
            <p>Valor total: <span className="font-semibold tnum">{brl(o.total)}</span></p>
          </div>
        </div>
        <p className={`mt-2 text-[12px] font-medium ${o.state === "pago" ? "text-success" : o.state === "pendente" ? "text-primary" : "text-muted-foreground"}`}>{STATE_LABEL[o.state]}</p>
        {o.state === "pendente" && o.copy_paste && (
          <>
            <p className="mt-1">É só copiar o código abaixo e pagar no aplicativo do seu banco para garantir o envio do seu pedido.</p>
            <p className="mt-2 truncate rounded-md border border-dashed border-border bg-surface px-2 py-1.5 font-mono text-[11px] text-muted-foreground">{o.copy_paste}</p>
          </>
        )}
      </div>
      {o.state === "pendente" && o.copy_paste && (
        <button type="button" onClick={() => void copy(o)} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-[14px] font-medium text-primary-foreground">
          {copied === o.token ? <><Check size={17} /> Código PIX copiado!</> : <><Copy size={17} /> COPIAR CÓDIGO PIX</>}
        </button>
      )}
      {o.state === "expirado" && (
        <button type="button" disabled={busy} onClick={() => void regenerate()} className="flex h-11 w-full items-center justify-center rounded-lg bg-primary text-[14px] font-medium text-primary-foreground disabled:opacity-60">{busy ? "Gerando novo PIX..." : "Gerar novo PIX"}</button>
      )}
      {err && <p className="text-center text-[12px] text-destructive">{err}</p>}
      {o.state === "expirado" && o.product.slug && (
        <Link to="/produto/$slug" params={{ slug: o.product.slug }} onClick={onClose} className="flex h-11 w-full items-center justify-center rounded-lg border border-border text-[13.5px] font-medium">Fazer novo pedido</Link>
      )}
    </div>
  );
}

/** Conversa da loja: se houver pedidos PIX desta loja, abre o chat do pedido. */
export function useOrderChatBadge(storeId: string) {
  const all = useStorePixOrders(storeId);
  const orders = all.orders.filter((o) => o.store.pix.allow_chat);
  const pending = orders.filter((o) => o.state === "pendente");
  return { hasOrders: orders.length > 0, unread: pending.filter((o) => o.store.pix.show_badge).length, open: () => openOrderChat(pending[0]?.token) };
}
