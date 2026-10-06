import { ExitOfferPopup, useExitIntent } from "@/components/checkout/ExitOfferPopup";
import { discountedUnit, resolveExitOffer } from "@/lib/exit-offer";
import { PixQr } from "@/components/checkout/PixQr";
import { rememberPixOrder } from "@/lib/pix-orders";
import { SHIPPING, getEstimatedDeliveryRange, shippingOptions as sharedShippingOptions } from "@/lib/shipping";
import { useEffect, useMemo, useState } from "react";
import { checkoutTheme } from "@/lib/checkout-theme";
import { variantPricing } from "@/lib/product-types";
import { trackAddPaymentInfo, trackPaymentPending, useMetaPageView } from "@/lib/meta-pixel";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronUp, Copy, Loader2, Mail, Minus, Plus, ShieldCheck, Truck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CheckoutFooter, CheckoutHeader } from "@/components/checkout/CheckoutChrome";
import { StoreChat } from "@/components/store/StoreChat";
import { PixIcon } from "@/components/store/VerifiedBadge";
import { PixScreen } from "@/components/checkout/PixScreen";
import {
  brl,
  digits,
  isValidCep,
  isValidCpfCnpj,
  isValidEmail,
  isValidPhone,
  maskCep,
  maskDocument,
  maskPhone,
  mmss,
} from "@/lib/format";
import { clearDraft, emptyDraft, useCheckoutDraft, type CheckoutDraft } from "@/lib/checkout-store";
import {
  createOrder,
  createPixCharge,
  getFeaturedProduct,
  getPaymentStatus,
  getProductBySlug,
  getStoreSettings,
} from "@/lib/store.functions";

