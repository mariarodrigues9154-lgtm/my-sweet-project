import { CARD_PROVIDERS, DEFAULT_DECLINE, DEFAULT_PROVIDER_ERROR, cardProviderReady, installmentPlan, resolvePaymentMethods, type PaymentMethodsConfig } from "@/lib/payment-methods";
import { brl } from "@/lib/format";

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

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-lg border border-border p-3">
        <p className="text-[13px] font-extrabold">PIX</p>
        <Check label="Ativar PIX" checked={cfg.pix.enabled} onChange={(v) => pix({ enabled: v })} />
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
        {cfg.card.enabled && !ready && <p className="text-[11.5px] text-muted-foreground">Ao selecionar cartão, o cliente verá um aviso de indisponibilidade e poderá voltar para pagar com PIX, sem informar dados do cartão.</p>}
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2"><Field label="Título"><input className={input} value={cfg.card.title} onChange={(e) => card({ title: e.target.value })} /></Field></div>
          <div className="col-span-2"><Field label="Texto"><input className={input} value={cfg.card.text} onChange={(e) => card({ text: e.target.value })} /></Field></div>
          <div className="col-span-2"><Field label="Destaque (chip rosa)"><input className={input} value={cfg.card.highlight} onChange={(e) => card({ highlight: e.target.value })} /></Field></div>
          <Field label="Máximo de parcelas"><input type="number" min={1} max={12} className={input} value={cfg.card.max_installments} onChange={(e) => card({ max_installments: Number(e.target.value) })} /></Field>
          <Field label="Parcelas sem juros"><input type="number" min={1} max={cfg.card.max_installments} className={input} value={cfg.card.free_installments} onChange={(e) => card({ free_installments: Number(e.target.value) })} /></Field>
        </div>
        <Check label="Mostrar bandeiras" checked={cfg.card.show_brands} onChange={(v) => card({ show_brands: v })} />
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
