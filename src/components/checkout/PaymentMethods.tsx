import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, XCircle, ChevronLeft, ChevronRight, CreditCard, Info, ShieldCheck, X } from "lucide-react";

import { PixIcon } from "@/components/store/VerifiedBadge";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { cardProviderReady, fillDeclineMessage, installmentPlan, pixDiscountLabel, type PaymentMethodsConfig } from "@/lib/payment-methods";
import { sizedImage, stableMediaUrl } from "@/lib/media-url";
import { useServerFn } from "@tanstack/react-start";
import { confirmWappiCardPayment, getWappiCardConfig, payOrderWithCard } from "@/lib/store.functions";
import { finishWappiThreeDS, mountWappiIframe, prepareWappiThreeDS, tokenizeWappiCard, wappiCardSettings, type WappiThreeDSSettings } from "@/lib/wappi-card-browser";
import sealMastercard from "@/assets/seal-45.png.asset.json";
import sealVisa from "@/assets/seal-47.png.asset.json";
import sealSafekey from "@/assets/seal-46.png.asset.json";

const SECURITY_SEALS: { src: string; alt: string }[] = [
  { src: sealMastercard.url, alt: "Mastercard ID Check" },
  { src: sealVisa.url, alt: "Visa Secure" },
  { src: sealSafekey.url, alt: "SafeKey" },
];

export type PayMethod = "pix" | "card";

/** Versão pequena (240px WebP) e cacheável da imagem enviada no painel. */
function iconSrc(url: string) {
  return sizedImage(stableMediaUrl(url), 240);
}

/** Bandeira padrão local (desenhada no próprio código, aparece na hora). */
function LocalBrand({ name, small }: { name: string; small?: boolean | undefined }) {
  const cls = `grid place-items-center rounded-[4px] border border-border bg-card font-black ${small ? "h-5 w-8 text-[7px]" : "h-6 w-10 text-[8px]"}`;
  const n = name.toLowerCase();
  if (n.includes("master")) return <span className={cls}><span className="flex"><span className="size-2.5 rounded-full bg-[#eb001b]" /><span className="-ml-1 size-2.5 rounded-full bg-[#f79e1b] opacity-90" /></span></span>;
  if (n.includes("visa")) return <span className={`${cls} italic text-[#1a1f71]`}>VISA</span>;
  if (n.includes("elo")) return <span className={`${cls} text-foreground`}>elo</span>;
  if (n.includes("amex") || n.includes("american")) return <span className={`${cls} border-[#2e77bc] bg-[#2e77bc] text-[6px] leading-[7px] text-white`}>AMERICAN<br />EXPRESS</span>;
  return <span className={cls}><CreditCard size={small ? 11 : 13} /></span>;
}

function BrandImg({ url, name, small }: { url: string; name: string; small?: boolean | undefined }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <LocalBrand name={name} small={small} />;
  const h = small ? 20 : 24;
  return <img src={iconSrc(url)} alt={name || "Bandeira"} title={name} width={Math.round(h * 1.6)} height={h} style={{ height: h }} className="w-auto max-w-[48px] rounded-[4px] object-contain" loading="eager" fetchPriority="high" decoding="async" onError={() => setFailed(true)} />;
}

