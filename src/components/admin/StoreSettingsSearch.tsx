import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ProductEditor } from "./ProductManager";
import { directSettingResult, normalizeSettingsQuery, searchSettings, settingsCatalog, type SettingsDestination } from "@/lib/admin-settings-search";

function findDestination(root: ParentNode, result: SettingsDestination) {
  const section = Array.from(root.querySelectorAll<HTMLElement>("[data-settings-section]")).find((element) => normalizeSettingsQuery(element.dataset.settingsSection ?? "") === normalizeSettingsQuery(result.section));
  if (!section) return null;
  const label = normalizeSettingsQuery(result.label);
  const target = Array.from(section.querySelectorAll<HTMLElement>("label, h3, h4, p, button, [aria-label], input[placeholder], textarea[placeholder]")).find((element) => {
    const text = normalizeSettingsQuery(element.getAttribute("aria-label") || element.getAttribute("placeholder") || element.textContent || "");
    return (text === label || text.startsWith(`${label} `)) && element.getClientRects().length > 0;
  });
  return target ?? section;
}

export function StoreSettingsSearch({ products, onProductSaved }: { products: { id: string; title: string }[]; onProductSaved: () => Promise<unknown> }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [destination, setDestination] = useState<SettingsDestination | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const base = useMemo(() => settingsCatalog(products), [products]);
  const results = useMemo(() => searchSettings(base, query), [base, query]);

  useEffect(() => {
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !boxRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);

  useEffect(() => {
    if (!destination) return;
    setBusy(true);
    const started = Date.now();
    let highlight: HTMLElement | null = null;
    let clearTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setInterval(() => {
      const root = destination.productId ? document.querySelector('[data-settings-product-editor]') : boxRef.current?.closest("main");
      const target = root ? findDestination(root, destination) : null;
      if (!target) {
        if (Date.now() - started > 15000) { clearInterval(timer); setBusy(false); toast.error("Não foi possível abrir a configuração. Tente novamente."); }
        return;
      }
      clearInterval(timer);
      for (let parent: HTMLElement | null = target; parent; parent = parent.parentElement) if (parent instanceof HTMLDetailsElement) parent.open = true;
      target.classList.add("settings-search-highlight");
      highlight = target;
      target.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      target.setAttribute("tabindex", "-1"); target.focus({ preventScroll: true });
      setBusy(false);
      clearTimer = setTimeout(() => { target.classList.remove("settings-search-highlight"); target.removeAttribute("tabindex"); }, 3500);
    }, 120);
    return () => { clearInterval(timer); clearTimeout(clearTimer); highlight?.classList.remove("settings-search-highlight"); highlight?.removeAttribute("tabindex"); };
  }, [destination]);

  function navigate(result: SettingsDestination) {
    setOpen(false); setEditing(result.productId ?? null); setDestination({ ...result });
    if (result.area === "payments") window.dispatchEvent(new CustomEvent("settings-search-payment", { detail: result.label }));
  }

  return <div ref={boxRef} className="relative mt-4">
    <div className="relative flex items-center">
      {busy ? <Loader2 className="pointer-events-none absolute left-3 size-4 animate-spin text-primary" /> : <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />}
      <input ref={inputRef} role="combobox" aria-label="Pesquisar funções e configurações desta loja" aria-expanded={open && !!query.trim()} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        placeholder="Pesquisar funções e configurações desta loja..." value={query}
        onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") { setOpen(false); return; }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); const index = event.key === "ArrowDown" ? Math.min(results.length - 1, active + 1) : Math.max(0, active - 1); setActive(index); document.getElementById(`${listId}-${index}`)?.scrollIntoView({ block: "nearest" }); }
          if (event.key === "Enter") { event.preventDefault(); const result = active >= 0 ? results[active] : directSettingResult(results, query); if (result) navigate(result); else setOpen(true); }
        }} className="h-11 w-full min-w-0 rounded-lg border border-input bg-background pl-10 pr-10 text-[12px] outline-none focus:border-primary focus:ring-1 focus:ring-ring sm:text-[13px]" />
      {query && <Button type="button" variant="ghost" size="icon" aria-label="Limpar pesquisa de configurações" title="Limpar pesquisa" className="absolute right-1 size-8" onClick={() => { setQuery(""); setActive(-1); setOpen(false); inputRef.current?.focus(); }}><X /></Button>}
    </div>
    {open && query.trim() && <div className="absolute inset-x-0 top-full z-40 mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-card-soft" id={listId} role="listbox" aria-label="Configurações encontradas">
      {!results.length && <p role="status" className="px-3 py-4 text-[12px] text-muted-foreground">Nenhuma configuração encontrada.</p>}
      {results.map((result, index) => <Button type="button" variant="ghost" role="option" aria-selected={index === active} id={`${listId}-${index}`} key={result.id} onClick={() => navigate(result)} className={`h-auto min-h-12 w-full justify-between whitespace-normal px-3 py-2 text-left ${active === index ? "bg-muted" : ""}`}>
        <span className="min-w-0 break-words"><span className="block text-[12.5px] font-semibold">{result.label}</span><span className="block text-[11px] font-normal text-muted-foreground">{result.productName ? `Produto: ${result.productName} · ` : "Loja · "}{result.section}</span></span><ArrowRight className="shrink-0 text-muted-foreground" />
      </Button>)}
    </div>}
    <Sheet open={!!editing} onOpenChange={(value) => { if (!value) { setEditing(null); setDestination(null); setBusy(false); } }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[560px]"><SheetHeader><SheetTitle>Editar produto</SheetTitle></SheetHeader>
        {editing && <ProductEditor key={editing} id={editing} onSaved={async () => { await onProductSaved(); setEditing(null); setDestination(null); }} />}
      </SheetContent>
    </Sheet>
  </div>;
}