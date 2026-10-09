import { ExitOfferFields } from "@/components/admin/ExitOfferFields";
import { parseMoney, moneyInput } from "@/lib/format";
import * as React from "react";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  ExternalLink,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { brl } from "@/lib/format";
import { allComboKeys, discountPercent, parseRatingInput, type CreatorVideo, type DescriptionBlock, type Media, type Review, type VariantCombo, type VariantGroup } from "@/lib/product-types";
import { VariantsEditor } from "@/components/admin/VariantsEditor";
import { ReviewsCsvImport } from "@/components/admin/ReviewsCsvImport";
import {
  bulkUpdateProducts,
  createBlankProduct,
  deleteProduct,
  duplicateProduct,
  getAdminProduct,
  saveProductDetails,
  updateProduct,
  uploadProductImage,
  createMediaUpload,
  finalizeMediaUpload,
} from "@/lib/admin.functions";
import { IMAGE_ACCEPT, VIDEO_ACCEPT, uploadMedia } from "@/lib/media-upload";

export type AdminProduct = {
  id: string;
  slug: string;
  name: string;
  price: number;
  previous_price: number;
  stock: number;
  active: boolean;
  store_id?: string | null;
};

export type StoreChoice = { id: string; name: string };

const inputCls =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-[13px] outline-none focus:border-primary";
const num = (s: string) => parseMoney(s);

export function ProductManager({
  products,
  onChanged,
  stores = [],
}: {
  products: AdminProduct[];
  onChanged: () => Promise<unknown>;
  stores?: StoreChoice[];
}) {
  const [storeFilter, setStoreFilter] = useState("");
  const quickSave = useServerFn(updateProduct);
  const clone = useServerFn(duplicateProduct);
  const create = useServerFn(createBlankProduct);
  const remove = useServerFn(deleteProduct);
  const bulk = useServerFn(bulkUpdateProducts);

  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newStock, setNewStock] = useState("");
  const [busy, setBusy] = useState(false);

  const visible = products.filter(
    (p) =>
      (!storeFilter || p.store_id === storeFilter) &&
      `${p.name} ${p.slug}`.toLowerCase().includes(filter.trim().toLowerCase()),
  );
  const allSelected = visible.length > 0 && visible.every((p) => selected.includes(p.id));

  async function run<T extends { ok: boolean; error?: string }>(fn: () => Promise<T>, success: string) {
    setBusy(true);
    try {
      const r = await fn();
      if (!r.ok) {
        toast.error(r.error ?? "Erro.");
        return r;
      }
      toast.success(success);
      await onChanged();
      return r;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro inesperado.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl bg-card p-4 shadow-card-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-extrabold">Produtos ({products.length})</h2>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Buscar produto…"
          className={`${inputCls} max-w-[220px]`}
        />
        {stores.length > 1 && (
          <select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)} className={`${inputCls} max-w-[200px]`} aria-label="Filtrar por loja">
            <option value="">Todas as lojas</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {/* Novo produto */}
      <form
        className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-dashed border-border p-3 sm:grid-cols-[minmax(0,1fr)_120px_100px_auto]"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await run(
            () => create({ data: { name: newName, price: num(newPrice), stock: Math.round(num(newStock)), ...(storeFilter ? { store_id: storeFilter } : {}) } }),
            "Produto criado (inativo). Complete os dados e ative.",
          );
          if (r && r.ok && "id" in r) {
            setNewName("");
            setNewPrice("");
            setNewStock("");
            setEditing(r.id as string);
          }
        }}
      >
        <input
          required
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nome do novo produto"
          className={`${inputCls} col-span-2 sm:col-span-1`}
        />
        <input required inputMode="decimal" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="Preço" className={inputCls} />
        <input required inputMode="numeric" value={newStock} onChange={(e) => setNewStock(e.target.value)} placeholder="Estoque" className={inputCls} />
        <button
          type="submit"
          disabled={busy}
          className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-full cta-gradient px-4 py-2 text-[12.5px] font-extrabold text-primary-foreground disabled:opacity-60 sm:col-span-1"
        >
          <Plus size={14} /> Novo produto
        </button>
      </form>

      {/* Ações em massa */}
      <div className="mt-3 flex items-center gap-2 text-[12px]">
        <label className="inline-flex items-center gap-2 font-semibold">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => setSelected(allSelected ? [] : visible.map((p) => p.id))}
          />
          Selecionar todos
        </label>
      </div>
      {selected.length > 0 && (
        <BulkBar
          count={selected.length}
          busy={busy}
          onClear={() => setSelected([])}
          onApply={async (payload) => {
            const r = await run(() => bulk({ data: { ids: selected, ...payload } }), "Alterações aplicadas.");
            if (r?.ok) setSelected([]);
          }}
        />
      )}

      <div className="mt-3 space-y-2">
        {visible.map((p) => (
          <QuickRow
            key={p.id}
            product={p}
            stores={stores}
            checked={selected.includes(p.id)}
            onToggle={() =>
              setSelected((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))
            }
            onSave={(patch) => run(() => quickSave({ data: { id: p.id, ...patch } }), "Produto atualizado.")}
            onEdit={() => setEditing(p.id)}
            onDuplicate={() => run(() => clone({ data: { id: p.id } }), "Produto duplicado (inativo).")}
            onDelete={() => {
              if (confirm(`Excluir "${p.name}"? Essa ação não pode ser desfeita.`))
                void run(() => remove({ data: { id: p.id } }), "Produto excluído.");
            }}
          />
        ))}
        {visible.length === 0 && (
          <p className="py-4 text-center text-[12.5px] text-muted-foreground">Nenhum produto encontrado.</p>
        )}
      </div>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[560px]">
          <SheetHeader>
            <SheetTitle>Editar produto</SheetTitle>
          </SheetHeader>
          {editing && (
            <ProductEditor
              id={editing}
              onSaved={async () => {
                await onChanged();
                setEditing(null);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function BulkBar({
  count,
  busy,
  onClear,
  onApply,
}: {
  count: number;
  busy: boolean;
  onClear: () => void;
  onApply: (p: {
    price_percent: number | null;
    stock: number | null;
    stock_add: number | null;
    active: boolean | null;
  }) => Promise<unknown>;
}) {
  const [percent, setPercent] = useState("");
  const [stockMode, setStockMode] = useState<"set" | "add">("add");
  const [stock, setStock] = useState("");
  const [active, setActive] = useState<"" | "on" | "off">("");
  return (
    <div className="mt-2 space-y-2 rounded-xl border border-primary/40 bg-surface p-3">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] font-extrabold">{count} selecionado(s) — alterar todos de uma vez</p>
        <button type="button" onClick={onClear} aria-label="Limpar seleção"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Preço (± %)</span>
          <input inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="ex.: -10" className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Estoque</span>
          <select value={stockMode} onChange={(e) => setStockMode(e.target.value as "set" | "add")} className={inputCls}>
            <option value="add">Somar / subtrair</option>
            <option value="set">Definir valor</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Quantidade</span>
          <input inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="ex.: 20" className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Situação</span>
          <select value={active} onChange={(e) => setActive(e.target.value as "" | "on" | "off")} className={inputCls}>
            <option value="">Manter</option>
            <option value="on">Ativar</option>
            <option value="off">Desativar</option>
          </select>
        </label>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          const st = stock.trim() === "" ? null : Math.round(num(stock));
          void onApply({
            price_percent: percent.trim() === "" ? null : num(percent),
            stock: stockMode === "set" ? st : null,
            stock_add: stockMode === "add" ? st : null,
            active: active === "" ? null : active === "on",
          });
        }}
        className="rounded-full cta-gradient px-4 py-2 text-[12.5px] font-extrabold text-primary-foreground disabled:opacity-60"
      >
        Aplicar aos selecionados
      </button>
    </div>
  );
}

function QuickRow({
  product,
  stores,
  checked,
  onToggle,
  onSave,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  product: AdminProduct;
  stores: StoreChoice[];
  checked: boolean;
  onToggle: () => void;
  onSave: (patch: { price?: number; previous_price?: number; stock?: number; active?: boolean; store_id?: string }) => Promise<unknown>;
  onEdit: () => void;
  onDuplicate: () => Promise<unknown>;
  onDelete: () => void;
}) {
  const [price, setPrice] = useState(moneyInput(product.price));
  const [previous, setPrevious] = useState(moneyInput(product.previous_price));
  const [stock, setStock] = useState(String(product.stock));
  useEffect(() => {
    setPrice(moneyInput(product.price));
    setPrevious(moneyInput(product.previous_price));
    setStock(String(product.stock));
  }, [product.price, product.previous_price, product.stock]);
  const off = discountPercent(num(price), num(previous));
  const dirty =
    num(price) !== product.price || num(previous) !== product.previous_price || Math.round(num(stock)) !== product.stock;

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
        <input type="checkbox" checked={checked} onChange={onToggle} className="mt-1" aria-label="Selecionar" />
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-bold">{product.name}</p>
          <p className="truncate text-[11.5px] text-muted-foreground">
            /produto/{product.slug} · {brl(product.price)} · {off > 0 ? `${off}% OFF` : "sem desconto"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSave({ active: !product.active })}
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold uppercase ${
            product.active ? "bg-success-soft text-success" : "bg-surface-strong text-muted-foreground"
          }`}
          title="Clique para alternar"
        >
          {product.active ? "Ativo" : "Inativo"}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Field label="Preço atual" value={price} onChange={setPrice} />
        <Field label="Preço anterior" value={previous} onChange={setPrevious} />
        <Field label="Estoque" value={stock} onChange={setStock} />
      </div>
      {stores.length > 0 && (
        <label className="mt-2 block">
          <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Loja</span>
          <select
            value={product.store_id ?? ""}
            onChange={(e) => e.target.value && void onSave({ store_id: e.target.value })}
            className={inputCls}
          >
            {!product.store_id && <option value="">Sem loja</option>}
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {dirty && (
          <button
            type="button"
            onClick={() => onSave({ price: num(price), previous_price: num(previous), stock: Math.round(num(stock)) })}
            className="rounded-full cta-gradient px-4 py-2 text-[12px] font-extrabold text-primary-foreground"
          >
            Salvar
          </button>
        )}
        <Btn onClick={onEdit}><Pencil size={13} /> Editar tudo</Btn>
        <Btn onClick={onDuplicate}><Copy size={13} /> Duplicar</Btn>
        <a href={`/produto/${product.slug}`} target="_blank" rel="noreferrer" className={btnCls}>
          <ExternalLink size={13} /> Ver
        </a>
        <Btn onClick={onDelete} danger><Trash2 size={13} /></Btn>
      </div>
    </div>
  );
}

const btnCls =
  "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-[12px] font-bold";
function Btn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => unknown; danger?: boolean }) {
  return (
    <button type="button" onClick={() => void onClick()} className={`${btnCls} ${danger ? "text-destructive" : ""}`}>
      {children}
    </button>
  );
}

function Field({ label, value, onChange, numeric = true }: { label: string; value: string; onChange: (v: string) => void; numeric?: boolean }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">{label}</span>
      <input
        inputMode={numeric ? "decimal" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} ${numeric ? "tnum" : ""}`}
      />
    </label>
  );
}

