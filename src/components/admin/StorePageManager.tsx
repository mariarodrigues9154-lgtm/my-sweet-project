import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronUp, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { uploadProductImage } from "@/lib/admin.functions";
import { parseRatingInput, type StoreSettings } from "@/lib/product-types";

type ProductChoice = { id: string; title: string; active: boolean };

export type StoreDraft = StoreSettings & { active: boolean; is_default?: boolean };

export function StorePageManager({ store, products, onSave }: { store: StoreDraft; products: ProductChoice[]; onSave: (value: StoreDraft) => Promise<boolean> }) {
  const [draft, setDraft] = useState(store);
  const [saving, setSaving] = useState(false);
  const upload = useServerFn(uploadProductImage);
  const set = <K extends keyof StoreDraft>(key: K, value: StoreDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  async function uploadImage(key: "logo_url" | "footer_logo_url" | "favicon_url" | "avatar_url" | "cover_url" | "banner_url" | "checkout_logo", file?: File) {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/x-icon", "image/vnd.microsoft.icon"] as const;
    if (!allowed.includes(file.type as (typeof allowed)[number])) { toast.error("Use JPG, PNG, WEBP, GIF ou ICO."); return; }
    const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1] ?? ""); reader.onerror = reject; reader.readAsDataURL(file); });
    const result = await upload({ data: { filename: file.name, contentType: file.type as (typeof allowed)[number], base64 } });
    if (!result.ok) { toast.error(result.error); return; }
    if (key === "checkout_logo") set("checkout", { ...draft.checkout, logo_url: result.url });
    else set(key, result.url);
  }

  function toggleFeatured(id: string) {
    set("featured_product_ids", draft.featured_product_ids.includes(id) ? draft.featured_product_ids.filter((item) => item !== id) : [...draft.featured_product_ids, id]);
  }
  function move(id: string, direction: -1 | 1) {
    const items = [...draft.featured_product_ids]; const from = items.indexOf(id); const to = from + direction;
    if (from < 0 || to < 0 || to >= items.length) return;
    [items[from], items[to]] = [items[to] as string, items[from] as string]; set("featured_product_ids", items);
  }

  return <section className="rounded-xl bg-card p-4 shadow-card-soft">
    <h2 className="text-[15px] font-extrabold">{draft.name || "Loja"}</h2>
    <p className="mt-1 text-[11.5px] text-muted-foreground">Endereço público: {draft.is_default ? "/loja" : `/loja/${draft.slug}`}</p>

    <Group title="Endereço e status">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Endereço (ex.: minha-loja)" value={draft.slug} onChange={(value) => set("slug", value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} />
        <Toggle label={draft.active ? "Loja ativa (visível)" : "Loja inativa (oculta)"} checked={draft.active} onChange={(value) => set("active", value)} />
      </div>
    </Group>

    <Group title="Identidade e botões">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Nome da loja" value={draft.name} onChange={(value) => set("name", value)} />
        <Field label="Descrição curta" value={draft.tagline ?? ""} onChange={(value) => set("tagline", value || null)} />
        <Field label="Quantidade de vendidos" type="number" value={String(draft.sold_count)} onChange={(value) => set("sold_count", Math.max(0, Number(value) || 0))} />
        <Field label="E-mail de suporte" value={draft.support_email ?? ""} onChange={(value) => set("support_email", value || null)} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Toggle label={draft.verified ? "Selo de loja verificada: Ativado" : "Selo de loja verificada: Desativado"} checked={draft.verified} onChange={(value) => set("verified", value)} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <ImageField label="Logo da Loja (círculo ao lado do nome)" url={draft.avatar_url} round onUpload={(file) => void uploadImage("avatar_url", file)} onRemove={() => set("avatar_url", null)} />
      </div>
    </Group>

    <Group title="Ações da Loja">
      <div className="space-y-3">
        <div><p className="mb-1.5 text-[12px] font-bold">Visitar</p><div className="grid grid-cols-2 gap-2">
          <Toggle label={`Exibir: ${draft.show_visit !== false ? "Ativado" : "Desativado"}`} checked={draft.show_visit !== false} onChange={(value) => set("show_visit", value)} />
          <Toggle label={`Clicável: ${draft.visit_clickable !== false ? "Ativado" : "Desativado"}`} checked={draft.visit_clickable !== false} onChange={(value) => set("visit_clickable", value)} />
        </div></div>
        <div><p className="mb-1.5 text-[12px] font-bold">Seguir</p><Toggle label={`Exibir: ${draft.show_follow ? "Ativado" : "Desativado"}`} checked={draft.show_follow} onChange={(value) => set("show_follow", value)} /></div>
        <div><p className="mb-1.5 text-[12px] font-bold">Mensagem</p><Toggle label={`Exibir: ${draft.show_message ? "Ativado" : "Desativado"}`} checked={draft.show_message} onChange={(value) => set("show_message", value)} /></div>
      </div>
    </Group>

    <Group title="Logos">
      <p className="mb-2 text-[11.5px] text-muted-foreground">Tamanho recomendado: 300 x 80 px (PNG transparente ou WebP). A logo do cabeçalho também aparece no checkout; a do rodapé aparece só no rodapé.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {([ ["logo_url", "Logo do Cabeçalho"], ["footer_logo_url", "Logo do Rodapé"] ] as const).map(([key, label]) => <ImageField key={key} label={label} url={draft[key]} dark={key === "footer_logo_url"} onUpload={(file) => void uploadImage(key, file)} onRemove={() => set(key, null)} />)}
      </div>
    </Group>

    <Group title="Favicon da Loja">
      <p className="mb-2 text-[11.5px] text-muted-foreground">Ícone que aparece na aba do navegador nas páginas desta loja (loja, produto e checkout). Use uma imagem quadrada, de preferência 64 x 64 px (PNG, JPG, WEBP ou ICO). Sem favicon, aparece o ícone padrão do site.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <p className="text-[11px] font-semibold text-muted-foreground">Favicon</p>
          <div className="mt-2 flex items-center gap-3 rounded-lg bg-surface p-3">
            {draft.favicon_url ? <img src={draft.favicon_url} alt="Favicon" className="size-8 rounded object-contain" /> : <img src="/favicon.png" alt="Favicon padrão" className="size-8 rounded object-contain opacity-60" />}
            <span className="text-[11px] text-muted-foreground">{draft.favicon_url ? "Favicon próprio" : "Usando o favicon padrão"}</span>
          </div>
          <div className="mt-2 flex gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-input px-3 py-2 text-[11px] font-bold"><ImagePlus size={14} />{draft.favicon_url ? "Substituir favicon" : "Enviar favicon"}<input type="file" accept="image/png,image/jpeg,image/webp,image/x-icon,image/vnd.microsoft.icon,.ico" className="hidden" onChange={(event) => { const f = event.target.files?.[0]; event.target.value = ""; if (f && !f.type && f.name.toLowerCase().endsWith(".ico")) { void uploadImage("favicon_url", new File([f], f.name, { type: "image/x-icon" })); } else void uploadImage("favicon_url", f); }} /></label>
            {draft.favicon_url && <Button type="button" size="sm" variant="ghost" onClick={() => set("favicon_url", null)}><Trash2 />Remover favicon</Button>}
          </div>
        </div>
      </div>
    </Group>

    <Group title="Imagens e banners">
      <div className="grid gap-3 sm:grid-cols-2">
        {([ ["cover_url", "Capa da loja"], ["banner_url", "Banner principal"] ] as const).map(([key, label]) => <ImageField key={key} label={label} url={draft[key]} onUpload={(file) => void uploadImage(key, file)} onRemove={() => set(key, null)} />)}
      </div>
      <div className="mt-3"><Field label="URL de destino do banner" value={draft.banner_link ?? ""} onChange={(value) => set("banner_link", value || null)} /></div>
    </Group>

    <Group title="Indicadores">
      <div className="grid gap-2 sm:grid-cols-3">{draft.indicators.slice(0, 3).map((item, index) => <div key={index} className="rounded-lg border border-border p-3"><Field label={`Valor ${index + 1}`} value={item.value} onChange={(value) => { const next = [...draft.indicators]; next[index] = { ...item, value }; set("indicators", next); }} /><div className="mt-2"><Field label="Legenda" value={item.label} onChange={(value) => { const next = [...draft.indicators]; next[index] = { ...item, label: value }; set("indicators", next); }} /></div></div>)}</div>
    </Group>

    <Group title="Mais vendidos da loja">
      <div className="space-y-2">{products.filter((p) => p.active).map((product) => { const selected = draft.featured_product_ids.includes(product.id); const position = draft.featured_product_ids.indexOf(product.id); return <div key={product.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border px-3 py-2"><input type="checkbox" checked={selected} onChange={() => toggleFeatured(product.id)} /><span className="truncate text-[12px] font-semibold">{product.title}</span>{selected && <div className="flex"><Button type="button" size="icon" variant="ghost" aria-label="Subir produto" onClick={() => move(product.id, -1)} disabled={position === 0}><ChevronUp /></Button><Button type="button" size="icon" variant="ghost" aria-label="Descer produto" onClick={() => move(product.id, 1)} disabled={position === draft.featured_product_ids.length - 1}><ChevronDown /></Button></div>}</div>; })}</div>
    </Group>

    <Group title="Checkout">
      <p className="mb-2 text-[11.5px] text-muted-foreground">Sem logo própria, o checkout usa a logo do cabeçalho. O selo azul é controlado por "Selo de loja verificada" em Identidade.</p>
      <label className="mb-3 block">
        <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Modelo de Checkout</span>
        <select
          value={draft.checkout?.checkout_model ?? "v1"}
          onChange={(event) => set("checkout", { ...draft.checkout, checkout_model: event.target.value as "v1" | "v2" })}
          className="h-11 w-full rounded-lg border border-input bg-card px-3 text-[13px] font-semibold outline-none focus:border-primary"
        >
          <option value="v1">Checkout 1 — Atual</option>
          <option value="v2">Checkout 2 — Novo</option>
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <ImageField label="Logo do checkout" url={draft.checkout?.logo_url ?? null} onUpload={(file) => void uploadImage("checkout_logo", file)} onRemove={() => set("checkout", { ...draft.checkout, logo_url: null })} />
        <div className="space-y-2">
          <label className="block"><span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Cor principal (botões)</span>
            <div className="flex items-center gap-2"><input type="color" value={draft.checkout?.primary_color || "#fe2c55"} onChange={(event) => set("checkout", { ...draft.checkout, primary_color: event.target.value })} className="h-10 w-14 rounded border border-input" />
            <Button type="button" size="sm" variant="ghost" onClick={() => set("checkout", { ...draft.checkout, primary_color: "" })}>Usar padrão</Button></div>
          </label>
          <Field label="Título da etapa (padrão: Pagamento)" value={draft.checkout?.title ?? ""} onChange={(value) => set("checkout", { ...draft.checkout, title: value })} />
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Nome exibido no Checkout (vazio = nome da loja)" value={draft.checkout?.display_name ?? ""} onChange={(value) => set("checkout", { ...draft.checkout, display_name: value })} />
        <Toggle label={`Exibir nome da loja: ${draft.checkout?.show_name !== false ? "Ativado" : "Desativado"}`} checked={draft.checkout?.show_name !== false} onChange={(value) => set("checkout", { ...draft.checkout, show_name: value })} />
        <Field label={`Título do bloco de desconto (vazio = Desconto da ${draft.name})`} value={draft.checkout?.discount_title ?? ""} onChange={(value) => set("checkout", { ...draft.checkout, discount_title: value })} />
        <Toggle label={`Exibir bloco de desconto: ${draft.checkout?.show_discount !== false ? "Ativado" : "Desativado"}`} checked={draft.checkout?.show_discount !== false} onChange={(value) => set("checkout", { ...draft.checkout, show_discount: value })} />
      </div>
      <div className="mt-3">
        <TextArea label='Texto legal do Checkout (vazio = texto padrão). As expressões "Termos de Uso" e "Política de Privacidade" viram links para as políticas desta loja.' value={draft.checkout?.legal_text ?? ""} onChange={(value) => set("checkout", { ...draft.checkout, legal_text: value })} />
        <div className="mt-2"><Toggle label={`Exibir texto legal: ${draft.checkout?.show_legal !== false ? "Ativado" : "Desativado"}`} checked={draft.checkout?.show_legal !== false} onChange={(value) => set("checkout", { ...draft.checkout, show_legal: value })} /></div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Toggle label={`Exibir avaliação no topo: ${draft.checkout?.show_rating !== false ? "Ativado" : "Desativado"}`} checked={draft.checkout?.show_rating !== false} onChange={(value) => set("checkout", { ...draft.checkout, show_rating: value })} />
        <Toggle label={`Usar a nota do produto: ${draft.checkout?.rating_from_product !== false ? "Sim" : "Não"}`} checked={draft.checkout?.rating_from_product !== false} onChange={(value) => set("checkout", { ...draft.checkout, rating_from_product: value })} />
        <Field label="Texto antes da nota (padrão: Ótima avaliação!)" value={draft.checkout?.rating_text ?? ""} onChange={(value) => set("checkout", { ...draft.checkout, rating_text: value })} />
        <Field label="Nota exibida no checkout (ex.: 4,8)" value={draft.checkout?.rating_value != null ? String(draft.checkout.rating_value).replace(".", ",") : ""} onChange={(value) => set("checkout", { ...draft.checkout, rating_value: value.trim() ? parseRatingInput(value) : null })} />
        <Field label="Nota máxima exibida (padrão: 5,0)" value={draft.checkout?.rating_max ?? ""} onChange={(value) => set("checkout", { ...draft.checkout, rating_max: value })} />
      </div>
    </Group>

    <Group title="Termos exibidos na página do produto">
      {(() => {
        const t = draft.checkout?.product_terms ?? {};
        const on = t.enabled !== false;
        const setT = (patch: Partial<NonNullable<typeof t>>) => set("checkout", { ...draft.checkout, product_terms: { ...t, ...patch } });
        return (
          <div className="space-y-3">
            <Toggle label={`Exibir bloco de termos: ${on ? "Ativado" : "Desativado"}`} checked={on} onChange={(value) => setT({ enabled: value })} />
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground">Título da seção</span>
              <input value={t.title ?? ""} maxLength={80} placeholder="TERMOS" onChange={(e) => setT({ title: e.target.value })} className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-[13px] outline-none focus:border-primary" />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold text-muted-foreground">Texto (vazio = usa o texto já cadastrado em cada produto)</span>
              <textarea rows={6} maxLength={5000} value={t.text ?? ""} onChange={(e) => setT({ text: e.target.value })} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-primary" />
            </label>
          </div>
        );
      })()}
    </Group>

    <Group title="PIX pendente / Recuperação de pagamento">
      {(() => {
        const p = draft.checkout?.pix_recovery ?? {};
        const on = p.enabled !== false;
        const setP = (patch: Partial<NonNullable<typeof p>>) => set("checkout", { ...draft.checkout, pix_recovery: { ...p, ...patch } });
        const flag = (k: "show_notice" | "allow_copy" | "allow_chat" | "show_badge", label: string) => (
          <Toggle label={`${label}: ${on && p[k] !== false ? "Ativado" : "Desativado"}`} checked={p[k] !== false} onChange={(value) => setP({ [k]: value })} />
        );
        return (
          <div className="space-y-3">
            <Toggle label={`Ativar recuperação de PIX pendente: ${on ? "Ativado" : "Desativado"}`} checked={on} onChange={(value) => setP({ enabled: value })} />
            <div className={`grid gap-3 sm:grid-cols-2 ${on ? "" : "pointer-events-none opacity-50"}`}>
              {flag("show_notice", "Mostrar aviso de pagamento pendente")}
              {flag("allow_copy", "Permitir copiar PIX pelo aviso")}
              {flag("allow_chat", "Permitir recuperar PIX pelo chat")}
              {flag("show_badge", "Mostrar indicador de mensagem")}
              <Field label="Título do aviso" value={p.title ?? ""} onChange={(value) => setP({ title: value })} />
              <Field label="Texto do botão de copiar" value={p.copy_label ?? ""} onChange={(value) => setP({ copy_label: value })} />
              <Field label="Texto do botão do chat" value={p.chat_label ?? ""} onChange={(value) => setP({ chat_label: value })} />
            </div>
            <p className="text-[11.5px] text-muted-foreground">Desligar só esconde o aviso na loja. Pedidos e PIX continuam salvos.</p>
          </div>
        );
      })()}
    </Group>



    <Group title="Rodapé e políticas">
      <div className="mb-3"><Toggle label={draft.show_footer !== false ? "Exibir rodapé: Ativado" : "Exibir rodapé: Desativado"} checked={draft.show_footer !== false} onChange={(value) => set("show_footer", value)} /></div>
      {draft.show_footer === false && <p className="mb-2 text-[11px] text-muted-foreground">O rodapé não aparece nas páginas desta loja. Os textos, logo e políticas continuam salvos.</p>}
      <TextArea label="Texto do rodapé" value={draft.footer_text ?? ""} onChange={(value) => set("footer_text", value || null)} />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {([ ["privacy", "Política de Privacidade"], ["refund", "Política de Reembolso"], ["terms", "Termos de Uso"], ["shipping", "Política de Entrega"] ] as const).map(([key, label]) => <TextArea key={key} label={label} value={draft.policies[key]} onChange={(value) => set("policies", { ...draft.policies, [key]: value })} />)}
      </div>
    </Group>

    <Group title="Atendimento por IA e suporte">
      {(() => { const ai = draft.ai_support ?? {}; const up = (patch: Partial<NonNullable<StoreSettings["ai_support"]>>) => set("ai_support", { ...ai, ...patch }); return <>
        <p className="mb-2 text-[11px] text-muted-foreground">A IA das perguntas usa só estas informações e as do produto. Escreva apenas fatos verdadeiros.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle label="Entregamos para todo o Brasil" checked={!!ai.ships_brazil} onChange={(v) => up({ ships_brazil: v })} />
          <Toggle label="Encaminhar para suporte humano" checked={!!ai.forward_enabled} onChange={(v) => up({ forward_enabled: v })} />
          <Toggle label="WhatsApp" checked={!!ai.whatsapp_enabled} onChange={(v) => up({ whatsapp_enabled: v })} />
          <Toggle label="Ligações" checked={!!ai.phone_enabled} onChange={(v) => up({ phone_enabled: v })} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Número do suporte (+55 DDD número)" value={ai.support_phone ?? ""} onChange={(v) => up({ support_phone: v })} />
          <Field label="Mensagem padrão do WhatsApp ({produto} = nome)" value={ai.whatsapp_message ?? ""} onChange={(v) => up({ whatsapp_message: v })} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <TextArea label="Texto de garantia" value={ai.warranty_text ?? ""} onChange={(v) => up({ warranty_text: v })} />
          <TextArea label="Informações da loja" value={ai.store_info ?? ""} onChange={(v) => up({ store_info: v })} />
          <TextArea label="Informações adicionais para a IA" value={ai.extra_info ?? ""} onChange={(v) => up({ extra_info: v })} />
        </div>
      </>; })()}
    </Group>

    <Button className="mt-4 rounded-full px-6 font-extrabold" disabled={saving} onClick={async () => { setSaving(true); const ok = await onSave(draft); setSaving(false); if (ok) toast.success("Loja salva."); }}>{saving ? "Salvando..." : "Salvar loja"}</Button>
  </section>;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) { return <div className="mt-5 border-t border-border pt-4"><h3 className="mb-3 text-[12px] font-extrabold uppercase text-muted-foreground">{title}</h3>{children}</div>; }
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="block min-w-0"><span className="mb-1 block text-[11px] font-semibold text-muted-foreground">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-[13px] outline-none focus:border-primary" /></label>; }
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className="mb-1 block text-[11px] font-semibold text-muted-foreground">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} rows={5} className="w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-[12px] outline-none focus:border-primary" /></label>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[11.5px] font-semibold"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>; }
function ImageField({ label, url, onUpload, onRemove, dark, round }: { label: string; url: string | null; dark?: boolean; round?: boolean; onUpload: (file?: File) => void; onRemove: () => void }) { return <div className="rounded-lg border border-border p-3"><p className="text-[11px] font-semibold text-muted-foreground">{label}</p>{url ? (round ? <div className="mt-2 grid aspect-[2/1] place-items-center rounded-lg bg-surface"><img src={url} alt={label} className="size-20 rounded-full border border-border bg-card object-cover" /></div> : <img src={url} alt={label} className={`mt-2 aspect-[2/1] w-full rounded-lg object-contain p-2 ${dark ? "bg-footer" : "bg-surface"}`} />) : <div className="mt-2 grid aspect-[2/1] place-items-center rounded-lg bg-surface text-[11px] text-muted-foreground">Sem imagem</div>}<div className="mt-2 flex gap-2"><label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-input px-3 py-2 text-[11px] font-bold"><ImagePlus size={14} />{url ? "Substituir" : "Enviar"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => onUpload(event.target.files?.[0])} /></label>{url && <Button type="button" size="sm" variant="ghost" onClick={onRemove}><Trash2 />Remover</Button>}</div></div>; }