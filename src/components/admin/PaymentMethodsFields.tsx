import { CARD_PROVIDERS, DEFAULT_DECLINE, DEFAULT_PROVIDER_ERROR, cardProviderReady, installmentPlan, resolvePaymentMethods, type PaymentMethodsConfig } from "@/lib/payment-methods";
import { brl } from "@/lib/format";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Trash2, Upload } from "lucide-react";
import { createMediaUpload, finalizeMediaUpload } from "@/lib/admin.functions";
import { IMAGE_ACCEPT, uploadMedia } from "@/lib/media-upload";
import { stableMediaUrl } from "@/lib/media-url";
import { PixIcon } from "@/components/store/VerifiedBadge";

function useImageUpload() {
  const create = useServerFn(createMediaUpload);
  const finalize = useServerFn(finalizeMediaUpload);
  const [busy, setBusy] = useState(false);
  async function run(file: File): Promise<string | null> {
    if (!file.type.startsWith("image/")) { toast.error("Envie uma imagem (PNG, JPG, WebP ou SVG)."); return null; }
    setBusy(true);
    try { return await uploadMedia(file, create as never, finalize as never); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha no envio."); return null; }
    finally { setBusy(false); }
  }
  return { busy, run };
}

function PickButton({ label, busy, onFile }: { label: string; busy: boolean; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-[12px] font-bold disabled:opacity-60">
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} {label}
      </button>
      <input ref={ref} type="file" accept={IMAGE_ACCEPT} hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
    </>
  );
}

const input = "h-9 w-full rounded-md border border-border bg-card px-2 text-[13px]";

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-[13px] font-semibold">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[12px] font-bold text-muted-foreground">{label}<div className="mt-1">{children}</div></label>;
}

