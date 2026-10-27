import { PIX_PAGE_DEFAULTS, resolvePixPage, type PixPageSettings } from "@/lib/pix-page";

const toggles = [
  ["show_how_to", "Explicação “Como fazer pagamentos com PIX?”"],
  ["show_info_card", "Card com três informações"],
  ["show_whatsapp", "Exibir bloco de WhatsApp"],
  ["show_proof", "Bloco “Enviar comprovante”"],
  ["show_view_order", "Botão “Ver pedido”"],
  ["show_secure_notice", "Aviso “Seus dados estão seguros e criptografados”"],
] as const;

const texts = [
  ["how_to_title", "Título da explicação Pix", false],
  ["how_to_text", "Texto de como realizar o pagamento", true],
  ["info_1", "Informação 1 (e-mail)", true],
  ["info_2", "Informação 2 (processamento)", true],
  ["info_3", "Informação 3 (rastreio)", true],
  ["wa_title", "Título do WhatsApp (Dúvidas?)", false],
  ["wa_text", "Texto do WhatsApp", true],
  ["wa_button", "Texto do botão do WhatsApp", false],
  ["wa_number", "Número do WhatsApp do suporte (ex.: 5585999999999)", false],
  ["proof_title", "Título “Já pagou o Pix?”", false],
  ["proof_text", "Texto auxiliar do comprovante", true],
] as const;

export function PixPageFields({ value, onChange }: { value?: PixPageSettings | undefined; onChange: (value: PixPageSettings) => void }) {
  const r = resolvePixPage(value);
  const set = (patch: PixPageSettings) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {toggles.map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[11.5px] font-semibold">
            <input type="checkbox" checked={r[key]} onChange={(e) => set({ [key]: e.target.checked })} />
            {label}: {r[key] ? "Ativado" : "Desativado"}
          </label>
        ))}
      </div>
      <div className="grid gap-2">
        {texts.map(([key, label, long]) => (
          <label key={key} className="block text-[11px] font-semibold text-muted-foreground">
            {label}
            {long ? (
              <textarea rows={2} maxLength={400} value={value?.[key] ?? PIX_PAGE_DEFAULTS[key]} onChange={(e) => set({ [key]: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-[12.5px] text-foreground" />
            ) : (
              <input maxLength={400} value={value?.[key] ?? PIX_PAGE_DEFAULTS[key]} onChange={(e) => set({ [key]: e.target.value })} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-[12.5px] text-foreground" />
            )}
          </label>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">O bloco do WhatsApp só aparece com um número válido no campo acima (ou no WhatsApp da loja). Clique em salvar a loja para aplicar. O comprovante é opcional e nunca confirma o pagamento sozinho.</p>
    </div>
  );
}
