import { CARD_PROVIDERS, cardProviderReady, installmentPlan, resolvePaymentMethods, type PaymentMethodsConfig } from "@/lib/payment-methods";
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
          Status: {ready ? "Pronto para cobrar" : "Aguardando integração com gateway — o cartão fica oculto para clientes."}
        </p>
        {cfg.card.enabled && !ready && <p className="text-[11.5px] text-muted-foreground">Para ver a tela do cartão, abra o checkout com <code>?preview_cartao=1</code> no fim do endereço.</p>}
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
