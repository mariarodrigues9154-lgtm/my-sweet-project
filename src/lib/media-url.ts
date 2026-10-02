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
