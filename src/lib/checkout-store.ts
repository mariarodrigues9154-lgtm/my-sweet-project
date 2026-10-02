import { useCallback, useEffect, useState } from "react";

export type CheckoutDraft = {
  slug: string;
  quantity: number;
  variant: Record<string, string>;
  shipping_id: string;
  customer: { name: string; email: string; phone: string; document: string };
  address: {
    cep: string;
    street: string;
    number: string;
    complement: string;
    district: string;
    city: string;
    state: string;
  };
};

const KEY = "loja:checkout";

export const emptyDraft: CheckoutDraft = {
  slug: "",
  quantity: 1,
  variant: {},
  shipping_id: "gratis",
  customer: { name: "", email: "", phone: "", document: "" },
  address: { cep: "", street: "", number: "", complement: "", district: "", city: "", state: "" },
};

export function readDraft(): CheckoutDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return { ...emptyDraft, ...(JSON.parse(raw) as CheckoutDraft) };
  } catch {
    return null;
  }
}

export function writeDraft(draft: CheckoutDraft) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(draft));
  window.dispatchEvent(new Event("loja:checkout-change"));
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("loja:checkout-change"));
}

/** Carrinho/rascunho do checkout persistido no navegador. */
export function useCheckoutDraft() {
  const [draft, setDraft] = useState<CheckoutDraft | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDraft(readDraft());
    setReady(true);
    const sync = () => setDraft(readDraft());
    window.addEventListener("loja:checkout-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("loja:checkout-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((patch: Partial<CheckoutDraft>) => {
    const current = readDraft() ?? emptyDraft;
    writeDraft({ ...current, ...patch });
  }, []);

  return { draft, ready, update };
}

const CART_KEY = "loja:cart-count";

export function bumpCart(qty = 1) {
  if (typeof window === "undefined") return;
  const current = Number(window.localStorage.getItem(CART_KEY) ?? "0");
  window.localStorage.setItem(CART_KEY, String(Math.max(0, current + qty)));
  window.dispatchEvent(new Event("loja:cart-change"));
}

export function useCartCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const read = () => setCount(Number(window.localStorage.getItem(CART_KEY) ?? "0"));
    read();
    window.addEventListener("loja:cart-change", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("loja:cart-change", read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return count;
}
