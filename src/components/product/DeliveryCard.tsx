import { useEffect, useState } from "react";
import { ChevronRight, Truck } from "lucide-react";
import { CustomerProtection } from "./CustomerProtection";
import type { CustomerProtectionSettings } from "@/lib/customer-protection";

import { brl } from "@/lib/format";
import { SHIPPING, getEstimatedDeliveryRange } from "@/lib/shipping";
import type { Product } from "@/lib/product-types";

export function DeliveryCard({ product, protectionSettings }: { product: Product; protectionSettings?: CustomerProtectionSettings }) {
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

      <CustomerProtection protection={protection} settings={protectionSettings} />
    </section>
  );
}
