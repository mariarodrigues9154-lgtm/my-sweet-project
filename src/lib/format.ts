export function brl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(value) ? value : 0,
  );
}

export function intBR(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.max(0, Math.round(value || 0)));
}

export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const onlyDigits = (v: string) => v.replace(/\D+/g, "");

export function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function maskDocument(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function maskCep(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  return onlyDigits(value).length >= 10;
}

export function isValidCep(value: string): boolean {
  return onlyDigits(value).length === 8;
}

export function isValidCpfCnpj(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length === 11) return isValidCpf(d);
  if (d.length === 14) return isValidCnpj(d);
  return false;
}

function isValidCpf(d: string): boolean {
  if (/^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

function isValidCnpj(d: string): boolean {
  if (/^(\d)\1{13}$/.test(d)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * weights[i]!;
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

export function digits(value: string): string {
  return onlyDigits(value);
}

/** "29 de setembro a 7 de outubro" a partir de uma janela de dias. */
export function deliveryWindow(minDays = 4, maxDays = 9): string {
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" }).format(d);
  const now = Date.now();
  const a = new Date(now + minDays * 86400000);
  const b = new Date(now + maxDays * 86400000);
  return `${fmt(a)} e ${fmt(b)}`;
}

/** Converte texto de preço (197,99 · 197.99 · 1.679,99 · 1679,99 · R$ 10.000,50) em reais com 2 casas. */
export function parseMoney(input: string | number | null | undefined): number {
  if (typeof input === "number") return Number.isFinite(input) ? toCents(input) / 100 : 0;
  let s = String(input ?? "").replace(/[R$\s]/g, "");
  if (!s) return 0;
  const lc = s.lastIndexOf(","), ld = s.lastIndexOf(".");
  if (lc >= 0 && ld >= 0) {
    const dec = lc > ld ? "," : ".";
    const thou = dec === "," ? "." : ",";
    s = s.split(thou).join("").replace(dec, ".");
  } else if (lc >= 0) {
    s = s.split(".").join("").replace(/,(?=.*,)/g, "").replace(",", ".");
  } else if (ld >= 0 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.split(".").join("");
  }
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? toCents(n) / 100 : 0;
}

/** Reais → centavos inteiros, sem erro de ponto flutuante. */
export function toCents(value: number): number {
  return Math.round((Number(value) || 0) * 100 + Number.EPSILON);
}

/** Texto editável no padrão brasileiro: 197.99 → "197,99". */
export function moneyInput(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return (toCents(value) / 100).toFixed(2).replace(".", ",");
}
