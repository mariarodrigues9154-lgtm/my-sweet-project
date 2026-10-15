import { useStoreCountdown } from "@/lib/store-countdown";
import { CouponChip } from "./CouponPromo";
import { ChevronRight, Ticket, Zap } from "lucide-react";

import { brl, clock } from "@/lib/format";
import { discountPercent, promoBadges, savings, variantPriceRange, type Product } from "@/lib/product-types";

/** Cronômetro isolado: lê a duração única da loja e o prazo salvo, só este texto atualiza. */
export function Countdown({ store }: { store?: { id?: string | null; checkout?: unknown } | null | undefined }) {
  return <>{clock(useStoreCountdown(store))}</>;
}

export function OfferBlock({ product, store }: { product: Product; store?: { id?: string | null; checkout?: unknown } | null | undefined }) {
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
        className="flex min-h-[62px] items-center justify-between gap-3 px-3.5 py-2 text-primary-foreground sm:min-h-[66px] sm:gap-4 sm:px-5"
        style={{ backgroundImage: "var(--gradient-flash)" }}
      >
        <div className="min-w-0">
          {varies && (
            <p className="mb-[3px] text-[11px] font-medium leading-none text-primary-foreground/85">
              A partir de
            </p>
          )}
          <div className="flex items-baseline gap-1.5 whitespace-nowrap">
            {discount > 0 && (
              <span className="self-center rounded-md bg-primary-foreground px-1.5 py-0.5 text-[13px] font-bold leading-[18px] text-primary">
                -{discount}%
              </span>
            )}
            <span className="text-[14px] font-bold leading-none">R$</span>
            <span className="-ml-0.5 font-display text-[25px] font-extrabold leading-none tnum sm:text-[27px]">
              {int}
              <span className="text-[15px] sm:text-[16px]">,{cents}</span>
            </span>
          </div>
          {product.previous_price > min && (
            <p className="mt-0.5 text-[12.5px] leading-tight text-primary-foreground/70 line-through tnum">
              {brl(product.previous_price)}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right leading-tight">
          <p className="inline-flex items-center gap-1.5 text-[13.5px] font-bold sm:text-[14px]">
            <Zap size={15} className="shrink-0 fill-current" />
            {product.offer.flash_label ?? "Oferta Relâmpago"}
          </p>
          <p className="mt-0.5 whitespace-nowrap text-[12.5px] sm:text-[13px]">
            Termina em{" "}
            <strong className="text-[13.5px] font-bold tnum sm:text-[14px]">
              <Countdown store={store} />
            </strong>
          </p>
        </div>
      </div>


      <CouponChip store={store} />

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
