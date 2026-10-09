import { sizedImage } from "@/lib/media-url";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight, Play, X } from "lucide-react";

import { Stars } from "@/components/store/Stars";
import { compactBR } from "@/lib/format";
import { ratingDot, reviewsPageSize, reviewsSectionHeader, type Product } from "@/lib/product-types";

export function ReviewsSection({ product }: { product: Product }) {
  const PAGE = reviewsPageSize(product);
  const [count, setCount] = useState(PAGE);
  const [viewer, setViewer] = useState<{ items: ViewerItem[]; index: number } | null>(null);
  const reviews = (product.reviews ?? []).filter((r) => !r.hidden);
  if (!reviews.length) return null;
  const head = reviewsSectionHeader(product);
  const shown = reviews.slice(0, count);
  const more = () => setCount((c) => c + PAGE);

  return (
    <section className="mt-2 bg-card px-4 py-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h2 className="min-w-0 truncate text-[15px] font-bold">
          {head.title} <span className="font-normal text-muted-foreground">({compactBR(head.count)})</span>
        </h2>
        {reviews.length > count && (
          <button type="button" onClick={more} className="inline-flex shrink-0 items-center gap-0.5 text-[12.5px] font-medium text-muted-foreground">
            Ver mais <ChevronRight size={14} />
          </button>
        )}
      </div>

      <div className="mt-1 flex items-center gap-2">
        <span className="text-[13px] font-bold tnum">{ratingDot(head.rating)}</span>
        <span className="text-[12.5px] text-muted-foreground">/ {head.max}</span>
        <Stars rating={head.rating} size={16} />
      </div>

      <ul className="mt-3 divide-y divide-border">
        {shown.map((r, i) => (
          <li key={`${r.name}-${i}`} className="py-3 first:pt-0">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5">
              {r.avatar ? (
                <img src={sizedImage(r.avatar, 240)} alt={r.name} loading="lazy" className="size-8 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-strong text-[12px] font-bold text-muted-foreground">
                  {r.name.slice(0, 1)}
                </span>
              )}
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="truncate text-[13.5px] font-medium">{r.name}</span>
                  {r.confirmed && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded border border-success/40 bg-success-soft px-1 text-[10px] font-semibold text-success">
                      <Check size={10} strokeWidth={3} /> Compra confirmada
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <Stars rating={r.rating} size={14} />
                  <span className="text-[11.5px] text-muted-foreground">{r.date}</span>
                </div>
              </div>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-foreground/90">{r.text}</p>
            {((r.photos ?? []).length > 0 || (r.videos ?? []).length > 0) && (() => {
              const items: ViewerItem[] = [...(r.photos ?? []).map((url) => ({ type: "image" as const, url })), ...(r.videos ?? []).map((url) => ({ type: "video" as const, url }))];
              const open = (index: number) => setViewer({ items, index });
              const nPhotos = (r.photos ?? []).length;
              return (
              <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-0.5">
                {(r.photos ?? []).map((p, pi) => (
                  <button key={p} type="button" onClick={() => open(pi)} aria-label={`Ampliar foto de ${r.name}`} className="shrink-0">
                    <img
                      src={sizedImage(p, 240)}
                      alt={`Foto enviada por ${r.name}`}
                      loading="lazy"
                      decoding="async"
                      className="pointer-events-none size-24 rounded-lg object-cover"
                    />
                  </button>
                ))}
                {(r.videos ?? []).map((v, vi) => (
                  <button key={v} type="button" onClick={() => open(nPhotos + vi)} aria-label={`Assistir vídeo de ${r.name}`} className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-foreground">
                    <video src={`${v}#t=0.1`} preload="none" muted playsInline className="pointer-events-none size-full object-cover" />
                    <span className="absolute inset-0 grid place-items-center">
                      <span className="grid size-9 place-items-center rounded-full bg-foreground/60 text-background"><Play size={18} fill="currentColor" /></span>
                    </span>
                  </button>
                ))}
              </div>
              );
            })()}
          </li>
        ))}
      </ul>
      {reviews.length > count && (
        <button type="button" onClick={more} className="mt-1 w-full rounded-full border border-border py-2 text-[12.5px] font-semibold text-muted-foreground">
          Ver mais avaliações ({reviews.length - count})
        </button>
      )}
      {viewer && typeof document !== "undefined" && createPortal(
        <MediaViewer items={viewer.items} start={viewer.index} onClose={() => setViewer(null)} />,
        document.body,
      )}
    </section>
  );
}

type ViewerItem = { type: "image" | "video"; url: string };

/** Visualizador em tela cheia (portal no body: fica acima de tudo, sem ser cortado pela página). */
function MediaViewer({ items, start, onClose }: { items: ViewerItem[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const item = items[i];
  const go = (d: number) => setI((n) => (n + d + items.length) % items.length);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!item) return null;
  return (
    <div role="dialog" aria-modal="true" onClick={onClose} className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-foreground/90 p-3">
      <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-[520px] items-center justify-center">
        {item.type === "image" ? (
          <img key={item.url} src={sizedImage(item.url, 1080)} alt={`Mídia ${i + 1} de ${items.length}`} className="block max-h-[80vh] max-w-full rounded-2xl object-contain" />
        ) : (
          <video key={item.url} src={item.url} controls autoPlay playsInline preload="auto" className="block h-auto max-h-[80vh] w-full rounded-2xl bg-foreground object-contain" />
        )}
      </div>
      {items.length > 1 && (
        <div onClick={(e) => e.stopPropagation()} className="mt-3 flex items-center gap-4 text-background">
          <button type="button" onClick={() => go(-1)} aria-label="Anterior" className="grid size-10 place-items-center rounded-full bg-background/15"><ChevronLeft size={22} /></button>
          <span className="text-[13px] font-semibold tabular-nums">{i + 1} de {items.length}</span>
          <button type="button" onClick={() => go(1)} aria-label="Próxima" className="grid size-10 place-items-center rounded-full bg-background/15"><ChevronRight size={22} /></button>
        </div>
      )}
      <button type="button" onClick={onClose} aria-label="Fechar" className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-background/15 text-background">
        <X size={22} />
      </button>
    </div>
  );
}
