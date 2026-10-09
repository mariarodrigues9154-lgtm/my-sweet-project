import type { ExitOfferSettings } from "@/lib/exit-offer";

const input = "h-10 w-full rounded-lg border border-input bg-card px-3 text-[13px] outline-none focus:border-primary";

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block min-w-0 space-y-1"><span className="block text-[11px] font-semibold text-muted-foreground">{label}</span>{children}</label>;
}

/** Campos da oferta de saída — usados na loja (completo) e no produto (sem ligar/estilo). */
export function ExitOfferFields({ value, onChange, product = false, enableLabel = "Ativar oferta de saída" }: { value: ExitOfferSettings | undefined; onChange: (v: ExitOfferSettings) => void; product?: boolean; enableLabel?: string }) {
  const v = value ?? {};
  const set = (patch: Partial<ExitOfferSettings>) => onChange({ ...v, ...patch });
  const txt = (k: keyof ExitOfferSettings, label: string, ph: string) => (
    <F label={label}><input className={input} value={(v[k] as string | undefined) ?? ""} placeholder={ph} onChange={(e) => set({ [k]: e.target.value })} /></F>
  );
  return (
    <div className="space-y-3">
      {!product && (
        <>
          <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[11.5px] font-semibold">
            <input type="checkbox" checked={v.enabled === true} onChange={(e) => set({ enabled: e.target.checked })} />
            {enableLabel}: {v.enabled === true ? "Ativado" : "Desativado"}
          </label>
          <F label="Estilo visual">
            <select className={input} value={v.style ?? "aggressive"} onChange={(e) => set({ style: e.target.value as "default" | "aggressive" })}>
              <option value="aggressive">Estilo oferta agressiva</option>
              <option value="default">Padrão</option>
            </select>
          </F>
        </>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="Tipo de desconto">
          <select className={input} value={v.discount_type ?? "percent"} onChange={(e) => set({ discount_type: e.target.value as "percent" | "fixed" })}>
            <option value="percent">Percentual (%)</option>
            <option value="fixed">Valor fixo por unidade (R$)</option>
          </select>
        </F>
        <F label={v.discount_type === "fixed" ? "Valor do desconto (R$)" : "Valor do desconto (%)"}>
          <input className={input} inputMode="decimal" value={v.discount_value != null ? String(v.discount_value).replace(".", ",") : ""} placeholder="20" onChange={(e) => { const n = Number(e.target.value.replace(",", ".")); set({ discount_value: e.target.value.trim() && Number.isFinite(n) ? n : undefined as never }); }} />
        </F>
      </div>
      {!product && txt("badge", "Subtítulo/selo", "OFERTA EXCLUSIVA DE HOJE")}
      {txt("title", "Título", "ESPERE! NÃO DEIXE ESSA OFERTA ESCAPAR!")}
      <F label="Texto principal da oferta">
        <textarea rows={3} className="w-full rounded-lg border border-input bg-card px-3 py-2 text-[13px] outline-none focus:border-primary" value={v.text ?? ""} placeholder="Identificamos que você não concluiu seu pedido..." onChange={(e) => set({ text: e.target.value })} />
      </F>
      <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[11.5px] font-semibold">
        <input type="checkbox" checked={v.timer_enabled !== false} onChange={(e) => set({ timer_enabled: e.target.checked })} />
        Ativar contador: {v.timer_enabled !== false ? "Ativado" : "Desativado"}
      </label>
      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <F label="Duração (minutos)"><input className={input} inputMode="numeric" value={v.timer_minutes ?? ""} placeholder="5" onChange={(e) => { const n = parseInt(e.target.value, 10); set({ timer_minutes: Number.isFinite(n) ? n : undefined as never }); }} /></F>
        {txt("timer_text", "Texto do contador (use {MM:SS})", "Esta oportunidade única expira em: {MM:SS}")}
      </div>
      {txt("button_text", "Texto do botão principal", "SIM, QUERO APROVEITAR O DESCONTO!")}
      {txt("decline_text", "Texto de recusa (use {preco} para o valor normal)", "Não, prefiro pagar o valor normal depois")}
      {!product && (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            {([["show_old_price", "Mostrar preço antigo"], ["show_new_price", "Mostrar novo preço"], ["show_icon", "Mostrar ícone"]] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[11.5px] font-semibold">
                <input type="checkbox" checked={v[k] !== false} onChange={(e) => set({ [k]: e.target.checked })} /> {label}
              </label>
            ))}
          </div>
          {txt("icon_url", "Ícone/imagem (link da imagem, vazio = presente)", "https://...")}
          <div className="grid gap-3 sm:grid-cols-3">
            {([["button_color", "Cor do botão"], ["accent_color", "Cor de destaque"], ["bg_color", "Cor do fundo"]] as const).map(([k, label]) => (
              <F key={k} label={`${label} (vazio = cor da loja)`}>
                <div className="flex gap-2">
                  <input type="color" className="h-10 w-12 shrink-0 rounded-lg border border-input bg-card" value={v[k] || "#ffffff"} onChange={(e) => set({ [k]: e.target.value })} />
                  <input className={input} value={v[k] ?? ""} placeholder="#ff2d55" onChange={(e) => set({ [k]: e.target.value })} />
                </div>
              </F>
            ))}
          </div>
        </>
      )}
      <p className="text-[11px] text-muted-foreground">O desconto é aplicado de verdade no total, no pedido e no PIX. Campos vazios usam o texto padrão{product ? " da loja" : ""}.</p>
    </div>
  );
}
