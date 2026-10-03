import { useEffect, useState } from "react";
import { Check, ChevronRight, ShieldCheck, Truck } from "lucide-react";

import { brl } from "@/lib/format";
import { SHIPPING, getEstimatedDeliveryRange } from "@/lib/shipping";
import type { Product } from "@/lib/product-types";

export function DeliveryCard({ product }: { product: Product }) {
  const { protection } = product;
  const [open, setOpen] = useState(false);
  // Data calculada só no navegador para não divergir entre servidor e cliente.
  const [range, setRange] = useState<ReturnType<typeof getEstimatedDeliveryRange> | null>(null);
  useEffect(() => setRange(getEstimatedDeliveryRange()), []);

  return (
    <section className="bg-card px-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-3 text-left"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Truck size={17} className="shrink-0 text-foreground/80" />
            <span className="shrink-0 rounded bg-success-soft px-1.5 py-[1px] text-[13px] font-semibold text-success">
              Frete grátis
            </span>
            <span className="min-w-0 truncate text-[13px] text-foreground/90">
              Chegará entre {range?.compact ?? "…"}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Taxa de envio: <span className="line-through tnum">{brl(SHIPPING.originalPrice)}</span>
          </p>
        </div>
        <ChevronRight
          size={17}
          className={`shrink-0 text-foreground/70 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open && (
        <div className="-mt-1 mb-3 flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2.5 text-[12.5px]">
          <span className="min-w-0 text-muted-foreground">
            <strong className="block font-semibold uppercase text-foreground">{SHIPPING.name}</strong>
            <span className="block text-[12px]">Chegará entre {range?.compact ?? "…"}</span>
          </span>
          <span className="shrink-0 tnum">
            <span className="mr-1.5 text-[11.5px] text-muted-foreground line-through">{brl(SHIPPING.originalPrice)}</span>
            <strong className="font-semibold text-success">Grátis</strong>
          </span>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface/40 px-3 py-3 shadow-card-soft">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-success text-success-foreground">
            <ShieldCheck size={15} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-bold leading-tight">{protection.title ?? "Proteção do cliente"}</p>
            <p className="truncate text-[11.5px] text-muted-foreground">
              {protection.subtitle ?? "Compra 100% garantida do início ao fim"}
            </p>
          </div>
          <ChevronRight size={16} className="shrink-0 text-foreground/70" />
        </div>
        {(protection.items ?? []).length > 0 && (
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {(protection.items ?? []).map((item) => (
              <li key={item} className="flex items-start gap-1.5 text-[12.5px] leading-snug text-foreground/85">
                <Check size={12} strokeWidth={2.5} className="mt-[3px] shrink-0 text-success" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
