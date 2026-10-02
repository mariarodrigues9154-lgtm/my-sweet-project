import { Bookmark, Palette, Star } from "lucide-react";

import { intBR } from "@/lib/format";
import { ratingDot, shownRating, shownReviews, shownSold, type Product } from "@/lib/product-types";

export function ProductHeadline({ product }: { product: Product }) {
  const firstVariant = product.variants[0];
  const reviews = shownReviews(product);
  const sold = shownSold(product);

  return (
    <section className="bg-card px-3 pt-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <h1 className="min-w-0 text-[15.5px] font-semibold leading-[1.35] tracking-[-0.01em]">
          {product.title}
        </h1>
        <button
          type="button"
          aria-label="Salvar produto"
          className="mt-1 grid size-7 shrink-0 place-items-center text-muted-foreground"
        >
          <Bookmark size={18} strokeWidth={1.6} />
        </button>
      </div>

      <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <Star size={15} className="shrink-0 fill-star text-star" />
        <span className="font-bold text-star tnum">{ratingDot(shownRating(product))}</span>
        <span className="font-medium">{intBR(reviews.count)} {reviews.label}</span>
        <span aria-hidden className="text-[10px]">•</span>
        <span className="font-medium">{intBR(sold.count)} {sold.label}</span>
      </div>


      {product.stock > 0 && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-primary/15 bg-primary-soft px-2 py-1 text-[12px] font-semibold uppercase text-primary">
          <span className="size-1.5 rounded-full bg-primary" />
          Apenas {intBR(product.stock)} unidades disponíveis
        </div>
      )}

      {firstVariant && (
        <p className="mt-2 flex items-start gap-2 border-b border-border py-2.5 text-[12.5px] leading-[1.625] text-muted-foreground">
          <Palette size={14} className="mt-[2px] shrink-0" />
          <span>
            Escolha {firstVariant.label.toLowerCase().replace("selecione ", "")} da sua{" "}
            <strong className="font-semibold text-foreground">{product.name}</strong> ao clicar em{" "}
            <strong className="font-semibold text-foreground">Comprar Agora</strong>.
          </span>
        </p>
      )}
    </section>
  );
}
