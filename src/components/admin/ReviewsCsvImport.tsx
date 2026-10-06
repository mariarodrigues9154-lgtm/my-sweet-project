import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileUp, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { createMediaUpload, finalizeMediaUpload, importReviewImages } from "@/lib/admin.functions";
import { uploadMedia } from "@/lib/media-upload";
import type { Review } from "@/lib/product-types";
import { CSV_MAX_BYTES, CSV_MAX_ROWS, CSV_TEMPLATE, buildRows, downloadText, errorsCsv, type CsvRow, type ImageRef } from "@/lib/reviews-csv";

type Result = { imported: number; duplicates: number; errors: Array<{ line: number; raw: Record<string, string>; reason: string }> };

/** Importa avaliações em massa para o produto aberto; o resultado entra na mesma lista de avaliações editáveis. */
export function ReviewsCsvImport({ existing, onImport }: { existing: Review[]; onImport: (add: Array<{ review: Review; order: number | null }>) => void }) {
  const [rows, setRows] = useState<CsvRow[] | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [importDup, setImportDup] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const fetchImages = useServerFn(importReviewImages);
  const createUpload = useServerFn(createMediaUpload);
  const finalizeUpload = useServerFn(finalizeMediaUpload);

  async function pickCsv(file?: File) {
    if (!file) return;
    if (file.size > CSV_MAX_BYTES) { toast.error("CSV maior que 5 MB."); return; }
    const { rows: parsed, fatal } = buildRows(await file.text(), existing);
    if (fatal) { toast.error(fatal); return; }
    setRows(parsed); setImportDup({}); setResult(null);
  }

  const fileMap = new Map(files.map((f) => [f.name.toLowerCase(), f]));
  const missingFile = (r: CsvRow) => [r.avatar, ...r.photos].filter((x): x is ImageRef => !!x && x.kind === "file" && !fileMap.has(x.value.toLowerCase())).map((x) => x.value);
  const status = (r: CsvRow) => {
    const miss = missingFile(r);
    const errs = [...r.errors, ...(miss.length ? [`Arquivo não enviado: ${miss.join(", ")}`] : [])];
    if (errs.length) return { ok: false, text: errs.join("; ") };
    if (r.duplicate && !importDup[r.line]) return { ok: false, dup: true, text: "Possível avaliação duplicada (será ignorada)" };
    return { ok: true, text: r.duplicate ? "Duplicada — importar mesmo assim" : "Válido" };
  };

  async function confirm() {
    if (!rows) return;
    const chosen = rows.filter((r) => status(r).ok);
    if (!chosen.length) { toast.error("Nenhuma avaliação válida para importar."); return; }
    const errors: Result["errors"] = rows.filter((r) => !status(r).ok && !status(r).dup).map((r) => ({ line: r.line, raw: r.raw, reason: status(r).text }));
    const duplicates = rows.filter((r) => status(r).dup).length;
    try {
      // 1. Arquivos enviados junto: sobe cada um uma única vez.
      const local = new Map<string, string>();
      const needed = [...new Set(chosen.flatMap((r) => [r.avatar, ...r.photos]).filter((x): x is ImageRef => !!x && x.kind === "file").map((x) => x.value.toLowerCase()))];
      for (let i = 0; i < needed.length; i++) {
        setBusy(`Enviando imagens ${i + 1}/${needed.length}…`);
        try { local.set(needed[i]!, await uploadMedia(fileMap.get(needed[i]!)!, createUpload as never, finalizeUpload as never)); } catch { /* tratado abaixo */ }
      }
      // 2. URLs externas: baixa para o armazenamento próprio, em lotes.
      const remote = new Map<string, { ok: boolean; url?: string; error?: string }>();
      const urls = [...new Set(chosen.flatMap((r) => [r.avatar, ...r.photos]).filter((x): x is ImageRef => !!x && x.kind === "url").map((x) => x.value))];
      for (let i = 0; i < urls.length; i += 20) {
        setBusy(`Baixando imagens ${Math.min(i + 20, urls.length)}/${urls.length}…`);
        const { results } = await fetchImages({ data: { urls: urls.slice(i, i + 20) } });
        for (const [k, v] of Object.entries(results)) remote.set(k, v as never);
      }
      const resolve = (x: ImageRef) => (x.kind === "file" ? local.get(x.value.toLowerCase()) : remote.get(x.value)?.url) ?? null;
      const add: Array<{ review: Review; order: number | null }> = [];
      for (const r of chosen) {
        const failed = [r.avatar, ...r.photos].filter((x): x is ImageRef => !!x && !resolve(x));
        if (failed.length) { errors.push({ line: r.line, raw: r.raw, reason: `Imagem não importada: ${failed.map((f) => (f.kind === "url" ? remote.get(f.value)?.error ?? f.value : f.value)).join("; ")}` }); continue; }
        add.push({ review: { ...r.review, avatar: r.avatar ? resolve(r.avatar) : null, photos: r.photos.map(resolve).filter((u): u is string => !!u), videos: r.videos }, order: r.order });
      }
      if (add.length) onImport(add);
      setResult({ imported: add.length, duplicates, errors });
      setRows(null);
      if (add.length) toast.success(`${add.length} avaliações adicionadas. Clique em Salvar produto para gravar.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na importação.");
    } finally { setBusy(""); }
  }

  const valid = rows?.filter((r) => status(r).ok).length ?? 0;
  const dups = rows?.filter((r) => status(r).dup).length ?? 0;
  const bad = (rows?.length ?? 0) - valid - dups;

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border p-2.5">
      <p className="text-[12.5px] font-bold">Importar avaliações por CSV</p>
      <p className="text-[11px] text-muted-foreground">Até {CSV_MAX_ROWS} avaliações por arquivo, em UTF-8. Vão para este produto e entram no fim da lista (ou na posição da coluna "ordem"). Imagens: link da imagem ou nome do arquivo enviado abaixo.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => downloadText("modelo-avaliacoes.csv", CSV_TEMPLATE)} className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-2 text-[11.5px] font-semibold"><Download size={13} /> Baixar modelo CSV</button>
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-input px-3 py-2 text-[11.5px] font-semibold"><FileUp size={13} /> Selecionar arquivo CSV<input type="file" hidden accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void pickCsv(f); }} /></label>
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-input px-3 py-2 text-[11.5px] font-semibold"><Upload size={13} /> Arquivos de imagens das avaliações{files.length ? ` (${files.length})` : ""}<input type="file" hidden multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; setFiles((cur) => [...cur, ...f]); }} /></label>
        {files.length > 0 && <button type="button" onClick={() => setFiles([])} className="text-[11px] font-semibold text-destructive">Limpar imagens</button>}
      </div>

      {rows && (
        <div className="space-y-2 rounded-lg bg-surface p-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-bold">Prévia da importação</p>
            <button type="button" aria-label="Cancelar" onClick={() => setRows(null)}><X size={16} /></button>
          </div>
          <p className="text-[11.5px]">{rows.length} avaliações encontradas · <span className="text-success">{valid} válidas</span> · <span className="text-destructive">{bad} com erro</span>{dups ? ` · ${dups} possíveis duplicadas` : ""}</p>
          <div className="max-h-80 overflow-auto rounded border border-border bg-card">
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 bg-card"><tr className="border-b border-border"><th className="p-1.5">Linha</th><th className="p-1.5">Nome</th><th className="p-1.5">Nota</th><th className="p-1.5">Data</th><th className="p-1.5">Fotos</th><th className="p-1.5">Status</th></tr></thead>
              <tbody>
                {rows.map((r) => { const s = status(r); return (
                  <tr key={r.line} className="border-b border-border align-top">
                    <td className="p-1.5">{r.line}</td><td className="p-1.5">{r.review.name || "-"}</td>
                    <td className="p-1.5">{r.errors.some((e) => e.startsWith("Nota")) ? "-" : String(r.review.rating).replace(".", ",")}</td>
                    <td className="p-1.5">{r.review.date || "-"}</td><td className="p-1.5">{r.photos.length}{r.videos.length ? ` + ${r.videos.length} vídeo(s)` : ""}{r.avatar ? " + avatar" : ""}</td>
                    <td className={`p-1.5 ${s.ok ? "text-success" : "text-destructive"}`}>{s.text}{r.duplicate && !r.errors.length && <label className="mt-1 flex items-center gap-1 text-foreground"><input type="checkbox" checked={!!importDup[r.line]} onChange={(e) => setImportDup((c) => ({ ...c, [r.line]: e.target.checked }))} /> Importar mesmo assim</label>}</td>
                  </tr>); })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!!busy || !valid} onClick={() => void confirm()} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-[11.5px] font-bold text-primary-foreground disabled:opacity-50">{busy ? <Loader2 size={13} className="animate-spin" /> : null}{busy || (bad || dups ? `Importar apenas válidas (${valid})` : `Confirmar importação (${valid})`)}</button>
            <button type="button" disabled={!!busy} onClick={() => setRows(null)} className="rounded-md border border-input px-3 py-2 text-[11.5px] font-semibold">Cancelar e corrigir CSV</button>
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-lg bg-surface p-2.5 text-[11.5px]">
          <p className="font-bold">Importação concluída</p>
          <p>{result.imported} avaliações importadas · {result.duplicates} duplicadas ignoradas · {result.errors.length} linhas com erro</p>
          {result.imported > 0 && <p className="text-muted-foreground">Clique em Salvar produto para gravar.</p>}
          {result.errors.length > 0 && <button type="button" onClick={() => downloadText("erros-avaliacoes.csv", errorsCsv(result.errors))} className="mt-1 inline-flex items-center gap-1 font-semibold text-primary"><Download size={13} /> Baixar CSV de erros</button>}
        </div>
      )}
    </div>
  );
}
