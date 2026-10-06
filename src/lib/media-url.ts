/**
 * Links assinados do armazenamento privado expiram ou deixam de valer quando as chaves mudam.
 * Convertemos para um endereço permanente do próprio site, que gera um link novo a cada acesso.
 */
const SIGNED_RE = /\/storage\/v1\/object\/sign\/product-images\/(uploads\/[a-f0-9-]+\.[a-z0-9]+)(?:\?|$)/i;

export const MEDIA_PATH_RE = /^uploads\/[a-f0-9-]+\.[a-z0-9]{1,5}$/i;

export function stableMediaUrl(url: string | null | undefined): string {
  if (!url) return "";
  const m = SIGNED_RE.exec(url);
  return m ? `/api/public/media/${m[1]}` : url;
}

/** Larguras permitidas para versões reduzidas (WebP/AVIF automático pelo armazenamento). */
export const IMG_WIDTHS = [240, 360, 480, 720, 1080] as const;
const RESIZABLE_RE = /^\/api\/public\/media\/uploads\/[a-f0-9-]+\.(jpe?g|png|webp)$/i;

/** Link de uma versão reduzida da foto; fotos externas ficam como estão. */
export function sizedImage(url: string | null | undefined, width: number): string {
  const u = stableMediaUrl(url);
  return RESIZABLE_RE.test(u) ? `${u}?w=${width}` : u;
}

/** srcset com várias larguras para o navegador escolher a ideal para a tela. */
export function imageSrcSet(url: string | null | undefined, max = 1080): string | undefined {
  const u = stableMediaUrl(url);
  if (!RESIZABLE_RE.test(u)) return undefined;
  return IMG_WIDTHS.filter((w) => w <= max).map((w) => `${u}?w=${w} ${w}w`).join(", ");
}
