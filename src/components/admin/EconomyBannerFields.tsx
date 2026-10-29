import { useRef } from "react";
import { Bold, ChevronRight, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EconomyBannerText } from "@/components/product/EconomyBannerText";
import { economyBannerText, editBold, toggleBold, type EconomyBannerSettings } from "@/lib/economy-banner";

const inputCls = "w-full rounded-lg border border-input bg-card px-3 py-2 text-[13px] outline-none focus:border-primary";

export function EconomyBannerFields({ value = {}, price, previous, onChange }: { value?: EconomyBannerSettings; price: number; previous: number; onChange: (v: EconomyBannerSettings) => void }) {
  const editor = useRef<HTMLTextAreaElement>(null);
  const selection = useRef({ start: 0, end: 0 });
  const text = value.text ?? "";
  const preview = economyBannerText(price, previous, value);
  function applyBold() {
    const { start, end } = selection.current;
    onChange({ ...value, bold: toggleBold(value.bold ?? [], start, end, text.length) });
    requestAnimationFrame(() => { editor.current?.focus(); editor.current?.setSelectionRange(start, end); });
  }
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="text-[12px] font-bold">Texto da faixa “Economize”</p>
      <select aria-label="Modo do texto da faixa Economize" className={inputCls} value={value.mode ?? "auto"} onChange={e => onChange({ ...value, mode: e.target.value as "auto" | "manual" })}>
        <option value="auto">Automático (calculado pelos preços)</option>
        <option value="manual">Manual (texto personalizado)</option>
      </select>
      {value.mode === "manual" && (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="economy-banner-editor" className="text-[12px] font-semibold">Texto personalizado da faixa</label>
            <TooltipProvider><Tooltip><TooltipTrigger asChild>
              <Button type="button" size="icon" variant="outline" aria-label="Negrito" onMouseDown={e => e.preventDefault()} onClick={applyBold}><Bold /></Button>
            </TooltipTrigger><TooltipContent>Aplicar ou remover negrito</TooltipContent></Tooltip></TooltipProvider>
          </div>
          <textarea id="economy-banner-editor" ref={editor} className={`${inputCls} min-h-20 resize-y font-normal`} maxLength={160} placeholder="Economize R$ 38,00" value={text}
            onSelect={e => { selection.current = { start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd }; }}
            onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") { e.preventDefault(); applyBold(); } }}
            onChange={e => onChange({ ...value, text: e.target.value, bold: editBold(value.bold ?? [], text, e.target.value) })}
          />
        </div>
      )}
      <p className="text-[12px] font-bold">Efeito pulsante</p>
      <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" checked={value.pulse === true} onChange={e => onChange({ ...value, pulse: e.target.checked })} />Ativar pulsação suave</label>
      <label className="block text-[12px] font-semibold">Aplicar pulsação em:
        <select className={inputCls} value={value.pulse_target ?? "bold"} onChange={e => onChange({ ...value, pulse_target: e.target.value as "bold" | "all" })}>
          <option value="bold">Apenas trechos destacados em negrito</option><option value="all">Texto completo da faixa</option>
        </select>
      </label>
      <p className="text-[11.5px] text-muted-foreground">Prévia</p>
      {preview ? <div className="flex min-h-10 items-center justify-between gap-2 rounded-2xl border border-primary/45 bg-card px-3.5 py-2">
        <span className="inline-flex min-w-0 items-center gap-2 text-[13px] text-primary"><Ticket size={15} className="shrink-0" /><EconomyBannerText text={preview} settings={value} /></span>
        <ChevronRight size={16} className="shrink-0 text-primary/80" />
      </div> : <p className="text-[11.5px] text-muted-foreground">Faixa oculta</p>}
    </div>
  );
}