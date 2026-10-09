import { ExitOfferPopup, useExitIntent } from "@/components/checkout/ExitOfferPopup";
import { discountedUnit, hasProductOffer, resolveExitOffer, resolveProductExitOffer } from "@/lib/exit-offer";
import { rememberPixOrder } from "@/lib/pix-orders";
import { SHIPPING, getEstimatedDeliveryRange, shippingOptions as sharedShippingOptions } from "@/lib/shipping";
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, ChevronDown, ChevronLeft, ChevronRight, MapPin, Minus, Plus, Smile, Star, Ticket, Truck, Zap } from "lucide-react";
import { Countdown } from "@/components/product/OfferBlock";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PixScreen } from "@/components/checkout/PixScreen";
import { PixIcon } from "@/components/store/VerifiedBadge";
import { checkoutTheme } from "@/lib/checkout-theme";
import { trackAddPaymentInfo, trackPaymentPending, useMetaPageView } from "@/lib/meta-pixel";
import { clearDraft, emptyDraft, useCheckoutDraft, type CheckoutDraft } from "@/lib/checkout-store";
import { brl, digits } from "@/lib/format";
import { checkoutRating, discountPercent, variantPricing, variantImage } from "@/lib/product-types";
import { createOrder, createPixCharge, getFeaturedProduct, getPaymentStatus, getProductBySlug, getStoreSettings } from "@/lib/store.functions";