function PixLogo({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <PixIcon size={22} />;
  return <img src={iconSrc(url)} alt="Pix" width={22} height={22} className="size-[22px] shrink-0 object-contain" loading="eager" fetchPriority="high" decoding="async" onError={() => setFailed(true)} />;
}

/** Baixa os ícones de pagamento assim que o checkout abre (mesmo endereço = cache reaproveitado). */
export function usePreloadPaymentIcons(cfg: PaymentMethodsConfig | null | undefined) {
  const key = cfg ? [cfg.pix.icon_url, ...cfg.card.brands.filter((b) => b.enabled).map((b) => b.url)].filter(Boolean).join("|") : "";
  useEffect(() => {
    if (!key) return;
    for (const u of key.split("|")) {
      const href = iconSrc(u);
      if (document.head.querySelector(`link[rel="preload"][href="${CSS.escape(href)}"]`)) continue;
      const l = document.createElement("link");
      l.rel = "preload"; l.as = "image"; l.href = href;
      l.setAttribute("fetchpriority", "high");
      document.head.appendChild(l);
    }
  }, [key]);
}

export function CardBrands({ small, cfg }: { small?: boolean; cfg?: PaymentMethodsConfig }) {
  const custom = cfg?.card.brands.filter((b) => b.enabled) ?? [];
  if (cfg && cfg.card.brands.length > 0) {
    return (
      <span className="flex flex-wrap items-center gap-1">
        {custom.map((b) => <BrandImg key={b.id} url={b.url} name={b.name} small={small} />)}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1" aria-label="Mastercard, Visa, Elo, American Express">
      {["Mastercard", "Visa", "Elo", "American Express"].map((n) => <LocalBrand key={n} name={n} small={small} />)}
    </span>
  );
}

function Radio({ on }: { on: boolean }) {
  return on ? (
    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary"><span className="size-2.5 rounded-full bg-primary-foreground" /></span>
  ) : (
    <span className="size-6 shrink-0 rounded-full border-2 border-border" />
  );
}

/** Lista "Forma de pagamento" no resumo do pedido. */
export function PaymentMethodList({ cfg, method, showCard, totalCents, onSelect, onOpenCard }: {
  cfg: PaymentMethodsConfig;
  method: PayMethod;
  showCard: boolean;
  totalCents: number;
  onSelect: (m: PayMethod) => void;
  onOpenCard: () => void;
}) {
  const [plans, setPlans] = useState(false);
  usePreloadPaymentIcons(cfg);
  return (
    <div className="divide-y divide-border">
      {cfg.pix.enabled && (
        <button type="button" onClick={() => onSelect("pix")} className="flex w-full items-start gap-3 py-3 text-left">
          <PixLogo url={cfg.pix.icon_url} />
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold">Pix</span>
            {cfg.pix.text && <span className="block text-[12px] text-muted-foreground">{cfg.pix.text}</span>}
            {cfg.pix.discount_enabled && cfg.pix.discount_text && <span className="mt-1 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[11.5px] font-bold text-primary">{cfg.pix.discount_text}</span>}
          </span>
          <Radio on={method === "pix"} />
        </button>
      )}
      {showCard && (
        <div className="py-3">
          <button type="button" onClick={() => { if (cardProviderReady(cfg)) onSelect("card"); onOpenCard(); }} className="flex w-full items-start gap-3 text-left">
            <span className="grid size-6 shrink-0 place-items-center rounded bg-surface"><CreditCard size={14} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold">{cfg.card.title}</span>
              {cfg.card.show_brands && <span className="mt-1.5 block"><CardBrands cfg={cfg} /></span>}
              {cfg.card.text && <span className="mt-1 block text-[12px] text-muted-foreground">{cfg.card.text}</span>}
            </span>
            <Radio on={method === "card"} />
          </button>
          {cfg.card.highlight && (
            <button type="button" onClick={() => setPlans(true)} className="ml-9 mt-1 inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-[11.5px] font-bold text-primary">
              {cfg.card.highlight} <ChevronRight size={12} />
            </button>
          )}
        </div>
      )}
      {plans && <InstallmentsSheet cfg={cfg} totalCents={totalCents} onClose={() => setPlans(false)} />}
    </div>
  );
}

function Sheet({ children, onClose, full }: { children: React.ReactNode; onClose: () => void; full?: boolean }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { cancelAnimationFrame(t); document.body.style.overflow = prev; };
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center">
      <button type="button" aria-label="Fechar" onClick={onClose} className={`absolute inset-0 bg-foreground/40 transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`} />
      <div className={`relative flex w-full max-w-[520px] flex-col overflow-hidden rounded-t-2xl bg-card transition-transform duration-300 ease-out ${full ? "h-[94dvh]" : "max-h-[85dvh]"} ${shown ? "translate-y-0" : "translate-y-full"}`}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function InstallmentsSheet({ cfg, totalCents, onClose }: { cfg: PaymentMethodsConfig; totalCents: number; onClose: () => void }) {
  const plan = installmentPlan(totalCents, cfg);
  return (
    <Sheet onClose={onClose}>
      <header className="relative border-b border-border px-4 py-4 text-center text-[16px] font-bold">
        Opções de parcelamento
        <button type="button" onClick={onClose} aria-label="Fechar" className="absolute right-3 top-3.5"><X size={20} /></button>
      </header>
      <ul className="overflow-y-auto px-4 pb-6">
        {plan.map((p) => (
          <li key={p.n} className="flex items-center justify-between border-b border-border py-3 text-[13.5px]">
            <span><strong>{p.n}x</strong> de {brl(p.installmentCents / 100)}</span>
            <span className="text-right">
              {p.free ? <span className="font-bold text-primary">sem juros</span> : <span className="text-muted-foreground">juros {p.rate.toLocaleString("pt-BR")}%</span>}
              <span className="block text-[11.5px] text-muted-foreground">Total {brl(p.totalCents / 100)}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="px-4 pb-5 text-[11px] text-muted-foreground">Valores calculados com as condições da loja. O gateway confirma as condições finais no pagamento.</p>
    </Sheet>
  );
}

type Errs = Partial<Record<"number" | "expiry" | "cvv" | "holder" | "form", string>>;

function brandOf(digits: string): string | null {
  if (/^3[47]/.test(digits)) return "American Express";
  if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(digits)) return "Elo";
  if (/^4/.test(digits)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "Mastercard";
  return null;
}
function luhn(d: string) {
  let s = 0;
  for (let i = 0; i < d.length; i++) { let n = Number(d[d.length - 1 - i]); if (i % 2) { n *= 2; if (n > 9) n -= 9; } s += n; }
  return s % 10 === 0;
}

/**
 * Tela "Adicionar cartão". Os dados ficam só em memória deste componente e somem ao fechar;
 * nada é salvo nem enviado ao nosso servidor. A tokenização acontecerá no SDK do gateway.
 */
export function AddCardSheet({ cfg, totalCents, onClose, customerName = "", onPayPix, prepareOrder, onPaid }: { cfg: PaymentMethodsConfig; totalCents: number; onClose: () => void; customerName?: string; onPayPix?: (orderNo: string | null) => void; prepareOrder?: () => Promise<string | null>; onPaid?: (orderNumber: string) => void }) {
  const payCard = useServerFn(payOrderWithCard);
  const wappiConfig = useServerFn(getWappiCardConfig);
  const wappiConfirm = useServerFn(confirmWappiCardPayment);
  const [wappiSettings, setWappiSettings] = useState<WappiThreeDSSettings | null>(null);
  const iframeRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [installments, setInstallments] = useState(1);
  const [orderNo, setOrderNo] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [holder, setHolder] = useState("");
  const [errors, setErrors] = useState<Errs>({});
  const [plans, setPlans] = useState(false);
  const [tip, setTip] = useState(false);
  const ready = cardProviderReady(cfg);
  const digits = number.replace(/\D/g, "");
  const brand = brandOf(digits);

  function validate() {
    const e: Errs = {};
    if (!digits) e.number = "Número do cartão é obrigatório";
    else if (!brand || digits.length < 14 || !luhn(digits)) e.number = "Número do cartão inválido";
    const m = /^(\d{2})\/(\d{2})$/.exec(expiry);
    if (!expiry) e.expiry = "Data de validade é obrigatória";
    else if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) e.expiry = "Data inválida";
    else {
      const end = new Date(2000 + Number(m[2]), Number(m[1]), 1);
      if (end <= new Date()) e.expiry = "Cartão vencido";
    }
    const cvvLen = brand === "American Express" ? 4 : 3;
    if (!cvv) e.cvv = "Código de segurança é obrigatório";
    else if (cvv.length !== cvvLen) e.cvv = "Código inválido";
    if (holder.trim().split(/\s+/).length < 2) e.holder = "Informe o nome como está no cartão";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  /** Wappi Brasil: tokeniza no SDK oficial, cria a transação e conclui o 3DS no navegador. */
  async function submitWappi(no: string) {
    const cfgRes = await wappiConfig({ data: { order_number: no } });
    if (!cfgRes.available || !cfgRes.publicKey) { setErrors({}); setUnavailable(true); return; }
    const settings = await wappiCardSettings(cfgRes.publicKey);
    setWappiSettings(settings);
    const plan = installmentPlan(totalCents, cfg).find((p) => p.n === installments);
    await prepareWappiThreeDS(plan?.totalCents ?? totalCents, installments);
    const m = /^(\d{2})\/(\d{2})$/.exec(expiry)!;
    // O cartão aberto vai só para o SDK da Wappi; o nosso servidor recebe apenas o token.
    const hash = await tokenizeWappiCard({ number: digits, holderName: holder.trim(), expMonth: Number(m[1]), expYear: 2000 + Number(m[2]), cvv });
    setCvv("");
    const res = await payCard({ data: { order_number: no, installments, card_hash: hash } });
    if (res.status === "paid") { setNumber(""); onPaid!(no); return; }
    if (res.status === "refused") { setNumber(""); setExpiry(""); setErrors({}); setDeclined(true); return; }
    if (res.status === "unavailable" || res.status === "error") {
      if (res.status === "error") console.error("[card] falha no pagamento", res.error);
      setErrors({}); setUnavailable(true);
      return;
    }
    // Pendente: quando há 3DS, o SDK conduz a autenticação com a transação criada.
    const tx = (res as { transaction?: unknown }).transaction;
    if (tx) {
      try {
        await finishWappiThreeDS(tx);
      } catch {
        // Desafio interrompido: o status real será confirmado pela reconsulta abaixo.
      }
    }
    // A resposta do navegador é só experiência: o servidor reconfirma na API da Wappi.
    const final = await wappiConfirm({ data: { order_number: no } });
    if (final.status === "paid") { setNumber(""); onPaid!(no); return; }
    if (final.status === "refused") { setNumber(""); setExpiry(""); setErrors({}); setDeclined(true); return; }
    if (final.status === "error") { console.error("[card] confirmação falhou", final.error); setErrors({}); setUnavailable(true); return; }
    setErrors({ form: "Pagamento em análise pelo banco. Você receberá a confirmação assim que for aprovado." });
  }

  async function submit() {
    if (busy || !validate()) return;
    if (!ready) { setErrors({ form: "O pagamento com cartão ainda não está disponível nesta loja. Escolha Pix para concluir." }); return; }
    if (!prepareOrder || !onPaid) { setErrors({ form: "Não foi possível iniciar o pagamento com cartão agora." }); return; }
    setBusy(true);
    try {
      // O mesmo pedido é reaproveitado ao tentar outro cartão.
      const no = orderNo ?? (await prepareOrder());
      if (!no) return;
      setOrderNo(no);
      if (cfg.card.provider === "wappi") {
        await submitWappi(no);
        return;
      }
      const m = /^(\d{2})\/(\d{2})$/.exec(expiry)!;
      const res = await payCard({ data: { order_number: no, installments, card: { number: digits, holder_name: holder.trim(), expiration_month: Number(m[1]), expiration_year: 2000 + Number(m[2]), cvv } } });
      if (res.status === "paid") { setNumber(""); setCvv(""); onPaid(no); return; }
      if (res.status === "refused") {
        // Recusa real do gateway: limpa os dados sensíveis e mostra a escolha.
        setNumber(""); setExpiry(""); setCvv(""); setErrors({}); setDeclined(true);
        return;
      }
      if (res.status === "unavailable") { setErrors({}); setUnavailable(true); return; }
      if (res.status === "pending") { setErrors({ form: "Pagamento em análise pelo banco. Você receberá a confirmação assim que for aprovado." }); return; }
      // Qualquer outra falha: nunca mostra erro técnico; abre a recuperação pelo PIX.
      console.error("[card] falha no pagamento", res.error);
      setErrors({}); setUnavailable(true);
    } catch {
      // Erro de rede até o nosso servidor também é instabilidade, não recusa.
      setErrors({}); setUnavailable(true);
    } finally {
      setBusy(false);
    }
  }

  // Wappi com 3DS tipo IFRAME: embute o iframe da adquirente dentro do formulário.
  useEffect(() => {
    if (wappiSettings?.threeDSSecurityType === "IFRAME" && iframeRef.current) {
      try {
        mountWappiIframe(wappiSettings, iframeRef.current);
      } catch { /* SDK indisponível: o finishThreeDS ainda tenta conduzir a autenticação */ }
    }
  }, [wappiSettings]);

  const field = (err?: string) => `h-12 w-full rounded-xl px-3.5 text-[16px] outline-none ${err ? "border-2 border-destructive bg-card" : "bg-surface focus:ring-2 focus:ring-primary/30"}`;
  const Err = ({ k }: { k: keyof Errs }) => (errors[k] ? <p className="mt-1 flex items-center gap-1 text-[12.5px] font-semibold text-destructive"><AlertTriangle size={14} /> {errors[k]}</p> : null);

  if (declined) {
    const d = cfg.decline;
    const off = pixDiscountLabel(cfg);
    return (
      <Sheet onClose={onClose}>
        <div className="space-y-4 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-6 text-center">
          <XCircle size={44} className="mx-auto text-destructive" />
          <h2 className="text-[18px] font-bold">{d.title}</h2>
          <p className="text-[14px] text-muted-foreground">{fillDeclineMessage(d.message, customerName)}</p>
          <div className="space-y-2.5 pt-1">
            {cfg.pix.enabled && onPayPix && (
              <Button type="button" className="h-12 w-full rounded-full text-[15px] font-bold" onClick={() => { setNumber(""); setExpiry(""); setCvv(""); setErrors({}); onPayPix(orderNo); }}>{d.pix_label}</Button>
            )}
            {cfg.pix.enabled && off && <p className="text-[12.5px] font-semibold text-primary">{d.pix_benefit.replace(/\{desconto\}/g, off)}</p>}
            <Button type="button" variant="outline" className="h-12 w-full rounded-full text-[15px] font-bold" onClick={() => setDeclined(false)}>{d.retry_label}</Button>
          </div>
        </div>
      </Sheet>
    );
  }

  if (unavailable) {
    const t = cfg.provider_error;
    return (
      <Sheet onClose={onClose}>
        <div className="space-y-4 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-6">
          <div className="rounded-2xl bg-destructive/10 p-4 text-center">
            <AlertTriangle size={36} className="mx-auto text-destructive" />
            <h2 className="mt-2 text-[17px] font-bold text-destructive">{t.title}</h2>
            <p className="mt-1 text-[13.5px] text-destructive/90">{t.message}</p>
          </div>
          <div className="space-y-2.5">
            {cfg.pix.enabled && onPayPix && (
              <Button type="button" className="h-12 w-full rounded-full text-[15px] font-bold" onClick={() => { setNumber(""); setExpiry(""); setCvv(""); setErrors({}); onPayPix(orderNo); }}>{t.pix_label}</Button>
            )}
            {cfg.pix.enabled && pixDiscountLabel(cfg) && <p className="text-center text-[12.5px] font-semibold text-primary">{cfg.decline.pix_benefit.replace(/\{desconto\}/g, pixDiscountLabel(cfg) ?? "")}</p>}
            <Button type="button" variant="ghost" disabled={busy} className="h-11 w-full rounded-full text-[14px] font-semibold text-muted-foreground" onClick={() => { setUnavailable(false); void submit(); }}>
              {busy ? <><Loader2 size={16} className="animate-spin" /> Processando...</> : t.retry_label}
            </Button>
          </div>
        </div>
      </Sheet>
    );
  }

  if (!ready) {
    return (
      <Sheet onClose={onClose}>
        <header className="flex items-center justify-between border-b border-border px-4 py-4">
          <h2 className="text-[17px] font-bold">{cfg.card.title}</h2>
          <Button type="button" variant="ghost" size="icon" aria-label="Fechar" onClick={onClose}><X size={20} /></Button>
        </header>
        <div className="space-y-4 px-4 py-5">
          <CreditCard size={28} className="text-muted-foreground" />
          <p className="text-[14px] text-muted-foreground">O pagamento com cartão está temporariamente indisponível nesta loja.{cfg.pix.enabled ? " Você pode concluir seu pedido com PIX." : " Tente novamente mais tarde."}</p>
          <Button type="button" className="w-full" onClick={onClose}>{cfg.pix.enabled ? "Voltar para pagar com PIX" : "Voltar ao pedido"}</Button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onClose} full>
      <header className="relative border-b border-border px-12 py-3 text-center text-[16px] font-bold">
        <button type="button" onClick={onClose} aria-label="Voltar" className="absolute left-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center"><ChevronLeft size={24} /></button>
        Adicionar cartão
      </header>
      {cfg.card.promo_enabled && cfg.card.promo_text && (
        <div className="flex min-w-0 items-center gap-2 bg-primary/10 px-4 py-2 text-[12.5px]">
          <CreditCard size={16} className="shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate">{cfg.card.promo_text}</span>
          <button type="button" onClick={() => setPlans(true)} className="flex shrink-0 items-center text-[12.5px] font-semibold text-primary">Visualizar tudo ({cfg.card.max_installments}) <ChevronRight size={14} /></button>
        </div>
      )}
      <div className="flex-1 space-y-3.5 overflow-y-auto px-4 py-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2"><label htmlFor="cc-number" className="shrink-0 text-[14px] font-bold">Número do cartão</label><CardBrands small cfg={cfg} /></div>
          <input id="cc-number" inputMode="numeric" autoComplete="cc-number" placeholder="Insira o número do cartão" value={number}
            onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 "))} className={field(errors.number)} />
          {brand && !errors.number && <p className="mt-1 text-[12px] text-muted-foreground">{brand}</p>}
          <Err k="number" />
        </div>
        <div className="grid grid-cols-2 items-end gap-2.5">
          <div className="min-w-0">
            <label htmlFor="cc-exp" className="mb-1.5 block truncate text-[14px] font-bold">Data de validade</label>
            <input id="cc-exp" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" value={expiry}
              onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 4); setExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d); }} className={field(errors.expiry)} />
            <Err k="expiry" />
          </div>
          <div className="min-w-0">
            <label htmlFor="cc-cvv" className="mb-1.5 flex min-w-0 items-center gap-1 text-[14px] font-bold"><span className="truncate">Código de segurança</span> <button type="button" aria-label="O que é" onClick={() => setTip((v) => !v)}><Info size={15} className="text-muted-foreground" /></button></label>
            <input id="cc-cvv" inputMode="numeric" autoComplete="cc-csc" placeholder="CVV/CVC" value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} className={field(errors.cvv)} />
            {tip && <p className="mt-1 text-[12px] text-muted-foreground">O código de segurança normalmente fica no verso do cartão.</p>}
            <Err k="cvv" />
          </div>
        </div>
        <div>
          <label htmlFor="cc-name" className="mb-1.5 block text-[14px] font-bold">Nome do titular do cartão</label>
          <input id="cc-name" autoComplete="cc-name" placeholder="Nome completo" value={holder} onChange={(e) => setHolder(e.target.value.slice(0, 60))} className={field(errors.holder)} />
          <Err k="holder" />
        </div>
        {wappiSettings?.threeDSSecurityType === "IFRAME" && <div ref={iframeRef} className="overflow-hidden rounded-xl" />}
        <div>
          <label htmlFor="cc-inst" className="mb-1.5 block text-[14px] font-bold">Parcelas</label>
          <select id="cc-inst" value={installments} onChange={(e) => setInstallments(Number(e.target.value))} className={field()}>
            {installmentPlan(totalCents, cfg).map((p) => (
              <option key={p.n} value={p.n}>{p.n}x de {brl(p.installmentCents / 100)}{p.free ? " sem juros" : ` (total ${brl(p.totalCents / 100)})`}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-warning/10 px-3.5 py-2.5 text-[12.5px] leading-snug text-foreground/80">
          <p className="min-w-0 flex-1">Suas informações de pagamento serão processadas de forma segura. O código de segurança (CVV/CVC) nunca será armazenado.</p>
          <ShieldCheck size={24} className="shrink-0 text-warning" />
        </div>
        {(() => {
          if (!cfg.card.show_seals) return null;
          const custom = cfg.card.seals.filter((s) => s.enabled && s.url);
          if (custom.length > 0) {
            return (
              <div className="flex flex-nowrap items-center justify-center gap-2.5" aria-label="Pagamento protegido">
                {custom.map((s) => (
                  <img key={s.id} src={iconSrc(s.url)} alt={s.name || "Selo"} title={s.name} width={90} height={44} className="h-[44px] w-auto min-w-0 max-w-[90px] flex-1 object-contain" loading="eager" decoding="async" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                ))}
              </div>
            );
          }
          return (
            <div className="flex flex-nowrap items-center justify-center gap-2.5" aria-label="Pagamento protegido">
              {SECURITY_SEALS.map((s) => (
                <img key={s.alt} src={s.src} alt={s.alt} title={s.alt} width={90} height={90} className="h-auto min-w-0 max-w-[90px] flex-1 object-contain" style={{ aspectRatio: "1 / 1" }} loading="eager" decoding="async" />
              ))}
            </div>
          );
        })()}
        {errors.form && <p className="rounded-xl bg-destructive/10 px-4 py-3 text-[13px] font-semibold text-destructive">{errors.form}</p>}
      </div>
      <footer className="border-t border-border px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2.5">
        <button type="button" onClick={submit} disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-[16px] font-bold text-primary-foreground active:scale-[0.99] disabled:opacity-70">{busy && <Loader2 size={18} className="animate-spin" />}{busy ? "Processando pagamento..." : "Pagar com cartão"}</button>
      </footer>
      {plans && <InstallmentsSheet cfg={cfg} totalCents={totalCents} onClose={() => setPlans(false)} />}
    </Sheet>
  );
}
