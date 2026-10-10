import { createFileRoute } from "@tanstack/react-router";

/** Chamado a cada minuto pelo agendador do banco. Exige o token interno guardado só no servidor. */
export const Route = createFileRoute("/api/public/hooks/pix-whatsapp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
        if (!token) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin.from("internal_job_tokens").select("token").eq("name", "pix_whatsapp").maybeSingle();
        const { createHash, timingSafeEqual } = await import("node:crypto");
        const h = (v: string) => createHash("sha256").update(v).digest();
        if (!data?.token || !timingSafeEqual(h(token), h(data.token as string))) return new Response("Unauthorized", { status: 401 });
        const { runPixWhatsappRecovery } = await import("@/lib/whatsapp-recovery.server");
        const result = await runPixWhatsappRecovery();
        return Response.json(result);
      },
    },
  },
});
