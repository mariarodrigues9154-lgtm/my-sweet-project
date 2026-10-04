import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type RealPurchase = { name: string; city: string; product_id: string | null; product: string; image: string | null; paid_at: string };

/** Compras pagas e reais da loja — só primeiro nome e cidade, nunca dados pessoais completos. */
export const getRecentPurchases = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ storeId: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<RealPurchase[]> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows } = await supabaseAdmin
        .from("orders")
        .select("product_id, product_snapshot, customer, address, paid_at, created_at")
        .eq("store_id", data.storeId)
        .eq("status", "pago")
        .order("paid_at", { ascending: false, nullsFirst: false })
        .limit(20);
      return (rows ?? []).flatMap((r) => {
        const c = (r.customer ?? {}) as { name?: string };
        const a = (r.address ?? {}) as { city?: string; state?: string };
        const s = (r.product_snapshot ?? {}) as { title?: string; image?: string };
        const first = (c.name ?? "").trim().split(/\s+/)[0] ?? "";
        if (!first) return [];
        const name = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
        return [{ name, city: (a.city ?? "").trim(), product_id: r.product_id, product: s.title ?? "", image: s.image ?? null, paid_at: r.paid_at ?? r.created_at }];
      });
    } catch {
      return [];
    }
  });