export const Route = createFileRoute("/pagamento")({
  validateSearch: (s: Record<string, unknown>): { pedido?: string } => (typeof s["pedido"] === "string" && s["pedido"] ? { pedido: s["pedido"] } : {}),
  loader: async () => ({ store: (await getStoreSettings())! }),
  staleTime: 60_000,
  preloadStaleTime: 60_000,
  head: () => ({
    meta: [
      { title: "Pagamento seguro | Finalizar pedido" },
      { name: "description", content: "Finalize seu pedido com pagamento seguro via PIX." },
      { property: "og:title", content: "Pagamento seguro" },
      { property: "og:description", content: "Finalize seu pedido com pagamento seguro via PIX." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <p className="text-[14px] text-muted-foreground">
        Não conseguimos abrir o checkout agora. Atualize a página.
      </p>
    </div>
  ),
  component: CheckoutRoute,
});

type Step = 1 | 2 | 3;

function CheckoutRoute() {
  const { store: defaultStore } = Route.useLoaderData();
  const navigate = useNavigate();
  const { pedido: pedidoParam } = Route.useSearch();
  const { draft, ready, update } = useCheckoutDraft();

  const fetchBySlug = useServerFn(getProductBySlug);
  const fetchFeatured = useServerFn(getFeaturedProduct);
  const submitOrder = useServerFn(createOrder);
  const openPix = useServerFn(createPixCharge);
  const readStatus = useServerFn(getPaymentStatus);

  const slug = draft?.slug ?? "";
  const productQuery = useQuery({
    queryKey: ["checkout-product", slug],
    enabled: ready,
    staleTime: 60_000,
    queryFn: () => (slug ? fetchBySlug({ data: { slug } }) : fetchFeatured()),
  });

  const product = productQuery.data ?? null;
  const fetchStore = useServerFn(getStoreSettings);
  const storeQuery = useQuery({
    queryKey: ["checkout-store", product?.slug ?? ""],
    enabled: Boolean(product?.slug),
    staleTime: 60_000,
    queryFn: async () => (await fetchStore({ data: { productSlug: product!.slug } })) ?? defaultStore,
  });
  const store = storeQuery.data ?? defaultStore;
  useMetaPageView(store.id || null);
  const checkoutStyle = checkoutTheme(store);
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<CheckoutDraft>(emptyDraft);
  const [placing, setPlacing] = useState(false);
  const [offerAccepted, setOfferAccepted] = useState(false);
  const [order, setOrder] = useState<{ number: string; total: number } | null>(null);
  const [pix, setPix] = useState<
    | null
    | { configured: false }
    | { configured: true; qr_code?: string; copy_paste?: string; expires_in?: number; expires_at?: string | null }
  >(null);
  const [pixLeft, setPixLeft] = useState(600);
  const [cartOpen, setCartOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    if (ready && draft) setForm({ ...emptyDraft, ...draft });
  }, [ready, draft?.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const shippingOptions = useMemo(() => (product ? sharedShippingOptions() : []), [product]);
  const selectedShipping = useMemo(
    () => shippingOptions.find((o) => o.id === form.shipping_id) ?? shippingOptions[0],
    [shippingOptions, form.shipping_id],
  );

  const quantity = Math.max(1, form.quantity || 1);
  const exitOfferCfg = useMemo(() => (product ? resolveExitOffer(store.checkout?.exit_offer, product.sections) : null), [product, store.checkout?.exit_offer]);
  const baseUnitPrice = product ? variantPricing(product, form.variant).price : 0;
  const unitPrice = offerAccepted ? discountedUnit(baseUnitPrice, exitOfferCfg) : baseUnitPrice;
  const subtotal = Number((unitPrice * quantity).toFixed(2));
  const shippingPrice = Number((selectedShipping?.price ?? 0).toFixed(2));
  const total = Number((subtotal + shippingPrice).toFixed(2));

  const exitIntent = useExitIntent(Boolean(exitOfferCfg) && !offerAccepted && !order, product?.id ?? "");
  const exitOld = Number((baseUnitPrice * quantity).toFixed(2));
  const exitNew = Number((discountedUnit(baseUnitPrice, exitOfferCfg) * quantity).toFixed(2));

  const patch = (next: Partial<CheckoutDraft>) => {
    setForm((f) => {
      const merged = { ...f, ...next };
      update(merged);
      return merged;
    });
  };

  const expiresAt = pix && pix.configured && pix.expires_at ? new Date(pix.expires_at).getTime() : null;
  useEffect(() => {
    if (!order || !expiresAt) return;
    const tick = () => setPixLeft(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [order, expiresAt]);

  // Recarregou a página: reabre o mesmo PIX salvo no pedido, sem gerar outro.
  useEffect(() => {
    // Só reabre o PIX do pedido indicado no endereço (refresh da própria tela PIX).
    // "Comprar agora" chega sem ?pedido e sempre começa uma compra nova.
    const saved = pedidoParam;
    if (!saved || window.localStorage.getItem(PIX_KEY) !== saved) return;
    void openPix({ data: { order_number: saved } }).then((charge: unknown) => {
      if (isPixCharge(charge)) {
        setOrder({ number: saved, total: (charge as { total?: number }).total ?? 0 });
        applyCharge(charge);
      } else {
        window.localStorage.removeItem(PIX_KEY);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function applyCharge(charge: { qr_code?: string; copy_paste?: string; expires_in?: number; expires_at?: string | null }) {
    setPix({
      configured: true,
      ...(charge.qr_code ? { qr_code: charge.qr_code } : {}),
      ...(charge.copy_paste ? { copy_paste: charge.copy_paste } : {}),
      ...(charge.expires_in ? { expires_in: charge.expires_in } : {}),
      expires_at: charge.expires_at ?? (charge.expires_in ? new Date(Date.now() + charge.expires_in * 1000).toISOString() : null),
    });
  }

  function newPix() {
    window.localStorage.removeItem(PIX_KEY);
    void navigate({ to: "/pagamento", search: {}, replace: true });
    setOrder(null);
    setPix(null);
    setStep(3);
  }

  useEffect(() => {
    if (!order) return;
    const id = window.setInterval(async () => {
      const { status } = await readStatus({ data: { order_number: order.number } });
      if (status === "pago" || status === "aprovado") {
        clearDraft();
        window.localStorage.removeItem(PIX_KEY);
        void navigate({ to: "/pedido-confirmado", search: { pedido: order.number } });
      }
    }, 6000);
    return () => window.clearInterval(id);
  }, [order, navigate, readStatus]);

  async function lookupCep(value: string) {
    const raw = digits(value);
    if (raw.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      const data = (await res.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (data.erro) {
        toast.error("CEP não encontrado.");
        return;
      }
      patch({
        address: {
          ...form.address,
          cep: maskCep(raw),
          street: data.logradouro ?? "",
          district: data.bairro ?? "",
          city: data.localidade ?? "",
          state: data.uf ?? "",
        },
      });
    } catch {
      toast.error("Não foi possível consultar o CEP agora.");
    }
  }

  function validateStep1(): boolean {
    const c = form.customer;
    if (!isValidEmail(c.email)) return fail("Informe um e-mail válido.");
    if (!isValidPhone(c.phone)) return fail("Informe um telefone válido com DDD.");
    if (c.name.trim().split(" ").length < 2) return fail("Informe seu nome completo.");
    if (!isValidCpfCnpj(c.document)) return fail("Informe um CPF ou CNPJ válido.");
    return true;
  }

  function validateStep2(): boolean {
    const a = form.address;
    if (!selectedShipping) return fail("Selecione uma forma de entrega.");
    if (!isValidCep(a.cep)) return fail("Informe um CEP válido.");
    if (a.street.trim().length < 2) return fail("Informe o endereço.");
    if (!a.number.trim()) return fail("Informe o número.");
    if (a.district.trim().length < 2) return fail("Informe o bairro.");
    if (a.city.trim().length < 2) return fail("Informe a cidade.");
    if (a.state.trim().length < 2) return fail("Informe a UF.");
    return true;
  }

  function fail(message: string) {
    toast.error(message);
    return false;
  }

  async function placeOrder() {
    if (!product || !selectedShipping) return;
    if (!validateStep1() || !validateStep2()) return;
    setPlacing(true);
    void trackAddPaymentInfo(store.id, product, quantity, Number((unitPrice * quantity + selectedShipping.price).toFixed(2)));
    try {
      const result = await submitOrder({
        data: {
          slug: product.slug,
          quantity,
          variant: form.variant,
          shipping_id: selectedShipping.id,
          customer: form.customer,
          address: form.address,
          exit_offer: offerAccepted,
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOrder({ number: result.order_number, total: result.total });
      const charge: unknown = await openPix({ data: { order_number: result.order_number } });
      if (isPixCharge(charge)) {
        applyCharge(charge);
        window.localStorage.setItem(PIX_KEY, result.order_number); void navigate({ to: "/pagamento", search: { pedido: result.order_number }, replace: true }); rememberPixOrder(result.access_token, store.id);
        void trackPaymentPending(store.id, result.order_number, result.total, product.id);
      } else {
        const c = (charge ?? {}) as { configured?: boolean; error?: string };
        if (c.configured && c.error) {
          toast.error(c.error);
          setPix({ configured: true });
        } else {
          setPix({ configured: false });
        }
      }
    } finally {
      setPlacing(false);
    }
  }

  if (!ready || productQuery.isLoading) {
    return (
      <div className="min-h-screen bg-surface" aria-busy="true">
        <div className="h-[52px] border-b border-border bg-card" />
        <div className="mx-auto max-w-[520px] space-y-3 px-3 py-4">
          <div className="h-28 animate-pulse rounded-2xl bg-card" />
          <div className="h-20 animate-pulse rounded-2xl bg-card" />
          <div className="h-64 animate-pulse rounded-2xl bg-card" />
        </div>
      </div>
    );
  }

  if (order && pix && pix.configured && ("copy_paste" in pix || "qr_code" in pix)) {
    return (
      <div style={checkoutStyle}>
        <PixScreen
          total={order.total}
          orderNumber={order.number}
          productTitle={product?.title ?? ""}
          qr={pix.qr_code}
          code={pix.copy_paste}
          left={expiresAt ? pixLeft : null}
          expiresAt={expiresAt}
          onBack={() => (product ? void navigate({ to: "/produto/$slug", params: { slug: product.slug } }) : void navigate({ to: "/" }))}
          onNew={newPix}
        />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface px-6 text-center">
        <div>
          <h1 className="text-[18px] font-extrabold">Seu carrinho está vazio</h1>
          <Link to="/" className="mt-3 inline-block text-[13px] font-bold text-primary">
            Voltar para a loja
          </Link>
        </div>
      </div>
    );
  }

  const image = variantImage(product, form.variant);
  const variantText = Object.entries(form.variant)
    .map(([group, value]) => {
      const g = product.variants.find((v) => v.name === group);
      return g?.options.find((o) => o.value === value)?.label ?? value;
    })
    .join(" · ");

  return (
    <div className="min-h-screen bg-surface" style={checkoutStyle}>
      {exitIntent.open && exitOfferCfg && <ExitOfferPopup offer={exitOfferCfg} oldPrice={exitOld} newPrice={exitNew} offerKey={product.id} product={{ name: product.name, image: image, variant: variantText, quantity, rating: Number(product.rating) || null, warranty: product.warranty }} onAccept={() => { setOfferAccepted(true); exitIntent.close(); toast.success("Desconto aplicado ao seu pedido!"); }} onDecline={exitIntent.decline} />}
      <CheckoutHeader store={store} />

      <main className="mx-auto max-w-[520px] space-y-3 px-3 pb-6 pt-4">
        <section className="rounded-2xl bg-card p-4 shadow-card-soft">
          <button type="button" onClick={() => setCartOpen((open) => !open)} className="flex w-full items-center justify-between text-left">
            <h2 className="flex items-center gap-2 text-[14px] font-extrabold">Seu carrinho <span className="grid size-5 place-items-center rounded-full bg-foreground text-[10px] text-background">1</span></h2>
            {cartOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
          </button>
          {cartOpen && <><div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
            {image && (
              <img src={image} alt={product.name} className="size-12 shrink-0 object-contain" />
            )}
            <div className="min-w-0">
              <p className="line-clamp-2 text-[12px] font-bold">{product.title}</p>
              {variantText && <p className="mt-0.5 text-[10.5px] text-muted-foreground">{variantText} · {product.warranty || "Compra protegida"}</p>}
            </div>
            <div className="flex items-center rounded-full border border-border">
              <button type="button" aria-label="Diminuir quantidade" onClick={() => patch({ quantity: Math.max(1, quantity - 1) })} className="grid size-8 place-items-center text-primary"><Minus size={13} /></button>
              <span className="w-5 text-center text-[12px] font-bold">{quantity}</span>
              <button type="button" aria-label="Aumentar quantidade" onClick={() => patch({ quantity: Math.min(product.stock, quantity + 1) })} className="grid size-8 place-items-center text-success"><Plus size={13} /></button>
            </div>
          </div>
          <dl className="mt-3 space-y-1.5 border-t border-border pt-2.5 text-[12.5px]">
            <Row label="Subtotal" value={brl(subtotal)} />
            <Row label={`Frete${selectedShipping ? ` (${selectedShipping.label})` : ""}`} value={shippingPrice > 0 ? brl(shippingPrice) : "Grátis"} />
            <div className="flex items-baseline justify-between border-t border-border pt-2">
              <dt className="text-[13px] font-extrabold">Total</dt>
              <dd className="font-display text-[18px] font-extrabold tnum">{brl(total)}</dd>
            </div>
          </dl></>}
        </section>

        <Steps step={step} />

        {step === 1 && (
          <section className="space-y-4 rounded-2xl bg-card p-4 shadow-card-soft">
            <Field
              label="E-mail"
              placeholder="email@email.com"
              type="email"
              value={form.customer.email}
              onChange={(v) => patch({ customer: { ...form.customer, email: v } })}
            />
            <p className="-mt-2 flex items-start gap-2 text-[10px] leading-snug"><Mail size={12} className="mt-0.5 shrink-0" /> Enviaremos seu código de rastreio para este e-mail. Confira a caixa de entrada e o spam.</p>
            <Field
              label="Telefone"
              placeholder="(99) 99999-9999"
              inputMode="numeric"
              value={form.customer.phone}
              onChange={(v) => patch({ customer: { ...form.customer, phone: maskPhone(v) } })}
            />
            <Field
              label="Nome completo"
              placeholder="Seu nome e sobrenome"
              value={form.customer.name}
              onChange={(v) => patch({ customer: { ...form.customer, name: v } })}
            />
            <Field
              label="CPF/CNPJ"
              placeholder="123.456.789-12"
              inputMode="numeric"
              value={form.customer.document}
              onChange={(v) => patch({ customer: { ...form.customer, document: maskDocument(v) } })}
            />
            <p className="-mt-2 flex items-start gap-2 text-[10px] leading-snug"><ShieldCheck size={12} className="mt-0.5 shrink-0" /> Confira se o CPF está correto. Precisamos dos dados corretos para processar seu pedido.</p>
            <DataSafety />
            <PrimaryButton
              onClick={() => {
                if (validateStep1()) setStep(2);
              }}
            >
              Ir para a entrega
            </PrimaryButton>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4 rounded-2xl bg-card p-4 shadow-card-soft">
            <div className="rounded-xl border border-border p-2.5">
            <h2 className="mb-2 flex items-center gap-2 text-[13px] font-extrabold"><Truck size={15} /> Escolha uma forma de entrega:</h2>
            <div className="space-y-2">
              {shippingOptions.map((o) => {
                const active = selectedShipping?.id === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => patch({ shipping_id: o.id })}
                    className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3 text-left ${
                      active ? "border-success bg-success-soft" : "border-border bg-card"
                    }`}
                  >
                    <span
                      className={`grid size-4 shrink-0 place-items-center rounded-full border ${
                        active ? "border-success" : "border-input"
                      }`}
                    >
                      {active && <span className="size-2 rounded-full bg-success" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-extrabold uppercase">{o.label}</span>
                      <span className="block truncate text-[11.5px] text-muted-foreground">{o.eta}</span>
                    </span>
                    <span className={`shrink-0 text-[12.5px] font-bold tnum ${o.price > 0 ? "" : "text-success"}`}>
                      {o.price === 0 && <span className="mr-1.5 font-normal text-muted-foreground line-through">{brl(SHIPPING.originalPrice)}</span>}
                      {o.price > 0 ? brl(o.price) : "Grátis"}
                    </span>
                  </button>
                );
              })}
            </div></div>

            <Field
              label="CEP"
              placeholder="00000-000"
              inputMode="numeric"
              value={form.address.cep}
              onChange={(v) => {
                const masked = maskCep(v);
                patch({ address: { ...form.address, cep: masked } });
                if (digits(masked).length === 8) void lookupCep(masked);
              }}
            />
            <Field
              label="Endereço"
              value={form.address.street}
              onChange={(v) => patch({ address: { ...form.address, street: v } })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Número"
                value={form.address.number}
                onChange={(v) => patch({ address: { ...form.address, number: v } })}
              />
              <Field
                label="Complemento"
                value={form.address.complement}
                onChange={(v) => patch({ address: { ...form.address, complement: v } })}
              />
            </div>
            {selectedShipping && <p className="flex items-center gap-2 rounded-xl border border-success/20 bg-success-soft px-3 py-3 text-[11px] text-success"><ShieldCheck size={14} /><strong>{selectedShipping.label}</strong> — {selectedShipping.eta}</p>}
            <Field
              label="Bairro"
              value={form.address.district}
              onChange={(v) => patch({ address: { ...form.address, district: v } })}
            />
            <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-3">
              <Field
                label="Cidade"
                value={form.address.city}
                onChange={(v) => patch({ address: { ...form.address, city: v } })}
              />
              <Field
                label="UF"
                value={form.address.state}
                onChange={(v) => patch({ address: { ...form.address, state: v.toUpperCase().slice(0, 2) } })}
              />
            </div>

            <PrimaryButton
              onClick={() => {
                if (validateStep2()) setStep(3);
              }}
            >
              Ir para o pagamento
            </PrimaryButton>
            <SecondaryButton onClick={() => setStep(1)}>Voltar</SecondaryButton>
          </section>
        )}

        {step === 3 && !order && (
          <section className="space-y-3 rounded-2xl bg-card p-4 shadow-card-soft">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-extrabold">Confirme seus dados</h2>
              <button type="button" onClick={() => setStep(1)} className="text-[12px] font-bold text-primary">
                Editar
              </button>
            </div>
            <dl className="space-y-2 border-t border-border pt-3 text-[12px]">
              <Row label="Nome" value={form.customer.name} />
              <Row label="E-mail" value={form.customer.email} />
              <Row label="CPF/CNPJ" value={form.customer.document} />
              <Row label="Telefone" value={form.customer.phone} />
              <Row
                label="Endereço"
                value={`${form.address.street}, ${form.address.number}${
                  form.address.complement ? ` - ${form.address.complement}` : ""
                } · ${form.address.district} · ${form.address.city}/${form.address.state} · ${form.address.cep}`}
              />
              <Row label="Entrega" value={`${form.address.street}, ${form.address.number} · ${form.address.city}/${form.address.state} · ${form.address.cep}`} />
            </dl>
            <p className="flex items-start gap-2 rounded-lg bg-surface px-3 py-3 text-[10.5px] text-muted-foreground"><ShieldCheck size={13} className="shrink-0 text-primary" /> Revise os dados antes de gerar o PIX. O código será vinculado a esses dados.</p>
            <SecondaryButton onClick={() => setStep(2)}>Voltar</SecondaryButton>
          </section>
        )}

        {step === 3 && !order && (
          <section className="rounded-2xl bg-card p-4 shadow-card-soft">
            <p className="flex items-center gap-2 border-b border-border pb-3 text-[13px] font-extrabold"><PixIcon size={18} /> Pagamento via Pix</p>
            <div className="pt-3"><PrimaryButton onClick={placeOrder} disabled={placing}>{placing ? "Gerando seu Pix..." : "Efetuar pagamento"}</PrimaryButton></div>
          </section>
        )}

        {order && (
          <section className="space-y-4 rounded-2xl bg-card p-4 shadow-card-soft">
            <p className="flex items-center gap-2 border-b border-border pb-3 text-[13px] font-extrabold"><PixIcon size={18} /> Pagamento via Pix</p>

            {pix && pix.configured ? (
              <>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground"><span>Expira em</span><strong className="rounded-md bg-primary-soft px-2 py-1 text-primary tnum">{mmss(pixLeft)}</strong></div>
                <div className="flex items-baseline justify-between"><span className="text-[11px] text-muted-foreground">Valor total</span><strong className="text-[25px] font-extrabold tnum">{brl(order.total)}</strong></div>
                {pix.copy_paste || pix.qr_code ? (
                  <PixQr
                    code={pix.copy_paste}
                    fallback={pix.qr_code}
                    className="mx-auto size-44 rounded-xl border border-border bg-card p-2 shadow-card-soft"
                  />
                ) : (
                  <div className="mx-auto grid size-56 place-items-center rounded-xl border border-dashed border-border text-[12px] text-muted-foreground">
                    Aguardando o QR Code do provedor
                  </div>
                )}
                <p className="text-[12.5px] text-muted-foreground">
                  Escaneie o QR Code no aplicativo do seu banco.
                </p>
                {"copy_paste" in pix && pix.copy_paste && <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border bg-surface p-3 text-[10px] text-muted-foreground">{pix.copy_paste}</pre>}
                <Button
                  type="button"
                  disabled={!("copy_paste" in pix) || !pix.copy_paste}
                  onClick={async () => {
                    if ("copy_paste" in pix && pix.copy_paste) {
                      await navigator.clipboard.writeText(pix.copy_paste);
                      toast.success("Código PIX copiado!");
                    }
                  }}
                  className="h-12 w-full rounded-full text-[14px] font-extrabold uppercase"
                >
                  <Copy size={15} /> Copiar código PIX
                </Button>
                <p className="text-center text-[11px] text-muted-foreground">Abra o app do seu banco e cole o código. Aprovação imediata.</p>
                <p className="flex items-center gap-2 text-[11px] font-semibold text-success"><Loader2 size={13} className="animate-spin" /> Aguardando confirmação do pagamento — a tela avança sozinha em segundos.</p>
              </>
            ) : (
              <div className="rounded-xl bg-surface p-3 text-left">
                <p className="text-[13px] font-bold">Pedido registrado — aguardando pagamento</p>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  O PIX automático será liberado assim que a chave do provedor de pagamento for
                  configurada na loja. Enquanto isso, o pedido fica salvo no painel com todos os dados
                  do cliente.
                </p>
              </div>
            )}

            <p className="flex items-center justify-center gap-2 text-[11.5px] text-muted-foreground">
              <ShieldCheck size={14} className="text-success" /> Compra protegida e dados tratados com segurança
            </p>
          </section>
        )}
      </main>
      <CheckoutFooter store={store} onChat={() => setChatOpen(true)} />
      <StoreChat store={store} open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}

const PIX_KEY = "loja:pix-order";

function Steps({ step }: { step: Step }) {
  const items = ["Identificação", "Entrega", "Pagamento"];
  return (
    <ol className="grid grid-cols-3 rounded-2xl bg-card px-2 py-4 shadow-card-soft" aria-label="Etapas do checkout">
      {items.map((label, i) => {
        const index = (i + 1) as Step;
        const active = step === index;
        const done = step > index;
        return (
          <li key={label} aria-current={active ? "step" : undefined} className="relative flex flex-col items-center text-center">
            {i > 0 && (
              <span aria-hidden className={`absolute right-[calc(50%+18px)] top-[13px] h-[2px] w-[calc(100%-36px)] rounded-full ${step >= index ? "bg-foreground" : "bg-border"}`} />
            )}
            <span
              className={`relative z-10 grid size-7 place-items-center rounded-full text-[12px] font-bold tnum transition-colors ${
                active ? "bg-foreground text-background shadow-card-soft" : done ? "bg-foreground text-background" : "bg-surface-strong text-muted-foreground"
              }`}
            >
              {done ? <Check size={14} strokeWidth={3} /> : index}
            </span>
            <span className={`mt-2 text-[11px] leading-none ${active ? "font-extrabold text-foreground" : done ? "font-semibold text-foreground/80" : "font-medium text-muted-foreground"}`}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={`min-w-0 break-words text-right font-semibold ${value === "Grátis" ? "font-bold text-success" : ""}`}>{value}</dd>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "numeric" | "text" | "email";
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block pl-0.5 text-[12px] font-semibold text-foreground/80">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
       className="h-12 w-full min-w-0 rounded-xl border border-input bg-card px-4 text-[14px] outline-none transition-colors placeholder:text-muted-foreground/80 focus:border-foreground/40 focus:ring-2 focus:ring-foreground/5"
      />
    </label>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-12 w-full rounded-full text-[14px] font-extrabold uppercase active:scale-[0.99]"
    >
      {children}
    </Button>
  );
}

function DataSafety() {
  return <div className="rounded-xl border border-dashed border-border p-4"><p className="text-center text-[11px] font-bold">Usamos seus dados de forma 100%<br />segura para garantir a sua satisfação:</p><ul className="mt-3 space-y-2 text-[11px] text-muted-foreground">{["Enviar o seu comprovante de compra e pagamento;", "Ativar a sua garantia de devolução caso não fique satisfeito;", "Acompanhar o andamento do seu pedido;"].map((item) => <li key={item} className="flex items-start gap-2"><ShieldCheck size={14} className="shrink-0 text-success" />{item}</li>)}</ul></div>;
}

function isPixCharge(value: unknown): value is { ok: true; configured: true; qr_code?: string; copy_paste?: string; expires_in?: number } {
  if (!value || typeof value !== "object") return false;
  const charge = value as Record<string, unknown>;
  return charge["ok"] === true && charge["configured"] === true;
}

function SecondaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-full border border-border py-3 text-[13px] font-bold uppercase tracking-wide text-muted-foreground"
    >
      {children}
    </button>
  );
}
