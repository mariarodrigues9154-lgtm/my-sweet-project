import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, ExternalLink, EyeOff, Eye, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { createStore, deleteStore, duplicateStore, updateReview } from "@/lib/admin.functions";
import { sizedImage } from "@/lib/media-url";

const inputCls = "w-full rounded-lg border border-input bg-card px-3 py-2 text-[13px] outline-none focus:border-primary";
const btnCls = "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[12px] font-bold disabled:opacity-50";

type Result = { ok: boolean; error?: string };

async function run(fn: () => Promise<Result>, success: string, after: () => Promise<unknown>) {
  try {
    const r = await fn();
    if (!r.ok) {
      toast.error(r.error ?? "Erro.");
      return r;
    }
    toast.success(success);
    await after();
    return r;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Erro inesperado.");
    return null;
  }
}

type StoreRow = { id: string; slug: string; name: string; active: boolean; is_default: boolean; logo_url: string | null; avatar_url?: string | null; product_count: number };

export function StoresList({ stores, onChanged }: { stores: StoreRow[]; onChanged: () => Promise<unknown> }) {
  const navigate = useNavigate();
  const create = useServerFn(createStore);
  const clone = useServerFn(duplicateStore);
  const remove = useServerFn(deleteStore);
  const [name, setName] = useState("");
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const visible = stores.filter((s) => `${s.name} ${s.slug}`.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <section className="rounded-xl bg-card p-4 shadow-card-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-extrabold">Lojas ({stores.length})</h2>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar loja…" className={`${inputCls} max-w-[220px]`} />
      </div>

      <form
        className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-xl border border-dashed border-border p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await run(() => create({ data: { name } }), "Loja criada (inativa). Complete os dados e ative.", onChanged);
          setBusy(false);
          if (r?.ok && "id" in r) {
            setName("");
            void navigate({ to: "/admin/lojas/$id", params: { id: (r as { id: string }).id } });
          }
        }}
      >
        <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da nova loja" className={inputCls} />
        <button type="submit" disabled={busy} className="inline-flex items-center gap-1 rounded-full cta-gradient px-4 py-2 text-[12.5px] font-extrabold text-primary-foreground disabled:opacity-60">
          <Plus size={14} /> Criar loja
        </button>
      </form>

      <ul className="mt-3 space-y-2">
        {visible.map((s) => (
          <li key={s.id} className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-3 rounded-xl border border-border p-3 sm:grid-cols-[48px_minmax(0,1fr)_auto]">
            <div className="grid size-12 place-items-center overflow-hidden rounded-lg bg-surface">
              {s.avatar_url ? <img src={sizedImage(s.avatar_url, 240)} alt={`Logo ${s.name}`} loading="lazy" className="size-full object-contain p-1" /> : <span className="text-[16px] font-extrabold text-muted-foreground">{s.name.charAt(0)}</span>}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-bold">
                {s.name} {s.is_default && <span className="ml-1 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-extrabold uppercase text-primary">Principal</span>}
              </p>
              <p className="truncate text-[11.5px] text-muted-foreground">
                {s.is_default ? "/loja" : `/loja/${s.slug}`} · {s.product_count} produto(s) ·{" "}
                <span className={s.active ? "text-success" : ""}>{s.active ? "Ativa" : "Inativa"}</span>
              </p>
            </div>
            <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1">
              <Link to="/admin/lojas/$id" params={{ id: s.id }} className={btnCls}><Pencil size={13} /> Editar</Link>
              <button type="button" className={btnCls} onClick={() => void run(() => clone({ data: { id: s.id } }), "Loja duplicada (inativa).", onChanged)}><Copy size={13} /> Duplicar</button>
              <a href={s.is_default ? "/loja" : `/loja/${s.slug}`} target="_blank" rel="noreferrer" className={btnCls}><ExternalLink size={13} /> Ver</a>
              {!s.is_default && (
                <button
                  type="button"
                  className={`${btnCls} text-destructive`}
                  aria-label="Excluir loja"
                  onClick={() => {
                    if (confirm(`Excluir a loja "${s.name}"? Essa ação não pode ser desfeita.`)) void run(() => remove({ data: { id: s.id } }), "Loja excluída.", onChanged);
                  }}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </li>
        ))}
        {visible.length === 0 && <p className="py-4 text-center text-[12.5px] text-muted-foreground">Nenhuma loja encontrada.</p>}
      </ul>
    </section>
  );
}

type Review = { name: string; rating: number; date?: string; text: string; confirmed?: boolean; hidden?: boolean; photos?: string[]; avatar?: string | null };
type ProductRow = { id: string; name: string; store_id?: string | null; reviews: Review[] };

