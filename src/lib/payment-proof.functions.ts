import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Comprovante opcional enviado pelo cliente na tela do PIX.
 * Só guarda o arquivo em armazenamento privado (payment-proofs/<order_id>/...);
 * nunca altera o status do pedido — a confirmação continua vindo do gateway.
 */
export const uploadPaymentProof = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        order_number: z.string().min(4).max(40),
        contentType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
        base64: z.string().min(10).max(7_000_000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin.from("orders").select("id, status").eq("order_number", data.order_number).maybeSingle();
    if (!order) return { ok: false as const, error: "Pedido não encontrado." };
    const folder = `payment-proofs/${order.id}`;
    const { data: existing } = await supabaseAdmin.storage.from("product-images").list(folder, { limit: 10 });
    if ((existing?.length ?? 0) >= 3) return { ok: false as const, error: "Limite de comprovantes atingido para este pedido." };
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const ext = data.contentType === "application/pdf" ? "pdf" : data.contentType.split("/")[1];
    const { error } = await supabaseAdmin.storage
      .from("product-images")
      .upload(`${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`, bytes, { contentType: data.contentType, upsert: false });
    if (error) return { ok: false as const, error: "Não foi possível enviar o comprovante. Tente novamente." };
    return { ok: true as const };
  });