export function PaymentMethodsFields({ value, onChange }: { value: unknown; onChange: (v: PaymentMethodsConfig) => void }) {
  const cfg = resolvePaymentMethods(value);
  const pix = (p: Partial<PaymentMethodsConfig["pix"]>) => onChange({ ...cfg, pix: { ...cfg.pix, ...p } });
  const card = (p: Partial<PaymentMethodsConfig["card"]>) => onChange(resolvePaymentMethods({ ...cfg, card: { ...cfg.card, ...p } }));
  const perr = (p: Partial<PaymentMethodsConfig["provider_error"]>) => onChange({ ...cfg, provider_error: { ...cfg.provider_error, ...p } });
  const decline = (p: Partial<PaymentMethodsConfig["decline"]>) => onChange({ ...cfg, decline: { ...cfg.decline, ...p } });
  const ready = cardProviderReady(cfg);
  const example = installmentPlan(11700, cfg);
  const pixUp = useImageUpload();
  const brandUp = useImageUpload();
  const brands = cfg.card.brands;
  const setBrands = (b: typeof brands) => card({ brands: b });
  const moveBrand = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= brands.length) return; const n = [...brands]; const t = n[i]!; n[i] = n[j]!; n[j] = t; setBrands(n); };
  const sealUp = useImageUpload();
  const seals = cfg.card.seals;
  const setSeals = (b: typeof seals) => card({ seals: b });
  const moveSeal = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= seals.length) return; const n = [...seals]; const t = n[i]!; n[i] = n[j]!; n[j] = t; setSeals(n); };

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-lg border border-border p-3">
        <p className="text-[13px] font-extrabold">PIX</p>
        <Check label="Ativar PIX" checked={cfg.pix.enabled} onChange={(v) => pix({ enabled: v })} />
        <div className="flex items-center gap-3 rounded-md border border-border p-2.5">
          <span className="grid size-14 shrink-0 place-items-center rounded-md bg-surface">
            {cfg.pix.icon_url ? <img src={stableMediaUrl(cfg.pix.icon_url)} alt="Ícone Pix" className="size-11 object-contain" /> : <PixIcon size={30} />}
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-[12px] font-extrabold">Ícone do Pix</p>
            <p className="text-[11px] text-muted-foreground">PNG/SVG quadrado, de preferência 256×256 ou maior.</p>
            <div className="flex flex-wrap gap-1.5">
              <PickButton label={cfg.pix.icon_url ? "Substituir" : "Enviar imagem"} busy={pixUp.busy} onFile={async (f) => { const url = await pixUp.run(f); if (url) pix({ icon_url: url }); }} />
              {cfg.pix.icon_url && <button type="button" onClick={() => pix({ icon_url: "" })} className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-[12px] font-bold text-destructive"><Trash2 size={13} /> Remover</button>}
            </div>
          </div>
        </div>
        <Field label="Texto do PIX"><input className={input} value={cfg.pix.text} onChange={(e) => pix({ text: e.target.value })} /></Field>
        <Check label="Desconto no PIX" checked={cfg.pix.discount_enabled} onChange={(v) => pix({ discount_enabled: v })} />
        {cfg.pix.discount_enabled && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tipo">
              <select className={input} value={cfg.pix.discount_type} onChange={(e) => pix({ discount_type: e.target.value as "percent" | "fixed" })}>
                <option value="percent">Percentual (%)</option>
                <option value="fixed">Valor fixo (R$)</option>
              </select>
            </Field>
            <Field label="Valor"><input type="number" min={0} step="0.01" className={input} value={cfg.pix.discount_value} onChange={(e) => pix({ discount_value: Number(e.target.value) })} /></Field>
            <div className="col-span-2"><Field label="Texto do desconto"><input className={input} placeholder="Pague via PIX e economize 5%" value={cfg.pix.discount_text} onChange={(e) => pix({ discount_text: e.target.value })} /></Field></div>
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-border p-3">
        <p className="text-[13px] font-extrabold">Cartão de crédito</p>
        <Check label="Ativar cartão de crédito" checked={cfg.card.enabled} onChange={(v) => card({ enabled: v })} />
        <Field label="Gateway do cartão">
          <select className={input} value={cfg.card.provider} onChange={(e) => card({ provider: e.target.value as never })}>
            {CARD_PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <p className={`rounded-md px-3 py-2 text-[12px] font-semibold ${ready ? "bg-success-soft text-success" : "bg-surface text-muted-foreground"}`}>
          Status: {ready ? "Pronto para cobrar" : "Aguardando integração com gateway — quando ativado, o cartão aparece para clientes, mas não realiza cobranças."}
        </p>
        {cfg.card.provider === "wappi" && (
          <p className="rounded-md bg-surface px-3 py-2 text-[11.5px] text-muted-foreground">
            A Wappi Brasil usa as mesmas credenciais (PUBLIC_KEY e SECRET_KEY) salvas em <strong>Checkout e Pagamentos</strong>, onde você também testa a conexão. O cartão é tokenizado no navegador do cliente pelo SDK oficial com autenticação 3DS — os dados do cartão nunca passam pelo nosso servidor. O gateway de PIX continua independente.
          </p>
        )}
        {cfg.card.enabled && !ready && <p className="text-[11.5px] text-muted-foreground">Ao selecionar cartão, o cliente verá um aviso de indisponibilidade e poderá voltar para pagar com PIX, sem informar dados do cartão.</p>}
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2"><Field label="Título"><input className={input} value={cfg.card.title} onChange={(e) => card({ title: e.target.value })} /></Field></div>
          <div className="col-span-2"><Field label="Texto"><input className={input} value={cfg.card.text} onChange={(e) => card({ text: e.target.value })} /></Field></div>
          <div className="col-span-2"><Field label="Destaque (chip rosa)"><input className={input} value={cfg.card.highlight} onChange={(e) => card({ highlight: e.target.value })} /></Field></div>
          <Field label="Máximo de parcelas"><input type="number" min={1} max={12} className={input} value={cfg.card.max_installments} onChange={(e) => card({ max_installments: Number(e.target.value) })} /></Field>
          <Field label="Parcelas sem juros"><input type="number" min={1} max={cfg.card.max_installments} className={input} value={cfg.card.free_installments} onChange={(e) => card({ free_installments: Number(e.target.value) })} /></Field>
        </div>
        <Check label="Mostrar bandeiras" checked={cfg.card.show_brands} onChange={(v) => card({ show_brands: v })} />
        <div className="space-y-2 rounded-md border border-border p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-extrabold">Bandeiras do cartão</p>
            <PickButton label="Adicionar bandeira" busy={brandUp.busy} onFile={async (f) => { const url = await brandUp.run(f); if (url) setBrands([...brands, { id: crypto.randomUUID().slice(0, 12), name: f.name.replace(/\.[^.]+$/, "").slice(0, 40), url, enabled: true }]); }} />
          </div>
          <p className="text-[11px] text-muted-foreground">Aparecem na lista de pagamento e na tela de dados do cartão. Use PNG/SVG em alta resolução (ex.: 200×128). Sem bandeiras enviadas, usamos as padrão.</p>
          {brands.length > 0 && (
            <ul className="space-y-1.5">
              {brands.map((b, i) => (
                <li key={b.id} className="flex items-center gap-2 rounded-md bg-surface p-1.5">
                  <span className="grid h-9 w-14 shrink-0 place-items-center rounded bg-card"><img src={stableMediaUrl(b.url)} alt={b.name} className="max-h-7 max-w-12 object-contain" /></span>
                  <input className={`${input} h-8 min-w-0 flex-1`} value={b.name} placeholder="Nome" onChange={(e) => setBrands(brands.map((x) => (x.id === b.id ? { ...x, name: e.target.value } : x)))} />
                  <input type="checkbox" title="Exibir" checked={b.enabled} onChange={(e) => setBrands(brands.map((x) => (x.id === b.id ? { ...x, enabled: e.target.checked } : x)))} />
                  <button type="button" aria-label="Subir" onClick={() => moveBrand(i, -1)} className="p-1"><ArrowUp size={14} /></button>
                  <button type="button" aria-label="Descer" onClick={() => moveBrand(i, 1)} className="p-1"><ArrowDown size={14} /></button>
                  <PickButton label="" busy={brandUp.busy} onFile={async (f) => { const url = await brandUp.run(f); if (url) setBrands(brands.map((x) => (x.id === b.id ? { ...x, url } : x))); }} />
                  <button type="button" aria-label="Remover" onClick={() => setBrands(brands.filter((x) => x.id !== b.id))} className="p-1 text-destructive"><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-2 rounded-md border border-border p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-extrabold">Logos / Selos do pagamento</p>
            {seals.length < 5 && <PickButton label="Adicionar imagem" busy={sealUp.busy} onFile={async (f) => { const url = await sealUp.run(f); if (url) setSeals([...seals, { id: crypto.randomUUID().slice(0, 12), name: f.name.replace(/\.[^.]+$/, "").slice(0, 40), url, enabled: true }]); }} />}
          </div>
          <Check label="Exibir logos de segurança" checked={cfg.card.show_seals} onChange={(v) => card({ show_seals: v })} />
          <p className="text-[11px] text-muted-foreground">Aparecem abaixo do aviso de segurança na tela "Adicionar cartão". Até 5 imagens. Só envie selos que seu gateway realmente suporta.</p>
          {seals.length > 0 && (
            <ul className="space-y-1.5">
              {seals.map((b, i) => (
                <li key={b.id} className="flex items-center gap-2 rounded-md bg-surface p-1.5">
                  <span className="grid h-9 w-14 shrink-0 place-items-center rounded bg-card"><img src={stableMediaUrl(b.url)} alt={b.name} className="max-h-7 max-w-12 object-contain" /></span>
                  <input className={`${input} h-8 min-w-0 flex-1`} value={b.name} placeholder="Nome" onChange={(e) => setSeals(seals.map((x) => (x.id === b.id ? { ...x, name: e.target.value } : x)))} />
                  <input type="checkbox" title="Ativa" checked={b.enabled} onChange={(e) => setSeals(seals.map((x) => (x.id === b.id ? { ...x, enabled: e.target.checked } : x)))} />
                  <button type="button" aria-label="Subir" onClick={() => moveSeal(i, -1)} className="p-1"><ArrowUp size={14} /></button>
                  <button type="button" aria-label="Descer" onClick={() => moveSeal(i, 1)} className="p-1"><ArrowDown size={14} /></button>
                  <PickButton label="" busy={sealUp.busy} onFile={async (f) => { const url = await sealUp.run(f); if (url) setSeals(seals.map((x) => (x.id === b.id ? { ...x, url } : x))); }} />
                  <button type="button" aria-label="Remover" onClick={() => setSeals(seals.filter((x) => x.id !== b.id))} className="p-1 text-destructive"><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Check label="Mostrar faixa promocional" checked={cfg.card.promo_enabled} onChange={(v) => card({ promo_enabled: v })} />
        {cfg.card.promo_enabled && <Field label="Texto da faixa"><input className={input} value={cfg.card.promo_text} onChange={(e) => card({ promo_text: e.target.value })} /></Field>}
        <div className="space-y-2 rounded-md border border-border p-2.5">
          <p className="text-[12px] font-extrabold">Mensagem de cartão recusado</p>
          <p className="text-[11.5px] text-muted-foreground">Aparece só quando o gateway realmente recusar o cartão. Use {"{nome}"} para o primeiro nome do cliente e {"{desconto}"} para o desconto PIX.</p>
          <Field label="Título"><input className={input} placeholder={DEFAULT_DECLINE.title} value={cfg.decline.title} onChange={(e) => decline({ title: e.target.value })} /></Field>
          <Field label="Mensagem"><textarea rows={3} className={`${input} h-auto py-1.5`} placeholder={DEFAULT_DECLINE.message} value={cfg.decline.message} onChange={(e) => decline({ message: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Botão cartão"><input className={input} value={cfg.decline.retry_label} onChange={(e) => decline({ retry_label: e.target.value })} /></Field>
            <Field label="Botão PIX"><input className={input} value={cfg.decline.pix_label} onChange={(e) => decline({ pix_label: e.target.value })} /></Field>
          </div>
          <Field label="Texto do benefício PIX (só aparece se houver desconto)"><input className={input} value={cfg.decline.pix_benefit} onChange={(e) => decline({ pix_benefit: e.target.value })} /></Field>
        </div>
        <div className="space-y-2 rounded-md border border-border p-2.5">
          <p className="text-[12px] font-extrabold">Erro do provedor de cartão</p>
          <p className="text-[11.5px] text-muted-foreground">Aparece quando o gateway fica fora do ar, demora ou responde com erro técnico (não é recusa).</p>
          <Field label="Título"><input className={input} placeholder={DEFAULT_PROVIDER_ERROR.title} value={cfg.provider_error.title} onChange={(e) => perr({ title: e.target.value })} /></Field>
          <Field label="Mensagem"><textarea rows={3} className={`${input} h-auto py-1.5`} placeholder={DEFAULT_PROVIDER_ERROR.message} value={cfg.provider_error.message} onChange={(e) => perr({ message: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Botão 1"><input className={input} value={cfg.provider_error.retry_label} onChange={(e) => perr({ retry_label: e.target.value })} /></Field>
            <Field label="Botão 2 (PIX)"><input className={input} value={cfg.provider_error.pix_label} onChange={(e) => perr({ pix_label: e.target.value })} /></Field>
          </div>
        </div>
        <div>
          <p className="mb-1 text-[12px] font-bold text-muted-foreground">Juros total por parcela (%) — exemplo com R$ 117,00</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {example.map((p, i) => (
              <label key={p.n} className="flex items-center gap-1.5 text-[12px]">
                <span className="w-7 font-bold">{p.n}x</span>
                <input type="number" min={0} step="0.01" disabled={i < cfg.card.free_installments} className={`${input} h-8 w-16`} value={cfg.card.rates[i] ?? 0}
                  onChange={(e) => { const rates = [...cfg.card.rates]; rates[i] = Number(e.target.value); card({ rates }); }} />
                <span className="text-muted-foreground">{brl(p.installmentCents / 100)}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
