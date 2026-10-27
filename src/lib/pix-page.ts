import { z } from "zod";

/** Personalização visual da tela final do PIX (por loja, em store_settings.checkout.pix_page). */
export const PIX_PAGE_DEFAULTS = {
  show_how_to: true,
  show_info_card: true,
  show_proof: true,
  show_view_order: true,
  show_secure_notice: false,
  show_whatsapp: true,
  how_to_title: "Como fazer pagamentos com PIX?",
  how_to_text: "Copie o código de pagamento acima, selecione Pix no seu app de internet ou de banco e cole o código.",
  info_1: "Após o pagamento, você receberá um e-mail de confirmação da compra.",
  info_2: "Assim que o pagamento for aprovado, seu pedido seguirá para processamento.",
  info_3: "O código de rastreio será enviado por e-mail para você acompanhar a entrega.",
  proof_title: "Já pagou o Pix?",
  proof_text: "Seu pagamento será confirmado automaticamente. O comprovante é opcional.",
  wa_title: "Dúvidas?",
  wa_text: "Fale conosco no WhatsApp e tire suas dúvidas sobre o pagamento, pedido ou entrega.",
  wa_button: "Falar no WhatsApp",
  /** Número do suporte (DDI + DDD + número, só dígitos). Vazio = usa o WhatsApp da loja; sem nenhum, o bloco não aparece. */
  wa_number: "",
};

const text = z.string().max(400).optional();
export const pixPageSchema = z.object({
  show_how_to: z.boolean().optional(),
  show_info_card: z.boolean().optional(),
  show_proof: z.boolean().optional(),
  show_view_order: z.boolean().optional(),
  show_secure_notice: z.boolean().optional(),
  how_to_title: text,
  how_to_text: text,
  info_1: text,
  info_2: text,
  info_3: text,
  proof_title: text,
  proof_text: text,
  show_whatsapp: z.boolean().optional(),
  wa_title: text,
  wa_text: text,
  wa_button: text,
  wa_number: z.string().max(20).optional(),
});

export type PixPageSettings = z.infer<typeof pixPageSchema>;
export type ResolvedPixPage = typeof PIX_PAGE_DEFAULTS;

export function resolvePixPage(value?: PixPageSettings | null): ResolvedPixPage {
  const parsed = pixPageSchema.safeParse(value ?? {});
  const cfg = (parsed.success ? parsed.data : {}) as Record<string, unknown>;
  const out = { ...PIX_PAGE_DEFAULTS } as Record<string, unknown>;
  for (const [k, fallback] of Object.entries(PIX_PAGE_DEFAULTS)) {
    const v = cfg[k];
    if (typeof fallback === "string") out[k] = typeof v === "string" && v.trim() ? v : fallback;
    else if (typeof v === "boolean") out[k] = v;
  }
  return out as ResolvedPixPage;
}

/** Número válido para o bloco do WhatsApp: 10+ dígitos e não é placeholder de zeros. */
export function isUsableWaNumber(value?: string | null): boolean {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length >= 10 && !/^0+$/.test(digits);
}
