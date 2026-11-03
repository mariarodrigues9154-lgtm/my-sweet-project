/** Nome do produto na variável {produto}: nome curto para WhatsApp, senão o título. */
export function recoveryProductName(snapshot: unknown): string {
  const s = (snapshot ?? {}) as { title?: unknown; whatsapp_name?: unknown };
  const short = typeof s.whatsapp_name === "string" ? s.whatsapp_name.trim() : "";
  if (short) return short;
  return typeof s.title === "string" ? s.title : "";
}