export function ReviewsList({ products, stores, onChanged }: { products: ProductRow[]; stores: Array<{ id: string; name: string }>; onChanged: () => Promise<unknown> }) {
  const save = useServerFn(updateReview);
  const [filter, setFilter] = useState("");
  const [storeId, setStoreId] = useState("");
  const [productId, setProductId] = useState("");
  const [rating, setRating] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const storeName = (id?: string | null) => stores.find((s) => s.id === id)?.name ?? "—";
  const rows = products
    .filter((p) => (!storeId || p.store_id === storeId) && (!productId || p.id === productId))
    .flatMap((p) => p.reviews.map((review, index) => ({ product: p, review, index })))
    .filter(({ review }) => (!rating || Math.round(review.rating) === Number(rating)) && `${review.name} ${review.text}`.toLowerCase().includes(filter.trim().toLowerCase()));

  function submit(productId: string, index: number, review: Review | null, success: string) {
    return run(() => save({ data: { productId, index, review } as never }), success, onChanged);
  }

  return (
    <section className="rounded-xl bg-card p-4 shadow-card-soft">
      <h2 className="text-[13px] font-extrabold">Avaliações ({rows.length})</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar cliente ou texto…" className={inputCls} />
        <select value={storeId} onChange={(e) => { setStoreId(e.target.value); setProductId(""); }} className={inputCls}>
          <option value="">Todas as lojas</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputCls}>
          <option value="">Todos os produtos</option>
          {products.filter((p) => !storeId || p.store_id === storeId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={rating} onChange={(e) => setRating(e.target.value)} className={inputCls}>
          <option value="">Todas as notas</option>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} estrela(s)</option>)}
        </select>
      </div>

      <ul className="mt-3 space-y-2">
        {rows.map(({ product, review, index }) => {
          const key = `${product.id}-${index}`;
          if (editing === key) {
            return <ReviewEditor key={key} review={review} onCancel={() => setEditing(null)} onSave={async (next) => { const r = await submit(product.id, index, next, "Avaliação salva."); if (r?.ok) setEditing(null); }} />;
          }
          return (
            <li key={key} className={`rounded-xl border border-border p-3 ${review.hidden ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-[13px] font-bold">{review.name}</p>
                <span className="inline-flex items-center gap-0.5 text-[12px] font-bold text-rating"><Star size={12} className="fill-current" /> {review.rating}</span>
                {review.confirmed && <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-success"><Check size={12} /> Compra confirmada</span>}
                {review.hidden && <span className="text-[11px] font-bold uppercase text-muted-foreground">Oculta</span>}
                <span className="text-[11px] text-muted-foreground">{review.date}</span>
              </div>
              <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{storeName(product.store_id)} · {product.name}</p>
              <p className="mt-1.5 line-clamp-3 text-[12.5px]">{review.text}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={btnCls} onClick={() => setEditing(key)}><Pencil size={13} /> Editar</button>
                <button type="button" className={btnCls} onClick={() => void submit(product.id, index, { ...review, hidden: !review.hidden }, review.hidden ? "Avaliação visível." : "Avaliação oculta.")}>
                  {review.hidden ? <><Eye size={13} /> Mostrar</> : <><EyeOff size={13} /> Ocultar</>}
                </button>
                <button type="button" className={`${btnCls} text-destructive`} aria-label="Excluir avaliação" onClick={() => { if (confirm("Excluir esta avaliação?")) void submit(product.id, index, null, "Avaliação excluída."); }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          );
        })}
        {rows.length === 0 && <p className="py-4 text-center text-[12.5px] text-muted-foreground">Nenhuma avaliação encontrada. Adicione avaliações reais pelo editor do produto.</p>}
      </ul>
    </section>
  );
}

function ReviewEditor({ review, onSave, onCancel }: { review: Review; onSave: (r: Review) => Promise<void>; onCancel: () => void }) {
  const [draft, setDraft] = useState(review);
  return (
    <li className="space-y-2 rounded-xl border border-primary/40 bg-surface p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nome" className={inputCls} />
        <select value={draft.rating} onChange={(e) => setDraft({ ...draft, rating: Number(e.target.value) })} className={inputCls}>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} estrela(s)</option>)}
        </select>
        <input value={draft.date ?? ""} onChange={(e) => setDraft({ ...draft, date: e.target.value })} placeholder="Data" className={inputCls} />
      </div>
      <textarea value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} rows={3} className={inputCls} />
      <label className="flex items-center gap-2 text-[12px] font-semibold">
        <input type="checkbox" checked={Boolean(draft.confirmed)} onChange={(e) => setDraft({ ...draft, confirmed: e.target.checked })} /> Compra confirmada
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={() => void onSave(draft)} className="rounded-full cta-gradient px-4 py-2 text-[12px] font-extrabold text-primary-foreground">Salvar</button>
        <button type="button" onClick={onCancel} className={btnCls}><X size={13} /> Cancelar</button>
      </div>
    </li>
  );
}
