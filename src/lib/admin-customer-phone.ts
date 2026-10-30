/** Presentation only: never infer digits missing from a stored phone. */
export function adminCustomerPhone(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  const digits = raw.replace(/\D/g, "");
  const masked = /[*•xX…]/.test(raw);
  const domestic = (digits.length === 12 || digits.length === 13) && digits.startsWith("55") ? digits.slice(2) : digits;
  const brazilian = domestic.length === 10 || domestic.length === 11;
  const display = !masked && brazilian
    ? `${digits !== domestic ? "+55 " : ""}(${domestic.slice(0, 2)}) ${domestic.slice(2, -4)}-${domestic.slice(-4)}`
    : raw || "—";
  const international = raw.startsWith("+") && digits.length >= 8 && digits.length <= 15;
  const normalized = !masked && raw && (brazilian || international)
    ? brazilian ? `55${domestic}` : digits
    : null;
  return { display, raw, digits, whatsappUrl: normalized ? `https://wa.me/${normalized}` : null, canCopy: Boolean(raw && !masked && digits) };
}