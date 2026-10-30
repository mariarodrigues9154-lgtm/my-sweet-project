import type { ProductDisplay } from "@/lib/product-types";

type Props = {
  display: ProductDisplay;
  pageBadge1: string;
  pageBadge2: string;
  onChange: (v: ProductDisplay) => void;
  inputCls: string;
};

/** Selos do pop-up de compra: herdar do template ou personalizar só no pop-up. */
export function SheetBadgesFields({ display, pageBadge1, pageBadge2, onChange, inputCls }: Props) {
  const custom = display.sheet_badges_mode === "custom";
  const b1 = (custom ? display.sheet_badge1_text ?? "" : pageBadge1).trim();
  const b2 = (custom ? display.sheet_badge2_text ?? "" : pageBadge2).trim();
  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border p-3">
      <p className="text-[13px] font-semibold">Selos promocionais do pop-up</p>
      <label className="block text-[12px] font-semibold">
        Origem dos textos
        <select
          value={custom ? "custom" : "inherit"}
          onChange={(e) => onChange({ ...display, sheet_badges_mode: e.target.value as "inherit" | "custom" })}
          className={inputCls}
        >
          <option value="inherit">Herdar do template</option>
          <option value="custom">Personalizar no pop-up</option>
        </select>
      </label>
      {custom && (
        <>
          <label className="block text-[12px] font-semibold">
            Texto do primeiro selo
            <input value={display.sheet_badge1_text ?? ""} placeholder="SUPER OFERTA (vazio oculta)" onChange={(e) => onChange({ ...display, sheet_badge1_text: e.target.value })} className={inputCls} />
          </label>
          <label className="block text-[12px] font-semibold">
            Texto do segundo selo
            <input value={display.sheet_badge2_text ?? ""} placeholder="POR TEMPO LIMITADO (vazio oculta)" onChange={(e) => onChange({ ...display, sheet_badge2_text: e.target.value })} className={inputCls} />
          </label>
        </>
      )}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        Prévia:
        {b1 && <span className="rounded border border-primary/40 px-1.5 py-px text-[11.5px] text-primary">{b1}</span>}
        {b2 && <span className="rounded border border-primary/40 px-1.5 py-px text-[11.5px] text-primary">{b2}</span>}
        {!b1 && !b2 && <span>nenhum selo</span>}
      </div>
    </div>
  );
}
