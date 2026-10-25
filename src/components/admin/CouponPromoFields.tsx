import { clock } from "@/lib/format";
import { COUPON_DEFAULTS, resolveCouponPromo, type CouponPromoSettings } from "@/lib/coupon-promo";
import { resolveCountdownSeconds } from "@/lib/store-countdown";
import { CouponBarView, CouponChipView } from "@/components/product/CouponPromo";

const input = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm";

export function CouponPromoFields({ value, onChange }: {
  value: CouponPromoSettings | undefined;
  onChange: (v: CouponPromoSettings) => void;
}) {
  const v = value ?? {};
  const cfg = resolveCouponPromo({ coupon_promo: v });
  const set = <K extends keyof CouponPromoSettings>(k: K, val: CouponPromoSettings[K]) => onChange({ ...v, [k]: val });
  const toggle = (k: "chip_enabled" | "bar_enabled" | "show_timer" | "show_close" | "show_arrow", label: string) => (
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg[k]} onChange={(e) => set(k, e.target.checked)} />{label}</label>
  );
  const colorField = (k: "bg_color" | "text_color" | "accent_color" | "border_color", label: string) => (
    <label className="grid gap-1 text-sm">{label}
      <span className="flex items-center gap-2">
        <input type="color" value={cfg[k] || "#ffffff"} onChange={(e) => set(k, e.target.value)} className="h-9 w-12 rounded border border-input" />
        <button type="button" className="text-xs text-muted-foreground underline" onClick={() => set(k, "")}>Padrão</button>
      </span>
    </label>
  );
  const oc = { hours: cfg.countdown_hours, minutes: cfg.countdown_minutes };
  return (
    <div className="grid gap-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {toggle("chip_enabled", "Ativar chip de cupom próximo ao preço")}
        {toggle("bar_enabled", "Ativar barra de cupom acima do menu inferior")}
      </div>
      <label className="grid gap-1 text-sm">Texto do chip
        <input className={input} maxLength={120} value={v.chip_text ?? ""} placeholder={COUPON_DEFAULTS.chip_text} onChange={(e) => set("chip_text", e.target.value)} />
      </label>
      <label className="grid gap-1 text-sm">Texto destacado
        <input className={input} maxLength={160} value={cfg.highlight_text} onChange={(e) => onChange({ ...v, highlight_text: e.target.value, secondary_text: cfg.secondary_text })} />
      </label>
      <label className="grid gap-1 text-sm">Texto complementar
        <input className={input} maxLength={160} value={cfg.secondary_text} onChange={(e) => onChange({ ...v, highlight_text: cfg.highlight_text, secondary_text: e.target.value })} />
      </label>
      <p className="-mt-2 text-xs text-muted-foreground">Escreva o que quiser. Use {"{percent}"} e {"{max}"} para inserir o percentual e o valor máximo.</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm">Percentual (%)<input type="number" min={0} max={100} className={input} value={cfg.percent} onChange={(e) => set("percent", Number(e.target.value) || 0)} /></label>
        <label className="grid gap-1 text-sm">Valor máximo (R$)<input type="number" min={0} step="0.01" className={input} value={cfg.max_value} onChange={(e) => set("max_value", Number(e.target.value) || 0)} /></label>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {toggle("show_timer", "Mostrar cronômetro")}
        {toggle("show_close", "Mostrar botão X")}
        {toggle("show_arrow", "Mostrar seta >")}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm">Cronômetro: horas<input type="number" min={0} max={99} className={input} value={oc.hours ?? 18} onChange={(e) => onChange({ ...v, countdown_hours: Math.max(0, Math.floor(Number(e.target.value) || 0)), countdown_minutes: oc.minutes })} /></label>
        <label className="grid gap-1 text-sm">Cronômetro: minutos<input type="number" min={0} max={59} className={input} value={oc.minutes ?? 9} onChange={(e) => onChange({ ...v, countdown_hours: oc.hours, countdown_minutes: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} /></label>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">Duração do cronômetro deste produto (vale para a faixa, barra e checkout dele).</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {colorField("bg_color", "Cor do fundo")}
        {colorField("text_color", "Cor do texto")}
        {colorField("accent_color", "Cor de destaque")}
        {colorField("border_color", "Cor da borda")}
      </div>
      <div className="grid gap-2 rounded-lg border border-dashed border-border p-3">
        <p className="text-xs font-semibold text-muted-foreground">Prévia do chip {cfg.chip_enabled ? "" : "(desativado)"}</p>
        <div className="max-w-[360px] bg-card"><CouponChipView cfg={cfg} /></div>
        <p className="mt-2 text-xs font-semibold text-muted-foreground">Prévia da barra {cfg.bar_enabled ? "" : "(desativada)"}</p>
        <div className="max-w-[360px]"><CouponBarView cfg={cfg} timer={clock(resolveCountdownSeconds({ offer_countdown: oc }))} /></div>
      </div>
    </div>
  );
}
