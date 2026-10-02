import { useEffect, useState } from "react";
import { ChevronRight, Ticket, Zap } from "lucide-react";

import { brl, clock } from "@/lib/format";
import { discountPercent, promoBadges, savings, variantPriceRange, type Product } from "@/lib/product-types";

export function useCountdown(seconds: number) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    if (seconds <= 0) return;
    const id = window.setInterval(() => {
      setLeft((v) => (v <= 1 ? seconds : v - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [seconds]);
  return left;
}

/** Cronômetro isolado: só este texto atualiza a cada segundo, não a página inteira. */
export function Countdown({ seconds }: { seconds: number }) {
  return <>{clock(useCountdown(seconds))}</>;
}

export function OfferBlock({ product }: { product: Product }) {
  const range = variantPriceRange(product);
  const min = range.min;
  const varies = range.multiple;

  const discount = discountPercent(min, product.previous_price);
  const economy = savings(product.price, product.previous_price);
  const badges = promoBadges(product);
  const [int, cents] = brl(min).replace(/^R\$\s?/, "").split(",");

  return (
    <section>
      <div
        className="flex min-h-[46px] items-center justify-between gap-2 px-3 py-1.5 text-primary-foreground"
        style={{ backgroundImage: "var(--gradient-flash)" }}
      >
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5 whitespace-nowrap">
            {discount > 0 && (
              <span className="self-center rounded-[5px] bg-primary-foreground px-1 py-px text-[12px] font-bold leading-4 text-primary">
                -{discount}%
              </span>
            )}
            {varies && <span className="text-[13px] font-medium">A partir de</span>}
            <span className="text-[13px] font-semibold">R$</span>
            <span className="-ml-1 font-display text-[21px] font-bold leading-none tnum">
              {int}
              <span className="text-[14px]">,{cents}</span>
            </span>
          </div>
          {product.previous_price > min && (
            <p className="mt-0.5 text-[12px] leading-tight text-primary-foreground/70 line-through tnum">
              {brl(product.previous_price)}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right leading-tight">
          <p className="inline-flex items-center gap-1 text-[13px] font-bold">
            <Zap size={14} className="fill-current" />
            {product.offer.flash_label ?? "Oferta Relâmpago"}
          </p>
          <p className="mt-0.5 whitespace-nowrap text-[12.5px]">
            Termina em <strong className="font-bold tnum"><Countdown seconds={product.offer.countdown_seconds ?? 600} /></strong>
          </p>
        </div>
      </div>


      {economy > 0 && (
        <div className="bg-card px-3 pt-3">
          <div className="flex h-10 items-center justify-between rounded-2xl border border-primary/45 bg-card px-3.5">
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-primary">
              <Ticket size={15} />
              Economize {brl(economy)}
            </span>
            <ChevronRight size={16} className="text-primary/80" />
          </div>
        </div>
      )}

      {(badges.badge1 || badges.badge2) && (
        <div className="flex items-center gap-2 bg-card px-3 pt-2.5">
          {badges.badge1 && (
            <span className="min-w-0 truncate rounded-md border border-border px-2 py-[3px] text-[14px] font-semibold uppercase leading-5 text-foreground/75">
              {badges.badge1}
            </span>
          )}
          {badges.badge2 && (
            <span className="today-pulse inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 text-[14px] font-semibold uppercase leading-5 text-primary-foreground">
              <span className="today-dot size-[5px] rounded-full bg-primary-foreground" />
              {badges.badge2}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
