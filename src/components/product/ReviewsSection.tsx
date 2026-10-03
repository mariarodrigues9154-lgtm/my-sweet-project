import { useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";

import { Stars } from "@/components/store/Stars";
import { intBR } from "@/lib/format";
import { ratingDot, reviewsPageSize, reviewsSectionHeader, type Product } from "@/lib/product-types";

export function ReviewsSection({ product }: { product: Product }) {
  const PAGE = reviewsPageSize(product);
  const [count, setCount] = useState(PAGE);
  const [photo, setPhoto] = useState<string | null>(null);
  const reviews = (product.reviews ?? []).filter((r) => !r.hidden);
  if (!reviews.length) return null;
  const head = reviewsSectionHeader(product);
  const shown = reviews.slice(0, count);
  const more = () => setCount((c) => c + PAGE);

  return (
    <section className="mt-2 bg-card px-4 py-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h2 className="min-w-0 truncate text-[15px] font-bold">
          {head.title} <span className="font-normal text-muted-foreground">({intBR(head.count)})</span>
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
                <img src={r.avatar} alt={r.name} loading="lazy" className="size-8 shrink-0 rounded-full object-cover" />
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
            {(r.photos ?? []).length > 0 && (
              <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-0.5">
                {(r.photos ?? []).map((p) => (
                  <button key={p} type="button" onClick={() => setPhoto(p)} className="shrink-0">
                    <img
                      src={p}
                      alt={`Foto enviada por ${r.name}`}
                      loading="lazy"
                      decoding="async"
                      className="size-24 rounded-lg object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      {reviews.length > count && (
        <button type="button" onClick={more} className="mt-1 w-full rounded-full border border-border py-2 text-[12.5px] font-semibold text-muted-foreground">
          Ver mais avaliações ({reviews.length - count})
        </button>
      )}
      {photo && (
        <div role="dialog" aria-modal="true" onClick={() => setPhoto(null)} className="fixed inset-0 z-50 grid place-items-center bg-foreground/80 p-4">
          <img src={photo} alt="Foto da avaliação" onClick={(e) => e.stopPropagation()} className="max-h-[88vh] max-w-[92vw] rounded-2xl object-contain" />
          <button type="button" onClick={() => setPhoto(null)} aria-label="Fechar foto" className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-foreground/60 text-background">
            <X size={20} />
          </button>
        </div>
      )}
    </section>
  );
}
