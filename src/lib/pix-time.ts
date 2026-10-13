/** Converte a validade do gateway em ms absolutos (UTC). Aceita ISO com/sem fuso e Unix (s ou ms). Sem fuso = horário de Brasília. */
export function parseGatewayDate(v: string | number): number {
  if (typeof v === "number" || /^\d+$/.test(String(v).trim())) {
    const n = Number(v);
    return n < 1e12 ? n * 1000 : n;
  }
  const s = String(v).trim().replace(" ", "T");
  const hasTz = /(Z|[+-]\d{2}:?\d{2})$/i.test(s);
  const withTz = !hasTz && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) ? `${s}-03:00` : s;
  return Date.parse(withTz);
}