export const Route = createFileRoute("/pagamento-2")({
  validateSearch: (s: Record<string, unknown>): { pedido?: string } => (typeof s["pedido"] === "string" && s["pedido"] ? { pedido: s["pedido"] } : {}),
  loader: async () => ({ store: (await getStoreSettings())! }),
  staleTime: 60_000,
  preloadStaleTime: 60_000,
  head: () => ({ meta: [
    { title: "Finalizar pedido | Checkout" },
    { name: "description", content: "Confira a entrega e finalize seu pedido com PIX." },
    { property: "og:title", content: "Finalizar pedido" },
    { property: "og:description", content: "Confira a entrega e finalize seu pedido com PIX." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  errorComponent: () => <div className="grid min-h-screen place-items-center px-6 text-center text-[14px] text-muted-foreground">Não conseguimos abrir o checkout agora. Atualize a página.</div>,
  component: CheckoutTwo,
});

type PixState = { configured: true; qr_code?: string; copy_paste?: string; expires_in?: number; expires_at?: string | null } | { configured: false };
const PIX_KEY = "loja:pix-order";

function CheckoutTwo() {
  const { store: fallbackStore } = Route.useLoaderData();
  const navigate = useNavigate();
  const { pedido: pedidoParam } = Route.useSearch();
  const { draft, ready, update } = useCheckoutDraft();
  const fetchProduct = useServerFn(getProductBySlug);
  const fetchFeatured = useServerFn(getFeaturedProduct);
  const fetchStore = useServerFn(getStoreSettings);
  const submitOrder = useServerFn(createOrder);
  const openPix = useServerFn(createPixCharge);
  const readStatus = useServerFn(getPaymentStatus);
  const slug = draft?.slug ?? "";
  const productQuery = useQuery({ queryKey: ["checkout-product", slug], enabled: ready, staleTime: 60_000, queryFn: () => slug ? fetchProduct({ data: { slug } }) : fetchFeatured() });
  const product = productQuery.data ?? null;
  const storeQuery = useQuery({ queryKey: ["checkout-store", product?.slug ?? ""], enabled: Boolean(product?.slug), staleTime: 60_000, queryFn: async () => product ? (await fetchStore({ data: { productSlug: product.slug } })) ?? fallbackStore : fallbackStore });
  const store = storeQuery.data ?? fallbackStore;
  useMetaPageView(store.id || null);
  const [form, setForm] = useState<CheckoutDraft>(emptyDraft);
  const [placing, setPlacing] = useState(false);
  const [order, setOrder] = useState<{ number: string; total: number } | null>(null);
  const [pix, setPix] = useState<PixState | null>(null);
  const [pixLeft, setPixLeft] = useState(0);

  useEffect(() => { if (ready && draft) setForm({ ...emptyDraft, ...draft }); }, [ready, draft]);
  const shippingOptions = useMemo(() => (product ? sharedShippingOptions() : []), [product]);
  const shipping = shippingOptions.find((item) => item.id === form.shipping_id) ?? shippingOptions[0];
  const quantity = Math.max(1, form.quantity || 1);
  const pricing = product ? variantPricing(product, form.variant) : null;
  const [offerAccepted, setOfferAccepted] = useState(false);
  const exitOfferCfg = useMemo(() => (product ? resolveExitOffer(store.checkout?.exit_offer, product.sections) : null), [product, store.checkout?.exit_offer]);
  const [productOfferFlag, setProductOfferFlag] = useState(false);
  useEffect(() => { setProductOfferFlag(Boolean(product) && hasProductOffer(product!.slug)); }, [product?.slug]); // eslint-disable-line react-hooks/exhaustive-deps
  const productOfferCfg = useMemo(() => (productOfferFlag ? resolveProductExitOffer(store.checkout?.product_exit_offer, product?.sections) : null), [productOfferFlag, store.checkout?.product_exit_offer, product?.sections]);
  const baseUnit = pricing?.price ?? product?.price ?? 0;
  const unit = productOfferCfg ? discountedUnit(baseUnit, productOfferCfg) : offerAccepted ? discountedUnit(baseUnit, exitOfferCfg) : baseUnit;
  const originalUnit = Math.max(unit, pricing?.previous_price ?? product?.previous_price ?? unit);

  const subtotal = Number((unit * quantity).toFixed(2));
  const originalSubtotal = Number((originalUnit * quantity).toFixed(2));
  const shippingPrice = Number((shipping?.price ?? 0).toFixed(2));
  const shippingOriginal = SHIPPING.originalPrice > shippingPrice ? SHIPPING.originalPrice : shippingPrice;
  const productDiscount = Number(Math.max(0, originalSubtotal - subtotal).toFixed(2));
  const shippingDiscount = Number(Math.max(0, shippingOriginal - shippingPrice).toFixed(2));
  const savings = Number((productDiscount + shippingDiscount).toFixed(2));
  const total = Number((subtotal + shippingPrice).toFixed(2));

  const exitIntent = useExitIntent(Boolean(exitOfferCfg) && !productOfferCfg && !offerAccepted && !order, product?.id ?? "");
  const exitOld = Number((baseUnit * quantity).toFixed(2));
  const exitNew = Number((discountedUnit(baseUnit, exitOfferCfg) * quantity).toFixed(2));
  const hasAddress = Boolean(form.customer.name && form.customer.email && digits(form.customer.phone).length >= 10 && digits(form.customer.document).length >= 11 && digits(form.address.cep).length === 8 && form.address.street && form.address.number && form.address.district && form.address.city && form.address.state);
  const expiresAt = pix?.configured && pix.expires_at ? new Date(pix.expires_at).getTime() : null;
  const image = product ? variantImage(product, form.variant) : undefined;
  const variant = product ? Object.entries(form.variant).map(([key, value]) => product.variants.find((group) => group.name === key)?.options.find((option) => option.value === value)?.label ?? value).join(" · ") : "";
  const countdown = product?.offer.countdown_seconds ?? 0;
  const freeReturn = Boolean(product?.protection.items?.some((item) => /devolu/i.test(item)));
  const headerRating = store ? checkoutRating(store, product ?? null) : null;
  const patch = (next: Partial<CheckoutDraft>) => { setForm((current) => { const merged = { ...current, ...next }; update(merged); return merged; }); };

  function applyCharge(charge: { qr_code?: string; copy_paste?: string; expires_in?: number; expires_at?: string | null }) {
    setPix({ configured: true, ...(charge.qr_code ? { qr_code: charge.qr_code } : {}), ...(charge.copy_paste ? { copy_paste: charge.copy_paste } : {}), ...(charge.expires_in ? { expires_in: charge.expires_in } : {}), expires_at: charge.expires_at ?? (charge.expires_in ? new Date(Date.now() + charge.expires_in * 1000).toISOString() : null) });
  }
  useEffect(() => {
    // Só reabre o PIX do pedido indicado no endereço (refresh da própria tela PIX).
    // "Comprar agora" chega sem ?pedido e sempre começa uma compra nova.
    const saved = pedidoParam;
    if (!saved || window.localStorage.getItem(PIX_KEY) !== saved) return;
    void openPix({ data: { order_number: saved } }).then((charge: unknown) => {
      if (isPixCharge(charge)) { setOrder({ number: saved, total: Number((charge as { total?: number }).total ?? 0) }); applyCharge(charge); }
      else window.localStorage.removeItem(PIX_KEY);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setPixLeft(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
    tick(); const id = window.setInterval(tick, 1000); return () => window.clearInterval(id);
  }, [expiresAt]);
  useEffect(() => {
    if (!order) return;
    const id = window.setInterval(async () => { const { status } = await readStatus({ data: { order_number: order.number } }); if (status === "pago" || status === "aprovado") { clearDraft(); window.localStorage.removeItem(PIX_KEY); void navigate({ to: "/pedido-confirmado", search: { pedido: order.number } }); } }, 6000);
    return () => window.clearInterval(id);
  }, [order, navigate, readStatus]);

  async function placeOrder() {
    if (!product || !shipping) { toast.error("Selecione uma forma de entrega válida."); return; }
    if (!hasAddress) { toast.error("Adicione o endereço de entrega para continuar."); void navigate({ to: "/pagamento-2-endereco" }); return; }
    setPlacing(true);
    void trackAddPaymentInfo(store.id, product, quantity, total);
    try {
      const result = await submitOrder({ data: { slug: product.slug, quantity, variant: form.variant, shipping_id: shipping.id, customer: form.customer, address: form.address, exit_offer: productOfferCfg ? "product" as const : offerAccepted } });
      if (!result.ok) { toast.error(result.error); return; }
      setOrder({ number: result.order_number, total: result.total });
      const charge: unknown = await openPix({ data: { order_number: result.order_number } });
      if (isPixCharge(charge)) { applyCharge(charge); window.localStorage.setItem(PIX_KEY, result.order_number); void navigate({ to: "/pagamento-2", search: { pedido: result.order_number }, replace: true }); rememberPixOrder(result.access_token, store.id); void trackPaymentPending(store.id, result.order_number, result.total, product.id); }
      else { const failure = charge as { configured?: boolean; error?: string } | null; setPix({ configured: Boolean(failure?.configured) } as PixState); toast.error(failure?.error ?? "O PIX ainda não está disponível."); }
    } finally { setPlacing(false); }
  }

  if (!ready || productQuery.isLoading) return <div className="min-h-screen animate-pulse bg-surface" />;
  if (order && pix?.configured && (pix.copy_paste || pix.qr_code)) return <div style={checkoutTheme(store)}><PixScreen total={order.total} orderNumber={order.number} productTitle={product?.title ?? ""} qr={pix.qr_code} code={pix.copy_paste} left={expiresAt ? pixLeft : null} expiresAt={expiresAt} onBack={() => product ? void navigate({ to: "/produto/$slug", params: { slug: product.slug } }) : void navigate({ to: "/" })} onNew={() => { window.localStorage.removeItem(PIX_KEY); void navigate({ to: "/pagamento-2", search: {}, replace: true }); setOrder(null); setPix(null); }} /></div>;
  if (!product) return <div className="grid min-h-screen place-items-center bg-surface px-6 text-center"><div><h1 className="text-[18px] font-extrabold">Seu carrinho está vazio</h1><Link to="/" className="mt-3 inline-block text-[13px] font-bold text-primary">Voltar para a loja</Link></div></div>;

  return <div className="min-h-[100dvh] overflow-x-hidden bg-surface pb-36 text-foreground" style={checkoutTheme(store)}>
    {exitIntent.open && exitOfferCfg && <ExitOfferPopup offer={exitOfferCfg} oldPrice={exitOld} newPrice={exitNew} offerKey={product.id} product={{ name: product.name, image: image, variant: variant, quantity, rating: Number(product.rating) || null, warranty: product.warranty }} onAccept={() => { setOfferAccepted(true); exitIntent.close(); toast.success("Desconto aplicado ao seu pedido!"); }} onDecline={exitIntent.decline} />}
    <header className="grid h-11 grid-cols-[40px_minmax(0,1fr)_40px] items-center border-b border-border bg-card px-1">
      <Button variant="ghost" size="icon" aria-label="Voltar ao produto" onClick={() => void navigate({ to: "/produto/$slug", params: { slug: product.slug } })}><ChevronLeft size={22} /></Button>
      {headerRating
        ? <p className="flex items-center justify-center gap-1 text-[14px] font-medium"><Star size={13} className="fill-star text-star" /> {headerRating.text} {headerRating.value}/{headerRating.max}</p>
        : <span />}
      <span />
    </header>
    <main className="mx-auto w-full max-w-[520px] space-y-2">
      <section className="bg-card">
        <Button variant="ghost" onClick={() => void navigate({ to: "/pagamento-2-endereco" })} className="h-auto w-full justify-between rounded-none px-4 py-4 text-left hover:bg-card">
          {hasAddress ? <span className="flex min-w-0 items-start gap-2"><MapPin size={20} className="mt-0.5 shrink-0" /><span className="min-w-0 whitespace-normal"><strong className="block text-[14px] font-semibold">{form.customer.name} (+55) {maskPhonePrivate(form.customer.phone)}</strong><span className="mt-0.5 block text-[12px] font-normal text-muted-foreground">{form.address.street}, {form.address.number} · {form.address.district}, {form.address.city}/{form.address.state} · {form.address.cep}</span></span></span> : <span className="flex items-center gap-2 text-[14px] font-medium"><MapPin size={19} /> Endereço de envio</span>}
          <span className="ml-3 shrink-0 text-[13px] font-medium text-primary">{hasAddress ? <ChevronRight size={20} /> : "+ Adicionar endereço"}</span>
        </Button>
        <div className="h-0.5 w-full bg-[repeating-linear-gradient(90deg,var(--info,oklch(0.75_0.12_200))_0_22px,transparent_22px_30px,var(--primary)_30px_52px,transparent_52px_60px)]" />
        <div className="px-4 pb-3 pt-3">
          <div className="flex items-center justify-between gap-3">{store.checkout?.show_name !== false ? <h1 className="truncate text-[14px] font-semibold">{store.checkout?.display_name?.trim() || store.name}</h1> : <span />}<span className="shrink-0 text-[12px] text-muted-foreground">Adicionar nota <ChevronRight size={13} className="inline" /></span></div>
          <div className="mt-3 grid grid-cols-[76px_minmax(0,1fr)] gap-3">
            {image ? <img src={image} alt={product.name} className="size-[76px] rounded object-contain" /> : <div className="size-[76px] bg-surface" />}
            <div className="min-w-0"><p className="truncate text-[13px] leading-snug">{product.title}</p>{variant && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{variant}</p>}
              {countdown > 0 && <div className="mt-1 flex items-center"><span className="flex items-center gap-0.5 rounded-l-sm bg-primary px-1.5 py-0.5 text-[9px] font-medium text-primary-foreground"><Zap size={9} className="fill-current" />{product.offer.flash_label || "Oferta Relâmpago"}</span><span className="rounded-r-sm bg-primary-soft px-1.5 py-0.5 text-[9px] font-medium text-primary tnum"><Countdown seconds={countdown} /></span></div>}
              {freeReturn && <p className="mt-1 flex items-center gap-1 text-[9.5px] font-medium"><BadgeCheck size={11} className="text-star" /> Devolução gratuita</p>}
              <div className="mt-1 flex items-end justify-between gap-2"><div><strong className="text-[17px] font-semibold text-primary tnum">{brl(unit)}</strong>{originalUnit > unit && <div className="flex items-center gap-1"><span className="text-[10px] font-normal text-muted-foreground line-through">{brl(originalUnit)}</span><span className="rounded-sm bg-primary-soft px-1 text-[10px] font-medium text-primary">-{discountPercent(unit, originalUnit)}%</span></div>}</div>
                <div className="flex h-7 items-center rounded bg-surface"><Button variant="ghost" size="icon" aria-label="Diminuir quantidade" onClick={() => patch({ quantity: Math.max(1, quantity - 1) })} className="size-7 rounded"><Minus size={12} /></Button><span className="w-7 text-center text-[12px]">{quantity}</span><Button variant="ghost" size="icon" aria-label="Aumentar quantidade" onClick={() => patch({ quantity: Math.min(product.stock, quantity + 1) })} className="size-7 rounded"><Plus size={12} /></Button></div>
              </div>
            </div>
          </div>
          {shipping && <div className="mt-3 flex items-center justify-between rounded-md bg-success-soft px-3 py-2 text-[11px] font-normal"><span>Receba entre {getEstimatedDeliveryRange().compact}</span><span>{shippingDiscount > 0 && <span className="mr-2 text-muted-foreground line-through">{brl(shippingOriginal)}</span>}<strong className={`font-semibold ${shippingPrice === 0 ? "text-success" : ""}`}>{shippingPrice === 0 ? "Grátis" : brl(shippingPrice)}</strong><Truck size={13} className="ml-1 inline text-success" /></span></div>}
        </div>
      </section>
      {savings > 0 && store.checkout?.show_discount !== false && <section className="flex items-center justify-between gap-3 bg-card px-4 py-3 text-[13px]"><strong className="flex min-w-0 items-center gap-2 font-semibold"><Ticket size={16} className="shrink-0 text-primary" /><span className="truncate">{store.checkout?.discount_title?.trim() || `Desconto da ${store.name}`}</span></strong><span className="flex shrink-0 items-center gap-1"><span className="text-right">{shippingDiscount > 0 && <span className="block rounded bg-success-soft px-2 py-0.5 text-[10px] font-medium text-success">Frete grátis</span>}<span className="mt-1 block rounded bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">- {brl(savings)}</span></span><ChevronRight size={16} className="text-muted-foreground" /></span></section>}
      <section className="bg-card px-4 py-4"><h2 className="text-[14px] font-semibold">Resumo do pedido</h2><dl className="mt-3 space-y-2 text-[12.5px]"><SummaryRow label="Subtotal do produto" value={brl(subtotal)} strong /><SummaryRow label="Preço original" value={brl(originalSubtotal)} muted /><SummaryRow label="Desconto no produto" value={`- ${brl(productDiscount)}`} muted discount /><SummaryRow label="Subtotal do envio" value={brl(shippingPrice)} strong /><SummaryRow label="Taxa de envio" value={brl(shippingOriginal)} muted /><SummaryRow label="Desconto de envio" value={`- ${brl(shippingDiscount)}`} muted discount /><div className="mt-3 flex items-end justify-between border-t border-border pt-3"><dt className="text-[17px] font-semibold">Total</dt><dd className="text-right"><strong className="block text-[21px] font-semibold tnum">{brl(total)}</strong><span className="text-[10px] font-normal text-muted-foreground">Impostos inclusos</span></dd></div></dl></section>
      <section className="bg-card px-4 py-4"><h2 className="text-[14px] font-semibold">Forma de pagamento</h2><div className="mt-3 flex items-center gap-3"><PixIcon size={22} /><div className="min-w-0 flex-1"><strong className="text-[13px] font-semibold">Pix</strong><p className="text-[11px] font-normal text-muted-foreground">Pagamento instantâneo · Aprovação em segundos</p></div><span className="grid size-5 place-items-center rounded-full bg-primary"><span className="size-2 rounded-full bg-primary-foreground" /></span></div>
        {store.checkout?.show_legal !== false && <p className="mt-5 whitespace-pre-line text-[10.5px] font-normal leading-relaxed text-muted-foreground">{store.checkout?.legal_text?.trim() ? <LegalText text={store.checkout.legal_text.trim()} slug={store.slug} /> : <>Ao fazer um pedido, você concorda com os <Link to="/termos-de-uso" search={{ loja: store.slug }} className="font-medium text-foreground">Termos de uso e venda</Link> e reconhece que leu a <Link to="/politica-de-privacidade" search={{ loja: store.slug }} className="font-medium text-foreground">Política de privacidade</Link> da {store.name}.</>}</p>}
      </section>
      {savings > 0 && <p className="flex items-center gap-1.5 bg-primary-soft px-4 py-2 text-[11px] font-medium text-primary"><Smile size={14} className="shrink-0" />Você está economizando {brl(savings)} nesse pedido.</p>}
    </main>
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card px-4 pt-2 pb-[max(10px,env(safe-area-inset-bottom))] shadow-buybar"><div className="mx-auto max-w-[488px]"><div className="flex items-end justify-between"><span className="text-[13px] font-medium">Total ({quantity} {quantity === 1 ? "item" : "itens"})</span><strong className="text-[20px] font-semibold text-primary tnum">{brl(total)}</strong></div><Button onClick={() => void placeOrder()} disabled={placing} className="mt-2 h-auto min-h-12 w-full rounded-full py-2 text-[16px] font-semibold"><span className="flex flex-col leading-tight"><span>{placing ? "Gerando pagamento..." : "Fazer pedido"}</span>{countdown > 0 && !placing && <span className="text-[11px] font-medium tnum">O cupom expira em <Countdown seconds={countdown} /></span>}</span></Button></div></div>
  </div>;
}

function LegalText({ text, slug }: { text: string; slug: string }) {
  const parts = text.split(/(termos de uso(?: e venda)?|pol[ií]tica de privacidade)/i);
  return <>{parts.map((part, i) => /^termos de uso/i.test(part) ? <Link key={i} to="/termos-de-uso" search={{ loja: slug }} className="font-medium text-foreground">{part}</Link> : /^pol[ií]tica de privacidade$/i.test(part) ? <Link key={i} to="/politica-de-privacidade" search={{ loja: slug }} className="font-medium text-foreground">{part}</Link> : <span key={i}>{part}</span>)}</>;
}
function SummaryRow({ label, value, strong, muted, discount }: { label:string; value:string; strong?:boolean; muted?:boolean; discount?:boolean }) { return <div className="flex items-baseline justify-between gap-3"><dt className={strong ? "flex items-center gap-1 font-medium" : "pl-3 font-normal text-muted-foreground"}>{label}{strong && <ChevronDown size={13} />}</dt><dd className={`${strong ? "font-medium" : ""} ${muted && !discount ? "text-muted-foreground" : ""} ${discount ? "text-primary" : ""} tnum`}>{value}</dd></div>; }
function maskPhonePrivate(value: string) { const d=digits(value); if (d.length < 4) return value; return `(${d.slice(0,2)}) ${d.slice(2,3)}****-${d.slice(-4)}`; }
function isPixCharge(value: unknown): value is { ok:true; configured:true; total?:number; qr_code?:string; copy_paste?:string; expires_in?:number; expires_at?:string|null } { if (!value || typeof value !== "object") return false; const charge=value as Record<string,unknown>; return charge["ok"] === true && charge["configured"] === true; }