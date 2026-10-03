import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { claimLegacyPixOrders, getPixOrders, type PixOrderView } from "./pix-recovery.functions";

/** Só guardamos no navegador o token de acesso do pedido e a loja — nada sensível. */
type Ref = { token: string; store_id: string; at: number };
const KEY = "loja:pix-orders";
const ACTIVE = "loja:active-store";
const EVT = "loja:pix-orders-change";

function read(): Ref[] {
  if (typeof window === "undefined") return [];
  try { return (JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as Ref[]).filter((r) => r && r.token); } catch { return []; }
}
function write(list: Ref[]) {
  window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, 10)));
  window.dispatchEvent(new Event(EVT));
}

export function rememberPixOrder(token: string | undefined, storeId: string) {
  if (typeof window === "undefined" || !token) return;
  const list = read().filter((r) => r.token !== token);
  write([{ token, store_id: storeId, at: Date.now() }, ...list]);
  window.sessionStorage.removeItem(`loja:pix-dismiss:${token}`);
}

export function forgetPixOrders(tokens: string[]) {
  if (!tokens.length) return;
  write(read().filter((r) => !tokens.includes(r.token)));
}

/** Marca a loja que o cliente está vendo, para mostrar só os pedidos dela. */
export function useMarkActiveStore(storeId: string | null | undefined) {
  useEffect(() => {
    if (!storeId) return;
    window.sessionStorage.setItem(ACTIVE, storeId);
    window.dispatchEvent(new Event(EVT));
  }, [storeId]);
}

function useRefs() {
  const [state, setState] = useState<{ refs: Ref[]; active: string | null }>({ refs: [], active: null });
  useEffect(() => {
    const sync = () => setState({ refs: read(), active: window.sessionStorage.getItem(ACTIVE) });
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return state;
}

/** Pedidos PIX da loja ativa, com status reconfirmado no servidor. */
export function useStorePixOrders(storeId?: string | null) {
  const { refs, active } = useRefs();
  const store = storeId ?? active;
  const tokens = refs.filter((r) => r.store_id === store).map((r) => r.token);
  const fetchOrders = useServerFn(getPixOrders);
  const claim = useServerFn(claimLegacyPixOrders);
  useEffect(() => {
    // Pedidos de antes do token: o checkout guardava só o número do último pedido.
    const legacy = window.localStorage.getItem("loja:pix-order");
    if (!legacy || window.localStorage.getItem(`loja:pix-legacy:${legacy}`)) return;
    void claim({ data: { order_numbers: [legacy] } }).then((found) => {
      window.localStorage.setItem(`loja:pix-legacy:${legacy}`, "1");
      for (const f of found) if (!read().some((r) => r.token === f.token)) rememberPixOrder(f.token, f.store_id);
    }).catch(() => {});
  }, [claim]);
  const query = useQuery({
    queryKey: ["pix-orders", tokens],
    queryFn: () => fetchOrders({ data: { tokens } }),
    enabled: tokens.length > 0,
    refetchInterval: 20000,
    staleTime: 10000,
  });
  const orders: PixOrderView[] = tokens.length ? (query.data ?? []).filter((o) => o.store.id === store) : [];
  return { orders, pending: orders.filter((o) => o.state === "pendente"), storeId: store };
}

export function openOrderChat(token?: string) {
  window.dispatchEvent(new CustomEvent("loja:open-order-chat", { detail: token ?? null }));
}
