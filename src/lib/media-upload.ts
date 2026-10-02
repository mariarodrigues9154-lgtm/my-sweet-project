import { supabase } from "@/integrations/supabase/client";

type CreateFn = (args: { data: { filename: string; contentType: never } }) => Promise<{ ok: true; path: string; token: string } | { ok: false; error: string }>;
type FinalizeFn = (args: { data: { path: string } }) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/svg+xml";
export const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime";

/** Envia o arquivo direto para o armazenamento e devolve um link de exibição. */
export async function uploadMedia(file: File, create: CreateFn, finalize: FinalizeFn): Promise<string> {
  const isVideo = file.type.startsWith("video/");
  const max = (isVideo ? 100 : 10) * 1024 * 1024;
  if (file.size > max) throw new Error(`${file.name}: máximo ${isVideo ? 100 : 10} MB.`);
  if (![...IMAGE_ACCEPT.split(","), ...VIDEO_ACCEPT.split(",")].includes(file.type)) throw new Error(`${file.name}: formato não suportado.`);
  if (isVideo && !(await canPlayHere(file))) {
    throw new Error(`${file.name}: este vídeo não toca no navegador (provável formato HEVC/H.265 ou MOV). Exporte em MP4 (H.264) e envie novamente.`);
  }
  const prep = await create({ data: { filename: file.name, contentType: file.type as never } });
  if (!prep.ok) throw new Error(prep.error);
  const { error } = await supabase.storage.from("product-images").uploadToSignedUrl(prep.path, prep.token, file, { contentType: file.type });
  if (error) throw new Error("Falha no envio do arquivo.");
  const done = await finalize({ data: { path: prep.path } });
  if (!done.ok) throw new Error(done.error);
  return done.url;
}

/** Testa no próprio navegador se o vídeo decodifica (imagem real), antes de enviar. */
function canPlayHere(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "metadata";
    let t: ReturnType<typeof setTimeout> | undefined;
    const end = (ok: boolean) => {
      if (t) clearTimeout(t);
      URL.revokeObjectURL(url);
      resolve(ok);
    };
    t = setTimeout(() => end(true), 8000); // sem resposta: não bloqueia o envio
    v.onloadeddata = () => end(v.videoWidth > 0);
    v.onerror = () => end(false);
    v.src = url;
    v.load();
  });
}
