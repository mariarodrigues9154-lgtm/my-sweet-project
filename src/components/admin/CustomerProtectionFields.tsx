import { CustomerProtection } from "@/components/product/CustomerProtection";
import { protectionBenefitKeys, resolveCustomerProtection, type CustomerProtectionSettings } from "@/lib/customer-protection";
import type { Product } from "@/lib/product-types";

export function CustomerProtectionFields({ value, onChange, original }: { value?: CustomerProtectionSettings | undefined; onChange: (value: CustomerProtectionSettings) => void; original?: Product["protection"] | undefined }) {
  const config = resolveCustomerProtection(value);
  const set = (patch: CustomerProtectionSettings) => onChange({ ...config, ...patch });
  const cls = "w-full rounded-lg border border-input bg-card px-3 py-2.5 text-[13px] outline-none focus:border-primary";
  return <div className="space-y-3">
    <label className="flex items-center gap-2 text-[12px] font-semibold"><input type="checkbox" checked={config.enabled} onChange={(e) => set({ enabled: e.target.checked })} />Ativar Proteção do cliente</label>
    <label className="block space-y-1"><span className="text-[11px] font-semibold text-muted-foreground">Estilo de exibição</span><select className={cls} value={config.style} onChange={(e) => set({ style: e.target.value === "premium" ? "premium" : "original" })}><option value="original">Layout 1 — Original</option><option value="premium">Layout 2 — Premium</option></select></label>
    {config.style === "premium" && <>
      <label className="flex items-center gap-2 text-[12px] font-semibold"><input type="checkbox" checked={config.collapsible} onChange={(e) => set({ collapsible: e.target.checked })} />Permitir expandir e recolher benefícios</label>
      <div className="grid gap-3 sm:grid-cols-2">
        {([ ["title", "Título principal"], ["subtitle", "Subtítulo"], ...protectionBenefitKeys.map((key, i) => [key, `Texto do benefício ${i + 1}`] as const) ] as const).map(([key, label]) => <label key={key} className="block min-w-0 space-y-1"><span className="text-[11px] font-semibold text-muted-foreground">{label}</span><textarea aria-label={label} rows={2} maxLength={600} className={cls} value={config[key]} onChange={(e) => set({ [key]: e.target.value })} /></label>)}
      </div>
    </>}
    <p className="text-[11.5px] text-muted-foreground">{config.style === "original" ? "O modelo original mantém os textos cadastrados em cada produto." : "Os textos premium são usados nos produtos desta loja; os textos originais permanecem preservados."}</p>
    <div className="space-y-2" aria-label="Prévia da Proteção do cliente">
      <p className="text-[11px] font-semibold text-muted-foreground">Prévia{config.style === "original" && original ? " — primeiro produto da loja" : ""}</p>
      {config.enabled ? <CustomerProtection protection={original ?? { title: config.title, subtitle: config.subtitle, items: protectionBenefitKeys.map((key) => config[key]) }} settings={config} /> : <p className="text-[12px] text-muted-foreground">Componente desativado</p>}
    </div>
  </div>;
}