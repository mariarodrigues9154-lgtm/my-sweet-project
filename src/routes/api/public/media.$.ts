import { createFileRoute } from "@tanstack/react-router";

import { MEDIA_PATH_RE } from "@/lib/media-url";

// Endereço permanente para mídias enviadas pelo painel: redireciona para um link temporário novo.
export const Route = createFileRoute("/api/public/media/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = String((params as { _splat?: string })._splat ?? "");
        if (!MEDIA_PATH_RE.test(path)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("product-images").createSignedUrl(path, 60 * 60 * 6);
        if (error || !data?.signedUrl) {
          console.error("[media] arquivo indisponível:", path);
          return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
        }
        return new Response(null, {
          status: 302,
          headers: { Location: data.signedUrl, "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