type Detail = Awaited<ReturnType<typeof getAdminProduct>>;

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function ProductEditor({ id, onSaved }: { id: string; onSaved: () => Promise<unknown> }) {
  const load = useServerFn(getAdminProduct);
  const save = useServerFn(saveProductDetails);
  const upload = useServerFn(uploadProductImage);
  const createUpload = useServerFn(createMediaUpload);
  const finalizeUpload = useServerFn(finalizeMediaUpload);
  const [d, setD] = useState<Detail | null>(null);
  const [price, setPrice] = useState("");
  const [previous, setPrevious] = useState("");
  const [stock, setStock] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    let alive = true;
    load({ data: { id } })
      .then((p) => {
        if (!alive) return;
        setD({ ...p, sections: p.sections ?? {}, creator_videos: p.creator_videos ?? [], reviews: p.reviews ?? [], description: p.description ?? [], specs: p.specs ?? [], media: p.media ?? [], protection: p.protection ?? {}, variants: p.variants ?? [], variant_combos: p.variant_combos ?? [] } as Detail);
        setPrice(moneyInput(p.price));
        setPrevious(moneyInput(p.previous_price));
        setStock(String(p.stock));
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Erro ao carregar."));
    return () => {
      alive = false;
    };
  }, [id, load]);

  if (!d) return <div className="grid place-items-center py-16"><Loader2 className="animate-spin text-muted-foreground" /></div>;

  const set = <K extends keyof Detail>(k: K, v: Detail[K]) => setD({ ...d, [k]: v });
  const media = d.media as Media[];
  const moveMedia = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= media.length) return;
    const next = [...media];
    [next[i], next[j]] = [next[j]!, next[i]!];
    set("media", next as Detail["media"]);
  };

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const added: Media[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 7 * 1024 * 1024) {
        toast.error(`${f.name}: máximo 7 MB.`);
        continue;
      }
      const type = f.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
      if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(type)) {
        toast.error(`${f.name}: formato não suportado.`);
        continue;
      }
      const r = await upload({ data: { filename: f.name, contentType: type, base64: await fileToBase64(f) } });
      if (r.ok) added.push({ type: "image", url: r.url, alt: d!.name });
      else toast.error(r.error);
    }
    setD((cur) => (cur ? { ...cur, media: [...cur.media, ...added] as Detail["media"] } : cur));
    setUploading(false);
  }

  const off = discountPercent(num(price), num(previous));

  async function uploadOne(file: File, apply: (url: string) => void) {
    setUploading(true);
    try { apply(await uploadMedia(file, createUpload as never, finalizeUpload as never)); toast.success("Arquivo enviado."); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Falha no envio."); }
    finally { setUploading(false); }
  }
  async function uploadMany(files: File[], apply: (urls: string[]) => void) {
    setUploading(true);
    const urls: string[] = [];
    for (const f of files) {
      try { urls.push(await uploadMedia(f, createUpload as never, finalizeUpload as never)); }
      catch (err) { toast.error(err instanceof Error ? err.message : "Falha no envio."); }
    }
    apply(urls);
    setUploading(false);
  }

  return (
    <form
      className="space-y-5 px-1 pb-8 pt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        const cleanGroups = (d.variants ?? [])
          .map((g) => ({ ...g, label: g.label.trim() || g.name, use_image: g.use_image === true, options: g.options.filter((o) => o.label.trim()) }))
          .filter((g) => g.options.length > 0);
        const validKeys = allComboKeys(cleanGroups);
        try {
          const r = await save({
            data: {

              id: d.id,
              name: d.name,
              title: d.title,
              subtitle: d.subtitle?.trim() ? d.subtitle : null,
              slug: d.slug,
              price: num(price),
              previous_price: num(previous),
              stock: Math.round(num(stock)),
              active: d.active,
              warranty: d.warranty?.trim() ? d.warranty : null,
              rating: Number(d.rating),
              reviews_count: Math.round(Number(d.reviews_count)),
              sold_count: Math.round(Number(d.sold_count)),
              media: d.media,
              specs: d.specs.filter((s) => s.label.trim() && s.value.trim()),
              protection: {
                title: d.protection.title?.trim() || "Proteção do cliente",
                subtitle: d.protection.subtitle?.trim() || "Compra 100% garantida do início ao fim",
                items: (d.protection.items ?? []).filter((item) => item.trim()),
              },
              creator_videos: (d.creator_videos ?? []).filter((video) => video.video || video.thumb).map((v) => ({ ...v, handle: v.handle ?? "", thumb: v.thumb || "" })).slice(0, 7),
              reviews: (d.reviews ?? []).filter((review) => review.name?.trim() && review.text?.trim()).map((r) => ({ ...r, rating: Number(r.rating) || 5 })),
              description: (d.description ?? []).filter((b) => b.type === "spacer" || (b.type === "list" ? (b.items ?? []).some((i) => i?.trim()) : "url" in b ? b.url?.trim() : b.text?.trim())),
              sections: d.sections ?? {},
              variants: cleanGroups,
              variant_combos: (d.variant_combos ?? [])
                .filter((c) => validKeys.includes(c.key))
                .map((c) => ({ ...c, sku: c.sku?.trim() ? c.sku.trim() : null })),
              display: {
                ...(d.display ?? {}),
                reviews_label: d.display?.reviews_label?.trim() ? d.display.reviews_label.trim() : null,
                sold_label: d.display?.sold_label?.trim() ? d.display.sold_label.trim() : null,
                badge1_text: d.display?.badge1_text?.trim() ? d.display.badge1_text.trim() : null,
                badge2_text: d.display?.badge2_text?.trim() ? d.display.badge2_text.trim() : null,
                rs_title: d.display?.rs_title?.trim() ? d.display.rs_title.trim() : null,
                rs_max: d.display?.rs_max?.trim() ? d.display.rs_max.trim() : null,
              },




            },
          });
          if (!r.ok) toast.error(r.error);
          else {
            toast.success("Produto salvo.");
            await onSaved();
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Verifique os campos.");
        } finally {
          setSaving(false);
        }
      }}
    >
      <Group title="Informações">
        <Field numeric={false} label="Nome interno" value={d.name} onChange={(v) => set("name", v)} />
        <Field numeric={false} label="Título na página" value={d.title} onChange={(v) => set("title", v)} />
        <Field numeric={false} label="Subtítulo" value={d.subtitle ?? ""} onChange={(v) => set("subtitle", v)} />
        <Field
          numeric={false}
          label="Endereço (/produto/…)"
          value={d.slug}
          onChange={(v) => set("slug", v.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
        />
        <label className="flex items-center gap-2 text-[13px] font-semibold">
          <input type="checkbox" checked={d.active} onChange={(e) => set("active", e.target.checked)} />
          Produto ativo (visível na loja)
        </label>
      </Group>

      <Group title="Preço e estoque">
        <div className="grid grid-cols-3 gap-2">
          <Field label="Preço atual" value={price} onChange={setPrice} />
          <Field label="Preço anterior" value={previous} onChange={setPrevious} />
          <Field label="Estoque" value={stock} onChange={setStock} />
        </div>
        <p className="text-[12px] text-muted-foreground">
          Desconto calculado: <b>{off}%</b> · Economia: <b>{brl(Math.max(0, num(previous) - num(price)))}</b>
        </p>
      </Group>

      <Group title="Textos e métricas exibidas">
        <p className="text-[11.5px] text-muted-foreground">
          Controla o que aparece na página do produto e no popup de compra. Em <b>Automático</b>, usamos os números reais do cadastro.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[12px] font-semibold">
            Nota de avaliação exibida (0 a 5)
            <input
              defaultValue={d.display?.rating != null ? String(d.display.rating).replace(".", ",") : ""}
              placeholder="4,8"
              onChange={(e) => set("display", { ...(d.display ?? {}), rating: e.target.value.trim() ? parseRatingInput(e.target.value) : null })}
              className={inputCls}
            />
          </label>
          <label className="text-[12px] font-semibold">
            Fonte da avaliação
            <select
              value={d.display?.rating_source ?? "auto"}
              onChange={(e) => set("display", { ...(d.display ?? {}), rating_source: e.target.value as "auto" | "manual" })}
              className={inputCls}
            >
              <option value="auto">Automática (média das avaliações)</option>
              <option value="manual">Manual</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-[12px] font-semibold">
            Nº de avaliações
            <input
              defaultValue={d.display?.reviews_count != null ? String(d.display.reviews_count) : ""}
              placeholder="722"
              onChange={(e) => set("display", { ...(d.display ?? {}), reviews_count: e.target.value.trim() ? Math.max(0, Math.round(num(e.target.value))) : null })}
              className={inputCls}
            />
          </label>
          <label className="text-[12px] font-semibold">
            Texto de avaliações
            <input
              value={d.display?.reviews_label ?? ""}
              placeholder="avaliações"
              onChange={(e) => set("display", { ...(d.display ?? {}), reviews_label: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className="text-[12px] font-semibold">
            Fonte
            <select
              value={d.display?.reviews_source ?? "auto"}
              onChange={(e) => set("display", { ...(d.display ?? {}), reviews_source: e.target.value as "auto" | "manual" })}
              className={inputCls}
            >
              <option value="auto">Automático</option>
              <option value="manual">Manual</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="text-[12px] font-semibold">
            Nº de vendidos
            <input
              defaultValue={d.display?.sold_count != null ? String(d.display.sold_count) : ""}
              placeholder="6065"
              onChange={(e) => set("display", { ...(d.display ?? {}), sold_count: e.target.value.trim() ? Math.max(0, Math.round(num(e.target.value))) : null })}
              className={inputCls}
            />
          </label>
          <label className="text-[12px] font-semibold">
            Texto de vendidos
            <input
              value={d.display?.sold_label ?? ""}
              placeholder="vendidos"
              onChange={(e) => set("display", { ...(d.display ?? {}), sold_label: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className="text-[12px] font-semibold">
            Fonte
            <select
              value={d.display?.sold_source ?? "auto"}
              onChange={(e) => set("display", { ...(d.display ?? {}), sold_source: e.target.value as "auto" | "manual" })}
              className={inputCls}
            >
              <option value="auto">Automático</option>
              <option value="manual">Manual</option>
            </select>
          </label>
        </div>
      </Group>

      <Group title="Selos promocionais">
        <label className="flex items-center gap-2 text-[13px] font-semibold">
          <input
            type="checkbox"
            checked={d.display?.badge1_show ?? true}
            onChange={(e) => set("display", { ...(d.display ?? {}), badge1_show: e.target.checked })}
          />
          Exibir selo promocional 1
        </label>
        <input
          value={d.display?.badge1_text ?? d.offer?.badge ?? ""}
          placeholder="OFERTA DE LANÇAMENTO"
          onChange={(e) => set("display", { ...(d.display ?? {}), badge1_text: e.target.value })}
          className={inputCls}
        />
        <label className="flex items-center gap-2 text-[13px] font-semibold">
          <input
            type="checkbox"
            checked={d.display?.badge2_show ?? true}
            onChange={(e) => set("display", { ...(d.display ?? {}), badge2_show: e.target.checked })}
          />
          Exibir selo promocional 2
        </label>
        <input
          value={d.display?.badge2_text ?? d.offer?.highlight ?? ""}
          placeholder="SOMENTE HOJE"
          onChange={(e) => set("display", { ...(d.display ?? {}), badge2_text: e.target.value })}
          className={inputCls}
        />
      </Group>

      <Group title="Seção de avaliações dos clientes">
        <p className="text-[11.5px] text-muted-foreground">
          Só muda o que aparece no topo da seção. As avaliações cadastradas não são alteradas.
        </p>
        <label className="text-[12px] font-semibold">
          Título da seção de avaliações
          <input
            value={d.display?.rs_title ?? ""}
            placeholder="Avaliações dos clientes"
            onChange={(e) => set("display", { ...(d.display ?? {}), rs_title: e.target.value })}
            className={inputCls}
          />
        </label>
        {(() => {
          const ds = d.display ?? {};
          const cSrc = ds.rs_count_source ?? ds.rs_source ?? "auto";
          const rSrc = ds.rs_rating_source ?? ds.rs_source ?? "auto";
          const sel = (v: string, k: "rs_count_source" | "rs_rating_source") => (
            <select value={v} onChange={(e) => set("display", { ...ds, [k]: e.target.value as "auto" | "manual" })} className={inputCls}>
              <option value="auto">Automática (avaliações reais)</option>
              <option value="manual">Manual</option>
            </select>
          );
          return (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[12px] font-semibold">
                Nota média
                {sel(rSrc, "rs_rating_source")}
                {rSrc === "manual" && (
                  <input
                    defaultValue={ds.rs_rating != null ? String(ds.rs_rating).replace(".", ",") : ""}
                    placeholder="4,8"
                    onChange={(e) => set("display", { ...(d.display ?? {}), rs_rating: e.target.value.trim() ? parseRatingInput(e.target.value) : null })}
                    className={inputCls}
                  />
                )}
              </label>
              <label className="text-[12px] font-semibold">
                Quantidade exibida
                {sel(cSrc, "rs_count_source")}
                {cSrc === "manual" && (
                  <input
                    inputMode="numeric"
                    defaultValue={ds.rs_count != null ? String(ds.rs_count) : ""}
                    placeholder="17800"
                    onChange={(e) => set("display", { ...(d.display ?? {}), rs_count: e.target.value.trim() ? Math.max(0, Math.round(Number(e.target.value.replace(/\D+/g, "")) || 0)) : null })}
                    className={inputCls}
                  />
                )}
              </label>
              <label className="text-[12px] font-semibold">
                Nota máxima exibida
                <input
                  value={ds.rs_max ?? ""}
                  placeholder="5"
                  onChange={(e) => set("display", { ...(d.display ?? {}), rs_max: e.target.value })}
                  className={inputCls}
                />
              </label>
            </div>
          );
        })()}
        <p className="text-[11px] text-muted-foreground">Ex.: 17800 aparece como "17,8 mil". "Vendidos" não entra nessa conta.</p>
      </Group>



      <Group title={`Imagens (${media.length})`}>
        <p className="text-[11.5px] text-muted-foreground">A primeira imagem é a capa. Use as setas para reordenar.</p>
        <div className="grid grid-cols-3 gap-2">
          {media.map((m, i) => (
            <div key={`${m.url}-${i}`} className="relative overflow-hidden rounded-lg border border-border">
              <img src={m.type === "video" ? m.poster ?? "" : m.url} alt={m.alt ?? ""} className="aspect-square w-full object-cover" />
              {i === 0 && (
                <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                  <Star size={10} /> Capa
                </span>
              )}
              {m.type === "video" && (
                <span className="absolute right-1 top-1 rounded bg-foreground/70 px-1.5 py-0.5 text-[10px] font-bold text-background">Vídeo</span>
              )}
              <div className="flex justify-between bg-card p-1">
                <button type="button" aria-label="Mover para trás" onClick={() => moveMedia(i, -1)}><ArrowUp size={14} className="-rotate-90" /></button>
                <button
                  type="button"
                  aria-label="Remover imagem"
                  onClick={() => set("media", media.filter((_, k) => k !== i) as Detail["media"])}
                  className="text-destructive"
                >
                  <Trash2 size={14} />
                </button>
                <button type="button" aria-label="Mover para frente" onClick={() => moveMedia(i, 1)}><ArrowDown size={14} className="-rotate-90" /></button>
              </div>
            </div>
          ))}
          <label className="grid aspect-square cursor-pointer place-items-center rounded-lg border border-dashed border-border text-center text-[11.5px] font-semibold text-muted-foreground">
            {uploading ? <Loader2 className="animate-spin" /> : <span className="grid place-items-center gap-1"><ImagePlus size={20} /> Enviar fotos</span>}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden disabled={uploading} onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
        <div className="flex gap-2">
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="ou cole o link de uma imagem (https://…)" className={inputCls} />
          <button
            type="button"
            onClick={() => {
              if (!/^https?:\/\//.test(imageUrl.trim())) { toast.error("Link inválido."); return; }
              set("media", [...media, { type: "image", url: imageUrl.trim(), alt: d.name }] as Detail["media"]);
              setImageUrl("");
            }}
            className={btnCls}
          >
            Adicionar
          </button>
        </div>
      </Group>

      <Group title="Popup de notificações">
        <select value={d.sections.popup_mode ?? "store"} onChange={(e) => set("sections", { ...d.sections, popup_mode: e.target.value as "store" | "on" | "off" })} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-[13px]">
          <option value="store">Usar configuração da loja</option>
          <option value="on">Ativar neste produto</option>
          <option value="off">Desativar neste produto</option>
        </select>
      </Group>

      <Group title="Oferta de saída do checkout">
        <select value={d.sections.exit_offer_mode ?? "store"} onChange={(e) => set("sections", { ...d.sections, exit_offer_mode: e.target.value as "store" | "on" | "off" })} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-[13px]">
          <option value="store">Usar configuração da loja</option>
          <option value="on">Ativar neste produto (configuração própria)</option>
          <option value="off">Desativar neste produto</option>
        </select>
        {d.sections.exit_offer_mode === "on" && <ExitOfferFields product value={d.sections.exit_offer} onChange={(v) => set("sections", { ...d.sections, exit_offer: v })} />}
      </Group>

      <Group title="Pop-up de saída da página do produto">
        <select value={d.sections.product_exit_offer_mode ?? "store"} onChange={(e) => set("sections", { ...d.sections, product_exit_offer_mode: e.target.value as "store" | "on" | "off" })} className="h-10 w-full rounded-lg border border-input bg-card px-3 text-[13px]">
          <option value="store">Usar configuração da loja</option>
          <option value="on">Ativar apenas neste produto (configuração própria)</option>
          <option value="off">Desativar neste produto</option>
        </select>
        {d.sections.product_exit_offer_mode === "on" && <ExitOfferFields product value={d.sections.product_exit_offer} onChange={(v) => set("sections", { ...d.sections, product_exit_offer: v })} />}
      </Group>

      <Group title="Perguntas sobre o produto / IA">
        <label className="flex items-center gap-2 text-[12.5px] font-semibold">
          <input type="checkbox" checked={d.sections.qa_enabled !== false} onChange={(e) => set("sections", { ...d.sections, qa_enabled: e.target.checked })} />
          {d.sections.qa_enabled !== false ? "Exibir Perguntas sobre o produto: Ativado" : "Exibir Perguntas sobre o produto: Desativado (a seção não aparece)"}
        </label>
        <Field numeric={false} label="Título da seção" value={d.sections.qa_title ?? ""} onChange={(v) => set("sections", { ...d.sections, qa_title: v })} />
        <Field numeric={false} label="Subtítulo" value={d.sections.qa_subtitle ?? ""} onChange={(v) => set("sections", { ...d.sections, qa_subtitle: v })} />
        <Field numeric={false} label="Texto de exemplo do campo" value={d.sections.qa_placeholder ?? ""} onChange={(v) => set("sections", { ...d.sections, qa_placeholder: v })} />
        <span className="text-[11px] font-semibold text-muted-foreground">Informações adicionais para a IA (só fatos verdadeiros)</span>
        <textarea rows={4} value={d.sections.qa_ai_info ?? ""} placeholder="Ex.: Pode ser usado em piso frio, madeira e carpete baixo." onChange={(e) => set("sections", { ...d.sections, qa_ai_info: e.target.value })} className={inputCls} />
      </Group>

      <Group title="Sobre o produto">
        <Field numeric={false} label="Título da seção" value={d.sections.about_title ?? ""} onChange={(v) => set("sections", { ...d.sections, about_title: v })} />
        {d.specs.map((s, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] gap-2">
            <input value={s.label} placeholder="Título (ex.: Estrutura)" onChange={(e) => set("specs", d.specs.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} className={inputCls} />
            <input value={s.value} placeholder="Valor" onChange={(e) => set("specs", d.specs.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)))} className={inputCls} />
            <Order onUp={() => set("specs", move(d.specs, i, -1))} onDown={() => set("specs", move(d.specs, i, 1))} onRemove={() => set("specs", d.specs.filter((_, k) => k !== i))} />
          </div>
        ))}
        <button type="button" onClick={() => set("specs", [...d.specs, { label: "", value: "" }])} className={btnCls}>
          <Plus size={13} /> Adicionar linha
        </button>
        <Field numeric={false} label="Garantia" value={d.warranty ?? ""} onChange={(v) => set("warranty", v)} />
      </Group>

      <Group title="Proteção do cliente">
        <Field numeric={false} label="Título" value={d.protection.title ?? ""} onChange={(v) => set("protection", { ...d.protection, title: v })} />
        <Field numeric={false} label="Subtítulo" value={d.protection.subtitle ?? ""} onChange={(v) => set("protection", { ...d.protection, subtitle: v })} />
        {(d.protection.items ?? []).map((item, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <input value={item} onChange={(e) => set("protection", { ...d.protection, items: (d.protection.items ?? []).map((x, k) => k === i ? e.target.value : x) })} className={inputCls} />
            <button type="button" aria-label="Remover item" onClick={() => set("protection", { ...d.protection, items: (d.protection.items ?? []).filter((_, k) => k !== i) })} className="text-destructive"><Trash2 size={14} /></button>
          </div>
        ))}
        <button type="button" onClick={() => set("protection", { ...d.protection, items: [...(d.protection.items ?? []), ""] })} className={btnCls}><Plus size={13} /> Adicionar item</button>
      </Group>

      <Group title="Variações do produto">
        <VariantsEditor
          groups={(d.variants ?? []) as VariantGroup[]}
          combos={(d.variant_combos ?? []) as VariantCombo[]}
          price={num(price)}
          previousPrice={num(previous)}
          onGroups={(next) => set("variants", next as Detail["variants"])}
          onCombos={(next) => set("variant_combos", next as Detail["variant_combos"])}
          uploadOne={uploadOne}
          uploading={uploading}
        />
      </Group>


      <Group title={`Vídeos de criadores (${d.creator_videos.length}/7)`}>
        <div className="space-y-2 rounded-xl border border-border p-3">
          <p className="text-[12px] font-bold uppercase text-muted-foreground">Configuração da seção de vídeos</p>
          <Field numeric={false} label="Título superior (vazio = Vídeos de criadores)" value={d.sections.videos_title ?? ""} onChange={(v) => set("sections", { ...d.sections, videos_title: v })} />
          <Field numeric={false} label="Quantidade exibida (vazio = nº de vídeos; ex.: 14,9 mil)" value={d.sections.videos_count ?? ""} onChange={(v) => set("sections", { ...d.sections, videos_count: v })} />
          <Field numeric={false} label="Texto Ver mais" value={d.sections.videos_more_text ?? ""} onChange={(v) => set("sections", { ...d.sections, videos_more_text: v })} />
          <Field numeric={false} label="Subtítulo da seção" value={d.sections.videos_subtitle ?? ""} onChange={(v) => set("sections", { ...d.sections, videos_subtitle: v })} />
          <Field numeric={false} label="Texto de orientação (ex.: arraste)" value={d.sections.videos_hint_text ?? ""} onChange={(v) => set("sections", { ...d.sections, videos_hint_text: v })} />
          <div className="grid grid-cols-2 gap-1.5 text-[12px] font-semibold">
            {([["videos_show_count", "Exibir quantidade", true], ["videos_show_more", "Exibir Ver mais", false], ["videos_show_icon", "Exibir ícone de vídeo", false], ["videos_show_hint", "Exibir orientação", false]] as const).map(([k, label, def]) => (
              <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={d.sections[k] ?? def} onChange={(e) => set("sections", { ...d.sections, [k]: e.target.checked })} /> {label}</label>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">"Ver mais" abre uma tela com todos os vídeos da seção.</p>
          <label className="block text-[12px] font-semibold">Estilo dos cards
            <select value={d.sections.videos_card_style ?? "overlay"} onChange={(e) => set("sections", { ...d.sections, videos_card_style: e.target.value as "overlay" | "below" })} className={inputCls}>
              <option value="overlay">Modelo 1 — Informações sobre o vídeo</option>
              <option value="below">Modelo 2 — Informações abaixo do vídeo</option>
            </select>
          </label>
        </div>
        <p className="text-[11.5px] text-muted-foreground">Envie vídeos MP4 ou WebM (até 100 MB). A capa é opcional.</p>
        {d.creator_videos.map((video, i) => {
          const upd = (patch: Partial<CreatorVideo>) => set("creator_videos", d.creator_videos.map((x, k) => (k === i ? { ...x, ...patch } : x)));
          return (
            <DragCard key={i} list="videos" index={i} onMove={(from, to) => set("creator_videos", moveTo(d.creator_videos, from, to))}>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <span className="flex items-center gap-1 text-[11px] font-bold uppercase text-muted-foreground"><DragHandle /> Vídeo {i + 1}</span>
                <Order onUp={() => set("creator_videos", move(d.creator_videos, i, -1))} onDown={() => set("creator_videos", move(d.creator_videos, i, 1))} onRemove={() => set("creator_videos", d.creator_videos.filter((_, k) => k !== i))} />
              </div>
              <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-2">
                <div className="aspect-[9/16] overflow-hidden rounded-lg bg-surface">
                  {video.video ? <video src={video.video} poster={video.thumb || undefined} preload="metadata" muted playsInline className="size-full object-cover" /> : video.thumb ? <img src={video.thumb} alt="" className="size-full object-cover" /> : null}
                </div>
                <div className="space-y-2">
                  <UploadBtn label={video.video ? "Substituir vídeo" : "Enviar vídeo"} accept={VIDEO_ACCEPT} onFile={(f) => uploadOne(f, (url) => upd({ video: url }))} />
                  <p className="text-[11px] text-muted-foreground">Prefira MP4 (H.264) ou WebM, até 100 MB. Vídeos MOV do iPhone podem não tocar em celulares Android.</p>
                  <UploadBtn label={video.thumb ? "Substituir capa" : "Enviar capa (opcional)"} accept={IMAGE_ACCEPT} onFile={(f) => uploadOne(f, (url) => upd({ thumb: url }))} />
                  <div className="flex items-center gap-2">
                    {video.avatar && <img src={video.avatar} alt="" className="size-8 rounded-full object-cover" />}
                    <UploadBtn label={video.avatar ? "Trocar foto do criador" : "Enviar foto do criador"} accept={IMAGE_ACCEPT} onFile={(f) => uploadOne(f, (url) => upd({ avatar: url }))} />
                    {video.avatar && <button type="button" onClick={() => upd({ avatar: null })} className="text-[12px] font-semibold text-destructive">Remover</button>}
                  </div>
                  <input value={video.handle} placeholder="@ do criador" onChange={(e) => upd({ handle: e.target.value })} className={inputCls} />
                </div>
              </div>
              <input value={video.name ?? ""} placeholder="Nome do criador" onChange={(e) => upd({ name: e.target.value })} className={inputCls} />
              <input value={video.title ?? ""} placeholder="Título curto (ex.: Antes e depois)" onChange={(e) => upd({ title: e.target.value })} className={inputCls} />
              <input value={video.description ?? ""} placeholder="Descrição curta (opcional)" onChange={(e) => upd({ description: e.target.value })} className={inputCls} />
              <select value={String(video.rating ?? "")} onChange={(e) => upd({ rating: e.target.value ? Number(e.target.value) : null })} className={inputCls}>
                <option value="">Sem estrelas</option>
                {[5, 4.9, 4.8, 4.7, 4.5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{String(n).replace(".", ",")} estrela{n > 1 ? "s" : ""}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-1.5 text-[12px] font-semibold">
                {([["show_title", "Mostrar título", true], ["show_handle", "Mostrar @", true], ["show_name", "Mostrar nome", false], ["show_stars", "Mostrar estrelas", false], ["show_avatar", "Mostrar foto", true], ["verified", "Criador verificado", false], ["show_rating_number", "Mostrar nota", false], ["show_description", "Mostrar descrição", false]] as const).map(([k, label, def]) => (
                  <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={video[k] ?? def} onChange={(e) => upd({ [k]: e.target.checked })} /> {label}</label>
                ))}
              </div>
            </DragCard>
          );
        })}
        {d.creator_videos.length < 7 && (
          <button type="button" onClick={() => set("creator_videos", [...d.creator_videos, { handle: "", thumb: "", video: null, show_title: true, show_handle: true }])} className={btnCls}><Plus size={13} /> Adicionar vídeo</button>
        )}
      </Group>

      <Group title={`Avaliações (${d.reviews.length})`}>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Nota média" value={String(d.rating)} onChange={(v) => set("rating", Math.min(5, Math.max(0, num(v))))} />
          <Field label="Quantidade exibida" value={String(d.reviews_count)} onChange={(v) => set("reviews_count", Math.max(0, Math.round(num(v))))} />
          <Field label="Vendidos" value={String(d.sold_count)} onChange={(v) => set("sold_count", Math.max(0, Math.round(num(v))))} />
        </div>
        {(() => { const size = Math.min(20, Math.max(1, Math.round(Number(d.sections.reviews_page_size)) || 20)); return (<>
          <label className="block text-[11px] font-semibold text-muted-foreground">Avaliações por carregamento (1 a 20)
            <input type="number" min={1} max={20} step={1} value={d.sections.reviews_page_size ?? 20} onChange={(e) => { const n = Math.round(Number(e.target.value)); set("sections", { ...d.sections, reviews_page_size: Number.isFinite(n) && n >= 1 ? Math.min(20, n) : undefined }); }} className={`${inputCls} mt-1 max-w-[120px]`} />
          </label>
          <p className="text-[11.5px] text-muted-foreground">A página mostra {size} avaliações de início e mais {size} a cada "Ver mais". Adicione apenas avaliações reais.</p>
        </>); })()}
        <ReviewsCsvImport existing={d.reviews} onImport={(add) => setD((cur) => { if (!cur) return cur; const list = [...cur.reviews]; for (const { review, order } of add) { if (order != null && order >= 1 && order <= list.length) list.splice(order - 1, 0, review); else list.push(review); } return { ...cur, reviews: list }; })} />
        {d.reviews.map((review, i) => {
          const upd = (patch: Partial<Review>) => set("reviews", d.reviews.map((x, k) => (k === i ? { ...x, ...patch } : x)));
          return (
            <div key={i} className="space-y-2 rounded-lg border border-border p-2.5">
              <div className="grid grid-cols-[40px_minmax(0,1fr)_80px_auto] items-center gap-2">
                <label className="grid size-10 cursor-pointer place-items-center overflow-hidden rounded-full bg-surface" title="Avatar">
                  {review.avatar ? <img src={review.avatar} alt="" className="size-full object-cover" /> : <ImagePlus size={14} />}
                  <input type="file" hidden accept={IMAGE_ACCEPT} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadOne(f, (url) => upd({ avatar: url })); }} />
                </label>
                <input value={review.name} placeholder="Nome" onChange={(e) => upd({ name: e.target.value })} className={inputCls} />
                <select value={String(review.rating)} onChange={(e) => upd({ rating: Number(e.target.value) })} className={inputCls}>
                  {[...new Set([5, 4.9, 4.8, 4.7, 4.5, 4, 3, 2, 1, Number(review.rating) || 5])].sort((a, b) => b - a).map((n) => <option key={n} value={n}>{String(n).replace(".", ",")}★</option>)}
                </select>
                <Order onUp={() => set("reviews", move(d.reviews, i, -1))} onDown={() => set("reviews", move(d.reviews, i, 1))} onRemove={() => set("reviews", d.reviews.filter((_, k) => k !== i))} />
              </div>
              <input value={review.date} placeholder="Data/tempo (ex.: Há 2 horas)" onChange={(e) => upd({ date: e.target.value })} className={inputCls} />
              <textarea value={review.text} placeholder="Texto da avaliação" onChange={(e) => upd({ text: e.target.value })} rows={3} className={inputCls} />
              <div className="flex flex-wrap gap-2">
                {(review.photos ?? []).map((p, k) => (
                  <div key={p + k} className="relative size-16 overflow-hidden rounded-lg">
                    <img src={p} alt="" className="size-full object-cover" />
                    <button type="button" aria-label="Remover foto" onClick={() => upd({ photos: (review.photos ?? []).filter((_, j) => j !== k) })} className="absolute right-0.5 top-0.5 rounded-full bg-card p-0.5 text-destructive"><X size={12} /></button>
                  </div>
                ))}
                <label className="grid size-16 cursor-pointer place-items-center rounded-lg border border-dashed border-border text-muted-foreground">
                  <ImagePlus size={16} />
                  <input type="file" hidden multiple accept={IMAGE_ACCEPT} onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; void uploadMany(files, (urls) => setD((cur) => cur ? { ...cur, reviews: cur.reviews.map((x, k) => k === i ? { ...x, photos: [...(x.photos ?? []), ...urls] } : x) } : cur)); }} />
                </label>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11.5px] font-bold">Vídeos da avaliação</p>
                {(review.videos ?? []).map((v, k) => {
                  const vids = review.videos ?? [];
                  return (
                    <div key={v + k} className="flex items-center gap-2 rounded-lg border border-border p-1.5">
                      <video src={v} preload="metadata" controls playsInline className="h-20 w-28 shrink-0 rounded bg-foreground object-cover" />
                      <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{decodeURIComponent(v.split("/").pop() ?? v)}</span>
                      <label className="cursor-pointer text-[11px] font-semibold text-primary">Substituir
                        <input type="file" hidden accept={VIDEO_ACCEPT} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadOne(f, (url) => setD((cur) => cur ? { ...cur, reviews: cur.reviews.map((x, j) => j === i ? { ...x, videos: (x.videos ?? []).map((u, m) => m === k ? url : u) } : x) } : cur)); }} />
                      </label>
                      <Order onUp={() => upd({ videos: move(vids, k, -1) })} onDown={() => upd({ videos: move(vids, k, 1) })} onRemove={() => upd({ videos: vids.filter((_, j) => j !== k) })} />
                    </div>
                  );
                })}
                <label className={`${btnCls} cursor-pointer`}><Plus size={13} /> Adicionar vídeo
                  <input type="file" hidden multiple accept={VIDEO_ACCEPT} onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; void uploadMany(files, (urls) => setD((cur) => cur ? { ...cur, reviews: cur.reviews.map((x, k) => k === i ? { ...x, videos: [...(x.videos ?? []), ...urls] } : x) } : cur)); }} />
                </label>
              </div>
              {review.avatar && <button type="button" onClick={() => upd({ avatar: null })} className="text-[11px] font-semibold text-destructive">Remover avatar</button>}
              <label className="flex items-center gap-2 text-[12px] font-semibold"><input type="checkbox" checked={review.confirmed ?? false} onChange={(e) => upd({ confirmed: e.target.checked })} /> Compra confirmada</label>
            </div>
          );
        })}
        <button type="button" onClick={() => set("reviews", [...d.reviews, { name: "", rating: 5, date: "", text: "", confirmed: true, photos: [], avatar: null }])} className={btnCls}><Plus size={13} /> Adicionar avaliação</button>
      </Group>

      <Group title="Descrição">
        <Field numeric={false} label="Título da descrição" value={d.sections.description_title ?? ""} onChange={(v) => set("sections", { ...d.sections, description_title: v })} />
        <p className="text-[11.5px] text-muted-foreground">Monte a descrição com blocos. Use **texto** para negrito. Arraste pelo ícone ⋮⋮ ou use as setas para mudar a ordem.</p>
        {d.description.map((block, i) => (
          <DragCard key={i} list="description" index={i} onMove={(from, to) => set("description", moveTo(d.description, from, to))}>
          <DescriptionEditor
            block={block as DescriptionBlock}
            onChange={(next) => set("description", d.description.map((x, k) => k === i ? next : x) as Detail["description"])}
            onRemove={() => set("description", d.description.filter((_, k) => k !== i))}
            onUp={() => set("description", move(d.description, i, -1))}
            onDown={() => set("description", move(d.description, i, 1))}
            onUpload={(f, apply) => uploadOne(f, apply)}
          />
          </DragCard>
        ))}
        <div className="flex flex-wrap gap-2">
          {([
            ["Título", { type: "heading", text: "Novo título" }],
            ["Subtítulo", { type: "subheading", text: "Novo subtítulo" }],
            ["Texto", { type: "paragraph", text: "Novo texto" }],
            ["Lista", { type: "list", items: ["Novo item"] }],
            ["Imagem", { type: "image", url: "", alt: "" }],
            ["Vídeo", { type: "video", url: "" }],
            ["Espaçamento", { type: "spacer", size: "md" }],
          ] as const).map(([label, block]) => (
            <button key={label} type="button" onClick={() => set("description", [...d.description, { ...block } as Detail["description"][number]])} className={btnCls}><Plus size={13} /> {label}</button>
          ))}
        </div>
      </Group>

      <button
        type="submit"
        disabled={saving || uploading}
        className="sticky bottom-2 w-full rounded-full cta-gradient px-4 py-3 text-[14px] font-extrabold text-primary-foreground disabled:opacity-60"
      >
        {saving ? "Salvando…" : "Salvar produto"}
      </button>
    </form>
  );
}

const BLOCK_LABEL: Record<DescriptionBlock["type"], string> = { heading: "Título", subheading: "Subtítulo", paragraph: "Texto", list: "Lista", image: "Imagem", video: "Vídeo", spacer: "Espaçamento" };

function DescriptionEditor({ block, onChange, onRemove, onUp, onDown, onUpload }: { block: DescriptionBlock; onChange: (block: DescriptionBlock) => void; onRemove: () => void; onUp: () => void; onDown: () => void; onUpload: (file: File, apply: (url: string) => void) => Promise<void> }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <span className="flex items-center gap-1 text-[11px] font-bold uppercase text-muted-foreground"><DragHandle /> {BLOCK_LABEL[block.type]}</span>
        <Order onUp={onUp} onDown={onDown} onRemove={onRemove} />
      </div>
      {(block.type === "heading" || block.type === "subheading" || block.type === "paragraph") && <textarea value={block.text} rows={block.type === "paragraph" ? 4 : 2} onChange={(e) => onChange({ ...block, text: e.target.value })} className={inputCls} />}
      {block.type === "list" && <textarea value={block.items.join("\n")} rows={4} placeholder="Um item por linha" onChange={(e) => onChange({ type: "list", items: e.target.value.split(/\n/).map((x) => x.trim()).filter(Boolean) })} className={inputCls} />}
      {block.type === "spacer" && (
        <select value={block.size ?? "md"} onChange={(e) => onChange({ type: "spacer", size: e.target.value as "sm" | "md" | "lg" })} className={inputCls}>
          <option value="sm">Pequeno</option><option value="md">Médio</option><option value="lg">Grande</option>
        </select>
      )}
      {block.type === "image" && (
        <>
          {block.url && <img src={block.url} alt="" className="max-h-40 rounded-lg object-contain" />}
          <div className="flex gap-2">
            <UploadBtn label={block.url ? "Substituir imagem" : "Enviar imagem"} accept={IMAGE_ACCEPT} onFile={(f) => onUpload(f, (url) => onChange({ ...block, url }))} />
            {block.url && <button type="button" onClick={() => onChange({ ...block, url: "" })} className="text-[11px] font-semibold text-destructive">Remover</button>}
          </div>
          <input value={block.url} placeholder="ou link da imagem" onChange={(e) => onChange({ ...block, url: e.target.value })} className={inputCls} />
          <input value={block.alt ?? ""} placeholder="Texto alternativo" onChange={(e) => onChange({ ...block, alt: e.target.value })} className={inputCls} />
          <input value={block.caption ?? ""} placeholder="Legenda (opcional)" onChange={(e) => onChange({ ...block, caption: e.target.value })} className={inputCls} />
        </>
      )}
      {block.type === "video" && (
        <>
          {block.url && <video src={block.url} poster={block.poster} controls preload="metadata" playsInline className="max-h-48 rounded-lg" />}
          <div className="flex flex-wrap gap-2">
            <UploadBtn label={block.url ? "Substituir vídeo" : "Enviar vídeo"} accept={VIDEO_ACCEPT} onFile={(f) => onUpload(f, (url) => onChange({ ...block, url }))} />
            <UploadBtn label={block.poster ? "Substituir capa" : "Enviar capa"} accept={IMAGE_ACCEPT} onFile={(f) => onUpload(f, (poster) => onChange({ ...block, poster }))} />
          </div>
          <input value={block.url} placeholder="ou link do vídeo" onChange={(e) => onChange({ ...block, url: e.target.value })} className={inputCls} />
        </>
      )}
    </div>
  );
}

function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

function moveTo<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

let dragState: { list: string; index: number } | null = null;

function DragHandle() {
  return <span data-drag-handle aria-label="Arrastar para reordenar" title="Arrastar para reordenar" className="cursor-grab select-none px-0.5 text-[14px] leading-none text-muted-foreground active:cursor-grabbing">⋮⋮</span>;
}

function DragCard({ list, index, onMove, children }: { list: string; index: number; onMove: (from: number, to: number) => void; children: React.ReactNode }) {
  const [armed, setArmed] = React.useState(false);
  const [over, setOver] = React.useState(false);
  return (
    <div
      draggable={armed}
      onPointerDown={(e) => setArmed(!!(e.target as HTMLElement).closest("[data-drag-handle]"))}
      onPointerUp={() => setArmed(false)}
      onDragStart={(e) => { dragState = { list, index }; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(index)); }}
      onDragEnd={() => { dragState = null; setArmed(false); setOver(false); }}
      onDragOver={(e) => { if (dragState?.list === list) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (dragState?.list === list) onMove(dragState.index, index); dragState = null; setArmed(false); }}
      className={`space-y-2 rounded-lg border p-2.5 transition-colors ${over ? "border-primary bg-primary/5" : "border-border"}`}
    >
      {children}
    </div>
  );
}

function Order({ onUp, onDown, onRemove }: { onUp: () => void; onDown: () => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" aria-label="Subir" onClick={onUp}><ArrowUp size={14} /></button>
      <button type="button" aria-label="Descer" onClick={onDown}><ArrowDown size={14} /></button>
      <button type="button" aria-label="Remover" onClick={onRemove} className="text-destructive"><Trash2 size={14} /></button>
    </div>
  );
}

function UploadBtn({ label, accept, onFile }: { label: string; accept: string; onFile: (file: File) => unknown }) {
  return (
    <label className={`${btnCls} cursor-pointer`}>
      <ImagePlus size={13} /> {label}
      <input type="file" hidden accept={accept} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void onFile(f); }} />
    </label>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2.5">
      <legend className="mb-1 text-[13px] font-extrabold">{title}</legend>
      {children}
    </fieldset>
  );
}
