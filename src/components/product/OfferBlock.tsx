import { useStoreCountdown, type CountdownProduct } from "@/lib/store-countdown";
import { CouponChip } from "./CouponPromo";
import { ChevronRight, Ticket, Zap } from "lucide-react";

import { brl, clock } from "@/lib/format";
import { discountPercent, promoBadges, savings, variantPriceRange, type Product } from "@/lib/product-types";

/** Ícone oficial do WhatsApp (lucide não tem marcas). */
function WhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" className="shrink-0">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

/** Cronômetro isolado: lê a duração única da loja e o prazo salvo, só este texto atualiza. */
export function Countdown({ store, product }: { store?: { id?: string | null; checkout?: unknown } | null | undefined; product?: CountdownProduct }) {
  return <>{clock(useStoreCountdown(store, product))}</>;
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
              <Countdown store={store} product={product} />
            </strong>
          </p>
        </div>
      </div>


      <CouponChip product={product} />

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

      {(badges.badge1 || badges.badge2 || badges.wa) && (
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
          {badges.wa &&
            (badges.wa.href ? (
              <a
                href={badges.wa.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-whatsapp px-2.5 py-1 text-[14px] font-semibold leading-5 text-whatsapp-foreground"
              >
                <WhatsAppIcon size={14} />
                {badges.wa.text}
              </a>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-whatsapp px-2.5 py-1 text-[14px] font-semibold leading-5 text-whatsapp-foreground">
                <WhatsAppIcon size={14} />
                {badges.wa.text}
              </span>
            ))}
        </div>
      )}
    </section>
  );
}
