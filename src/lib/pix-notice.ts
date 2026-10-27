/** Regras de exibição do aviso flutuante de PIX (somente visual; o status vem do servidor). */
export const PAID_NOTICE_MS = 15 * 60_000;
export const PENDING_NOTICE_MAX_MS = 40 * 60_000;

type O = { state: "pendente" | "pago" | "expirado" | "outro"; created_at: string; paid_at: string | null; expires_at: string | null };

/** "pago" | "pendente" | "expirado" quando o aviso deve aparecer, ou null para ocultar. */
export function noticeKind(o: O, now = Date.now()): "pago" | "pendente" | "expirado" | null {
  if (o.state === "pago") {
    const t = o.paid_at ? new Date(o.paid_at).getTime() : NaN;
    return Number.isFinite(t) && now - t <= PAID_NOTICE_MS ? "pago" : null;
  }
  if (o.state !== "pendente" && o.state !== "expirado") return null;
  const created = new Date(o.created_at).getTime();
  if (!Number.isFinite(created) || now - created > PENDING_NOTICE_MAX_MS) return null;
  // Expiração real do gateway prevalece sobre o status em cache.
  const exp = o.expires_at ? new Date(o.expires_at).getTime() : NaN;
  if (o.state === "pendente" && Number.isFinite(exp) && exp <= now) return "expirado";
  return o.state;
}
