import { useEffect, useMemo, useRef, useState } from "react";
import { SHIPPING, getEstimatedDeliveryRange, shippingOptions as sharedShippingOptions } from "@/lib/shipping";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, X, Zap } from "lucide-react";

import { brl } from "@/lib/format";
import { trackAddToCart, trackInitiateCheckout } from "@/lib/meta-pixel";
import { bumpCart, readDraft, writeDraft, emptyDraft } from "@/lib/checkout-store";
import {
  discountPercent,
  optionSelectable,
  promoBadges,
  variantPriceRange,
  variantPricing,
  type Product,
  type StoreSettings,
} from "@/lib/product-types";
import { Countdown } from "./OfferBlock";

/**
 * Bottom sheet de seleção de variações (referência TikTok Shop).
 * Lê apenas as variações cadastradas no painel — nada é fixo no código.
 */
export function BuySheet({
  product,
  store,
  open,
  mode,
  onClose,
}: {
  product: Product;
  store?: StoreSettings;
  open: boolean;
  mode: "buy" | "cart";
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const checkoutPath = store?.checkout?.checkout_model === "v2" ? "/pagamento-2" : "/pagamento";

  const groups = product.variants ?? [];
  const firstImage = product.media.find((m) => m.type === "image")?.url;
  const shippingOptions = sharedShippingOptions();

  const [quantity, setQuantity] = useState(1);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [highlight, setHighlight] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Abertura instantânea: reaproveita o que já está carregado e pré-carrega o checkout.
  useEffect(() => {
    if (!open) return;
    queryClient.setQueryData(["checkout-product", product.slug], product);
    if (store) queryClient.setQueryData(["checkout-store", product.slug], store);
    void router.preloadRoute({ to: checkoutPath }).catch(() => undefined);
  }, [open, product, store, queryClient, router, checkoutPath]);

  // Pré-carrega o código do checkout quando o navegador estiver livre (sem chamar pagamento).
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const run = () => void router.preloadRoute({ to: checkoutPath }).catch(() => undefined);
    const id = w.requestIdleCallback ? w.requestIdleCallback(run) : window.setTimeout(run, 2500);
    return () => { if (!w.requestIdleCallback) window.clearTimeout(id); };
  }, [router, checkoutPath]);

  useEffect(() => {
    if (!open) return;
    const draft = readDraft();
    setQuantity(draft?.slug === product.slug ? draft.quantity : 1);
    setSelection(draft?.slug === product.slug ? draft.variant : {});
    setHighlight(null);
    setNotice(null);
  }, [open, product.slug]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const missing = useMemo(() => groups.filter((g) => !selection[g.name]), [groups, selection]);
  const pricing = variantPricing(product, selection);
  const range = variantPriceRange(product);
  const showFrom = missing.length > 0 && range.multiple;
  const shownPrice = missing.length ? range.min : pricing.price;
  const shownPrevious = missing.length ? product.previous_price : pricing.previous_price;
  const discount = discountPercent(shownPrice, shownPrevious);
  const maxQty = Math.max(1, Math.min(missing.length ? product.stock || 1 : pricing.stock || 1, 20));
  const countdownSeconds = product.offer.countdown_seconds ?? 0;
  const badges = promoBadges(product);

  useEffect(() => {
    if (quantity > maxQty) setQuantity(maxQty);
  }, [maxQty, quantity]);

  const selectedImage =
    groups
      .map((group) => group.options.find((o) => o.value === selection[group.name])?.image)
      .find((url) => !!url) ?? firstImage;

  const choose = (groupName: string, value: string) => {
    setSelection((current) => ({ ...current, [groupName]: value }));
    setHighlight(null);
    setNotice(null);
  };

  const persist = () => {
    const current = readDraft() ?? emptyDraft;
    writeDraft({
      ...current,
      slug: product.slug,
      quantity,
      variant: selection,
      shipping_id: current.slug === product.slug ? current.shipping_id : (shippingOptions[0]?.id ?? "gratis"),
    });
  };

  const confirm = () => {
    const pending = missing[0];
    if (pending) {
      setHighlight(pending.name);
      setNotice("Selecione uma opção para continuar.");
      groupRefs.current[pending.name]?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!pricing.available) {
      setNotice("Essa combinação está indisponível.");
      return;
    }
    persist();
    if (mode === "cart") {
      bumpCart(quantity);
      void trackAddToCart(store?.id, product, quantity);
      setNotice("Produto adicionado ao carrinho.");
      onClose();
      return;
    }
    onClose();
    void trackInitiateCheckout(store?.id, product, quantity);
    void navigate({ to: checkoutPath });
  };

  if (!open) return null;

  const [priceInt, priceCents] = brl(shownPrice).replace(/^R\$\s?/, "").split(",");

  return (
    <div role="dialog" aria-modal="true" aria-label="Escolher opções" className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/50 animate-in fade-in"
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[88vh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[20px] bg-card shadow-sheet-up animate-in slide-in-from-bottom duration-300">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-20 grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X size={18} strokeWidth={2} />
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {/* Resumo: imagem à esquerda, preço/desconto à direita */}
          <div className="flex gap-3 px-4 pb-3 pt-5">
            {selectedImage && (
              <img
                src={selectedImage}
                alt={product.name}
                className="size-[88px] shrink-0 rounded-xl bg-surface object-contain"
              />
            )}
            <div className="min-w-0 pr-8">
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                {discount > 0 && (
                  <span className="rounded-[5px] bg-primary px-1.5 py-px text-[13px] font-semibold leading-5 text-primary-foreground">
                    -{discount}%
                  </span>
                )}
                {showFrom && <span className="text-[13.5px] text-primary">A partir de</span>}
                <span className="text-[13.5px] font-medium text-primary">R$</span>
                <span className="-ml-1 font-display text-[24px] font-semibold leading-none text-primary tnum">
                  {priceInt}
                  <span className="text-[15px]">,{priceCents}</span>
                </span>
              </div>
              {shownPrevious > shownPrice && (
                <p className="mt-1 text-[13px] text-muted-foreground line-through tnum">{brl(shownPrevious)}</p>
              )}
              {(badges.badge1 || badges.badge2) && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {badges.badge1 && (
                    <span className="rounded border border-primary/40 px-1.5 py-px text-[11.5px] text-primary">
                      {badges.badge1}
                    </span>
                  )}
                  {badges.badge2 && (
                    <span className="rounded border border-primary/40 px-1.5 py-px text-[11.5px] text-primary">
                      {badges.badge2}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Oferta Relâmpago: mesmo tempo real da promoção do produto */}
          {countdownSeconds > 0 && (
            <div className="mx-4 mb-4 flex items-center justify-between gap-2 rounded-lg bg-flash px-3 py-2 text-primary-foreground">
              <span className="inline-flex items-center gap-1.5 text-[13.5px] font-medium">
                <Zap size={15} className="fill-current" />
                {product.offer.flash_label ?? "Oferta Relâmpago"}
              </span>
              <span className="whitespace-nowrap text-[13px]">
                Termina em <strong className="font-semibold tnum"><Countdown seconds={countdownSeconds || 1} /></strong>
              </span>
            </div>
          )}

          {/* Variações cadastradas no painel */}
          {groups.map((group) => {
            const withImages = group.use_image || group.options.some((o) => o.image);
            const chosen = group.options.find((o) => o.value === selection[group.name]);
            return (
              <div
                key={group.name}
                ref={(el) => {
                  groupRefs.current[group.name] = el;
                }}
                className={`px-4 pb-4 ${highlight === group.name ? "rounded-lg ring-2 ring-primary" : ""}`}
              >
                <p className="mb-2 text-[14px] font-medium">
                  {group.label}
                  <span className="ml-1 text-muted-foreground">({group.options.length})</span>
                  {chosen && <span className="ml-1.5 font-normal text-muted-foreground">{chosen.label}</span>}
                </p>

                {withImages ? (
                  <div className="grid grid-cols-3 gap-2">
                    {group.options.map((option) => {
                      const active = selection[group.name] === option.value;
                      const enabled = optionSelectable(product, selection, group.name, option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={!enabled}
                          onClick={() => choose(group.name, option.value)}
                          className={`overflow-hidden rounded-xl border bg-card text-left transition-colors ${
                            active ? "border-2 border-primary" : "border-border"
                          } ${enabled ? "" : "opacity-40"}`}
                        >
                          <div className="aspect-square w-full bg-surface">
                            {option.image && (
                              <img src={option.image} alt={option.label} className="size-full object-contain" />
                            )}
                          </div>
                          <span className="block px-1.5 py-2 text-center text-[12.5px] font-normal leading-tight">
                            {option.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {group.options.map((option) => {
                      const active = selection[group.name] === option.value;
                      const enabled = optionSelectable(product, selection, group.name, option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={!enabled}
                          onClick={() => choose(group.name, option.value)}
                          className={`min-w-[62px] rounded-lg border px-3 py-2 text-center text-[13px] font-normal transition-colors ${
                            active ? "border-2 border-primary text-primary" : "border-border bg-card text-foreground"
                          } ${enabled ? "" : "opacity-40 line-through"}`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Quantidade */}
          <div className="flex items-center justify-between px-4 pb-5">
            <p className="text-[14px] font-medium">Quantidade</p>
            <div className="flex items-center gap-1 rounded-lg bg-surface">
              <button
                type="button"
                aria-label="Diminuir"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="grid size-8 place-items-center rounded-lg text-foreground disabled:text-muted-foreground/60"
              >
                <Minus size={14} />
              </button>
              <span className="w-8 text-center text-[14px] tnum">{quantity}</span>
              <button
                type="button"
                aria-label="Aumentar"
                onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                disabled={quantity >= maxQty}
                className="grid size-8 place-items-center rounded-lg text-foreground disabled:text-muted-foreground/60"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Rodapé fixo do popup */}
        <div className="shrink-0 border-t border-border bg-card px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          {notice && <p className="mb-2 text-center text-[12.5px] text-primary">{notice}</p>}
          <button
            type="button"
            onClick={confirm}
            className="flex h-12 w-full flex-col items-center justify-center rounded-full bg-primary leading-tight text-primary-foreground active:scale-[0.99]"
          >
            <span className="text-[16px] font-medium">
              {mode === "cart" ? "Adicionar ao carrinho" : "Comprar agora"}
            </span>
            <span className="text-[11.5px] font-normal opacity-95 tnum">
              {showFrom ? `A partir de ${brl(shownPrice)}` : brl(shownPrice * quantity)}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
