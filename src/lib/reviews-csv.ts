import { parseRatingInput, type Review } from "@/lib/product-types";

export const CSV_MAX_ROWS = 500;
export const CSV_MAX_BYTES = 5 * 1024 * 1024;
export const CSV_HEADERS = ["nome", "data", "nota", "texto", "compra_confirmada", "foto_avatar", "imagem_1", "imagem_2", "imagem_3", "imagem_4", "imagem_5", "titulo", "email", "ordem"] as const;

export const CSV_TEMPLATE =
  "\uFEFF" +
  CSV_HEADERS.join(",") +
  "\n" +
  'Juliana M.,29/09/2026,5,"Produto excelente, chegou rápido.",sim,https://site.com/avatar.jpg,https://site.com/foto1.jpg,https://site.com/foto2.jpg,,,,,,\n' +
  'Patricia L.,30/09/2026,"4,9","Gostei muito do produto. Recomendo!",true,,avaliacao_02_1.jpg,,,,,,,\n';

/** Parser CSV (RFC 4180): aspas, vírgulas, aspas duplas e quebras de linha dentro de aspas. Aceita ; como separador. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (q) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}

export type ImageRef = { kind: "url" | "file"; value: string };
export type CsvRow = {
  line: number;
  raw: Record<string, string>;
  review: Review;
  order: number | null;
  avatar: ImageRef | null;
  photos: ImageRef[];
  errors: string[];
  duplicate: boolean;
};

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export const reviewKey = (r: Pick<Review, "name" | "date" | "text">) => `${norm(r.name)}|${norm(r.date ?? "")}|${norm(r.text).replace(/\s+/g, " ")}`;

function bool(v: string): boolean | null {
  const s = norm(v);
  if (!s) return null;
  if (["true", "1", "sim", "s", "yes", "verdadeiro", "on"].includes(s)) return true;
  if (["false", "0", "nao", "n", "no", "falso", "off"].includes(s)) return false;
  return null;
}

function imageRef(v: string): ImageRef | null | "invalid" {
  const s = v.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) {
    try { new URL(s); return { kind: "url", value: s }; } catch { return "invalid"; }
  }
  if (/^[^/\\]+\.(jpe?g|png|webp|gif)$/i.test(s)) return { kind: "file", value: s };
  return "invalid";
}

export function buildRows(text: string, existing: Review[]): { rows: CsvRow[]; fatal: string | null } {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], fatal: "O arquivo não tem linhas de avaliação abaixo do cabeçalho." };
  const header = table[0]!.map((h) => norm(h).replace(/\s+/g, "_"));
  if (!header.includes("nome") || !header.includes("texto") || !header.includes("nota")) return { rows: [], fatal: "Cabeçalho inválido: as colunas nome, nota e texto são obrigatórias. Baixe o modelo CSV." };
  const body = table.slice(1);
  if (body.length > CSV_MAX_ROWS) return { rows: [], fatal: `Máximo de ${CSV_MAX_ROWS} avaliações por importação (o arquivo tem ${body.length}).` };
  const known = new Set(existing.map(reviewKey));
  const seen = new Set<string>();
  const rows = body.map((cells, idx): CsvRow => {
    const raw: Record<string, string> = {};
    header.forEach((h, i) => { raw[h] = (cells[i] ?? "").trim(); });
    const errors: string[] = [];
    const name = raw["nome"] ?? "";
    const textv = raw["texto"] ?? "";
    if (!name) errors.push("Nome vazio");
    else if (name.length > 100) errors.push("Nome muito longo");
    if (!textv) errors.push("Texto vazio");
    else if (textv.length > 3000) errors.push("Texto muito longo");
    const notaRaw = (raw["nota"] ?? "").replace(",", ".");
    const n = Number(notaRaw);
    if (!notaRaw || !Number.isFinite(n) || n < 1 || n > 5) errors.push("Nota inválida (use de 1 a 5)");
    const date = raw["data"] ?? "";
    if (date.length > 80) errors.push("Data muito longa");
    const confirmed = bool(raw["compra_confirmada"] ?? "");
    if ((raw["compra_confirmada"] ?? "").trim() && confirmed === null) errors.push("Compra confirmada inválida (use sim/não, true/false, 1/0)");
    const av = imageRef(raw["foto_avatar"] ?? "");
    if (av === "invalid") errors.push("Foto do avatar inválida");
    const photos: ImageRef[] = [];
    for (let k = 1; k <= 5; k++) {
      const ref = imageRef(raw[`imagem_${k}`] ?? "");
      if (ref === "invalid") errors.push(`Imagem ${k} inválida`);
      else if (ref) photos.push(ref);
    }
    const ordRaw = (raw["ordem"] ?? "").trim();
    const order = ordRaw && /^\d+$/.test(ordRaw) ? Number(ordRaw) : null;
    if (ordRaw && order === null) errors.push("Ordem inválida");
    const review: Review = { name, rating: errors.some((e) => e.startsWith("Nota")) ? 5 : parseRatingInput(notaRaw), date, text: textv, confirmed: confirmed ?? false, photos: [], avatar: null };
    const key = reviewKey(review);
    const duplicate = known.has(key) || seen.has(key);
    seen.add(key);
    return { line: idx + 2, raw, review, order, avatar: av === "invalid" ? null : av, photos, errors, duplicate };
  });
  return { rows, fatal: null };
}

export function errorsCsv(rows: Array<{ line: number; raw: Record<string, string>; reason: string }>): string {
  const esc = (v: string) => (/[",\n\r;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const cols = [...CSV_HEADERS];
  return "\uFEFF" + ["linha", ...cols, "motivo"].join(",") + "\n" + rows.map((r) => [String(r.line), ...cols.map((c) => r.raw[c] ?? ""), r.reason].map(esc).join(",")).join("\n") + "\n";
}

export function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
