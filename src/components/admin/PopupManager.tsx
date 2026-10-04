import { useState } from "react";
import { ArrowDown, ArrowUp, Eye, ImagePlus, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildPopupCards, PopupCardView } from "@/components/store/FloatingPopup";
import { resolvePopupSettings, type PopupNotification, type PopupSettings } from "@/lib/product-types";

type ProductChoice = { id: string; title: string };

const input = "h-10 w-full rounded-lg border border-input bg-card px-3 text-[13px] outline-none focus:border-primary";
const PURCHASE_WORDS = /\b(compr(ou|aram|ando)|acabou de comprar|finalizou|pedido)\b/i;

export function PopupManager({ value, onChange, products, storeName, onUpload }: {
  value: PopupSettings | undefined;
  onChange: (v: PopupSettings) => void;
  products: ProductChoice[];
  storeName: string;
  onUpload: (file: File) => Promise<string | null>;
}) {
  const p = value ?? {};
  const r = resolvePopupSettings(p);
  const items = p.items ?? [];
  const [preview, setPreview] = useState(0);
  const [previewOn, setPreviewOn] = useState(false);
  const up = (patch: Partial<PopupSettings>) => onChange({ ...p, ...patch });
  const setItems = (next: PopupNotification[]) => up({ items: next });
  const upItem = (i: number, patch: Partial<PopupNotification>) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const move = (i: number, d: -1 | 1) => { const n = [...items]; const t = i + d; if (t < 0 || t >= n.length) return; [n[i], n[t]] = [n[t]!, n[i]!]; setItems(n); };
  const numField = (label: string, key: "delay" | "visible" | "interval", def: number) => (
    <label className="block"><span className="mb-1 block text-[11px] font-semibold text-muted-foreground">{label} (segundos)</span>
      <input type="number" min={key === "delay" ? 0 : 1} value={p[key] ?? def} onChange={(e) => up({ [key]: e.target.value === "" ? undefined : Number(e.target.value) })} className={input} /></label>
  );
  const sel = <K extends keyof PopupSettings>(label: string, key: K, opts: Array<[string, string]>) => (
    <label className="block"><span className="mb-1 block text-[11px] font-semibold text-muted-foreground">{label}</span>
      <select value={String(r[key as keyof typeof r])} onChange={(e) => up({ [key]: e.target.value } as Partial<PopupSettings>)} className={input}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
  );

  const previewSettings = { ...r, enabled: true };
  const sampleProduct = { id: "preview", name: products[0]?.title ?? "Produto", price: 0, reviews: [{ name: "Exemplo de cliente", rating: 5, date: "", text: "Prévia: aqui aparece o texto real das avaliações cadastradas em cada produto.", confirmed: true }] };
  const usesReviews = r.source === "reviews" || r.source === "manual_reviews";
  const cards = buildPopupCards(previewSettings, { storeName, product: usesReviews ? sampleProduct : null, products: products.map((x) => ({ id: x.id, name: x.title })) }, !(r.source === "real" || r.source === "both") ? [] : [{ name: "Exemplo", city: "Cidade", product_id: null, product: products[0]?.title ?? "Produto", image: null, paid_at: new Date().toISOString() }], { ignoreScope: true });
  const card = cards.length ? cards[preview % cards.length]! : null;

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[12px] font-bold">
        <input type="checkbox" checked={r.enabled} onChange={(e) => up({ enabled: e.target.checked })} />
        Ativar popup: {r.enabled ? "Ativado" : "Desativado"}
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        {sel("Fonte das notificações", "source", [["manual", "Manual"], ["reviews", "Avaliações do produto"], ["real", "Compras reais"], ["manual_reviews", "Manual + Avaliações"], ["both", "Manual + Compras reais"]])}
        {sel("Posição", "position", [["bottom-left", "Inferior esquerdo"], ["bottom-right", "Inferior direito"], ["top-left", "Superior esquerdo"], ["top-right", "Superior direito"]])}
        {sel("Ordem", "order", [["sequence", "Ordem cadastrada"], ["random", "Aleatória"]])}
        {numField("Primeira notificação após", "delay", 10)}
        {numField("Tempo visível", "visible", 5)}
        {numField("Intervalo entre notificações", "interval", 30)}
        {sel("Animação", "animation", [["slide-fade", "Slide + fade"], ["fade", "Somente fade"], ["slide", "Slide"], ["none", "Nenhuma"]])}
        <label className="flex items-center gap-2 self-end rounded-lg border border-border px-3 py-2.5 text-[12px] font-semibold">
          <input type="checkbox" checked={r.show_close} onChange={(e) => up({ show_close: e.target.checked })} /> Mostrar botão X
        </label>
      </div>

      {usesReviews && (
        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 text-[11.5px] font-bold">Avaliações do produto (usa só as avaliações visíveis do produto aberto, sem inventar dados)</p>
          <p className="mb-2 text-[11px] text-muted-foreground">Variáveis: {"{nome} {produto} {nota} {avaliacao} {cidade} {estado} {data}"}. Variável vazia some sem deixar pontuação solta.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block"><span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Título</span><input value={p.review_title ?? ""} placeholder="{nome}" onChange={(e) => up({ review_title: e.target.value })} className={input} /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Modelo para avaliações</span><input value={p.review_message ?? ""} placeholder="{avaliacao}" onChange={(e) => up({ review_message: e.target.value })} className={input} /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Texto secundário</span><input value={p.review_secondary ?? "Avaliou {produto}"} onChange={(e) => up({ review_secondary: e.target.value })} className={input} /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Máximo de caracteres</span><input type="number" min={20} max={300} value={p.review_max_chars ?? 100} onChange={(e) => up({ review_max_chars: e.target.value === "" ? undefined : Number(e.target.value) })} className={input} /></label>
            {([["review_show_location", "Mostrar localização"], ["review_use_order_location", "Usar localização do pedido quando disponível"], ["review_confirmed_only", "Usar somente avaliações com Compra confirmada"]] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-2 self-end rounded-lg border border-border px-3 py-2.5 text-[12px] font-semibold"><input type="checkbox" checked={!!p[k]} onChange={(e) => up({ [k]: e.target.checked })} />{l}</label>
            ))}
          </div>
        </div>
      )}

      {(r.source === "real" || r.source === "both") && (
        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 text-[11.5px] font-bold">Compras reais (só pedidos pagos desta loja; mostra primeiro nome e cidade)</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block"><span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Título</span><input value={p.real_title ?? ""} placeholder="{nome} — {cidade}" onChange={(e) => up({ real_title: e.target.value })} className={input} /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Mensagem</span><input value={p.real_message ?? ""} placeholder="comprou {produto}" onChange={(e) => up({ real_message: e.target.value })} className={input} /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Selo (vazio = sem selo)</span><input value={p.real_badge ?? "Verificado"} onChange={(e) => up({ real_badge: e.target.value })} className={input} /></label>
          </div>
        </div>
      )}

      {(r.source === "manual" || r.source === "both" || r.source === "manual_reviews") && (
        <>
          <p className="text-[11px] text-muted-foreground">Variáveis: {"{produto} {loja} {preco} {cidade} {nome}"}. Todos os campos são opcionais. Em notificações manuais, use mensagens informativas — não diga que alguém comprou sem um pedido real.</p>
          {items.map((it, i) => {
            const scope = it.scope ?? "all";
            const warn = PURCHASE_WORDS.test(`${it.title ?? ""} ${it.message ?? ""}`);
            return (
              <div key={it.id} className="space-y-3 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="mr-auto text-[12px] font-extrabold uppercase">Notificação {i + 1}</p>
                  <label className="flex items-center gap-1.5 text-[11.5px] font-semibold"><input type="checkbox" checked={it.active !== false} onChange={(e) => upItem(i, { active: e.target.checked })} />{it.active !== false ? "Ativa" : "Desativada"}</label>
                  <Button type="button" size="icon" variant="outline" className="size-8" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
                  <Button type="button" size="icon" variant="outline" className="size-8" disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
                  <Button type="button" size="icon" variant="ghost" className="size-8" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 /></Button>
                </div>
                <div className="flex items-center gap-3">
                  {it.image ? <img src={it.image} alt="" className="size-12 rounded-full border border-border object-cover" /> : <div className="grid size-12 place-items-center rounded-full bg-surface text-[9px] text-muted-foreground">Sem foto</div>}
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-input px-3 py-2 text-[11px] font-bold"><ImagePlus size={14} />{it.image ? "Substituir" : "Enviar foto"}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const url = await onUpload(f); if (url) upItem(i, { image: url }); }} /></label>
                  {it.image && <Button type="button" size="sm" variant="ghost" onClick={() => upItem(i, { image: null })}><Trash2 />Remover</Button>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(["name", "location", "title", "secondary"] as const).map((k) => (
                    <label key={k} className="block"><span className="mb-1 block text-[11px] font-semibold text-muted-foreground">{{ name: "Nome", location: "Localização", title: "Título", secondary: "Texto secundário" }[k]}</span>
                      <input value={it[k] ?? ""} onChange={(e) => upItem(i, { [k]: e.target.value })} className={input} /></label>
                  ))}
                </div>
                <label className="block"><span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Mensagem</span>
                  <textarea rows={2} value={it.message ?? ""} onChange={(e) => upItem(i, { message: e.target.value })} className="w-full rounded-lg border border-input bg-card px-3 py-2 text-[13px] outline-none focus:border-primary" /></label>
                {warn && <p className="rounded-md bg-surface px-2 py-1.5 text-[11px] font-semibold text-destructive">Atenção: este texto fala em compra. Use somente se corresponder a um pedido real; para compras reais, prefira a fonte "Compras reais".</p>}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block"><span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Produto relacionado ({"{produto}"})</span>
                    <select value={it.product_id ?? ""} disabled={it.use_current_product} onChange={(e) => upItem(i, { product_id: e.target.value || null, product_name: products.find((x) => x.id === e.target.value)?.title ?? "" })} className={input}>
                      <option value="">Nenhum</option>{products.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
                  <label className="flex items-center gap-2 self-end rounded-lg border border-border px-3 py-2.5 text-[12px] font-semibold"><input type="checkbox" checked={!!it.use_current_product} onChange={(e) => upItem(i, { use_current_product: e.target.checked })} />Usar automaticamente o produto atual</label>
                  <label className="block"><span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Exibir em</span>
                    <select value={scope} onChange={(e) => upItem(i, { scope: e.target.value as "all", product_ids: e.target.value === "one" ? (it.product_ids ?? []).slice(0, 1) : (it.product_ids ?? []) })} className={input}>
                      <option value="all">Todos os produtos</option><option value="selected">Produtos selecionados</option><option value="one">Somente um produto</option></select></label>
                </div>
                {scope !== "all" && (
                  <div className="flex flex-wrap gap-2">
                    {products.map((x) => {
                      const on = (it.product_ids ?? []).includes(x.id);
                      return <label key={x.id} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-semibold ${on ? "border-primary text-primary" : "border-border"}`}>
                        <input type={scope === "one" ? "radio" : "checkbox"} name={`scope-${it.id}`} checked={on} onChange={() => upItem(i, { product_ids: scope === "one" ? [x.id] : on ? (it.product_ids ?? []).filter((v) => v !== x.id) : [...(it.product_ids ?? []), x.id] })} />{x.title}</label>;
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <Button type="button" variant="outline" onClick={() => setItems([...items, { id: crypto.randomUUID(), active: true, scope: "all" }])}><Plus />Adicionar notificação</Button>
        </>
      )}

      <div className="rounded-lg border border-border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={() => { setPreviewOn(true); setPreview((v) => v + (previewOn ? 1 : 0)); }}><Eye />{previewOn ? "Próxima notificação" : "Visualizar popup"}</Button>
          {previewOn && <Button type="button" size="sm" variant="ghost" onClick={() => setPreviewOn(false)}>Fechar prévia</Button>}
        </div>
        {previewOn && (
          <div className="mx-auto mt-3 h-[420px] w-[260px] overflow-hidden rounded-[28px] border-[6px] border-foreground bg-surface">
            <div className="relative h-full w-full">
              <div className="space-y-2 p-3"><div className="aspect-square rounded-lg bg-muted" /><div className="h-3 w-2/3 rounded bg-muted" /><div className="h-3 w-1/2 rounded bg-muted" /></div>
              <div className="absolute inset-x-0 bottom-0 h-11 bg-primary/80" />
              {card ? (
                <div className={`absolute ${r.position.startsWith("bottom") ? "bottom-14" : "top-3"} ${r.position.endsWith("left") ? "left-2" : "right-2"} origin-center scale-[0.85]`}>
                  <PopupCardView card={card} shown settings={r} onClose={() => setPreviewOn(false)} className="w-[250px]" />
                </div>
              ) : <p className="absolute inset-x-3 top-1/2 text-center text-[11px] text-muted-foreground">Nenhuma notificação ativa para mostrar.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
