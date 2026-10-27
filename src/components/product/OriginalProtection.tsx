import { Check, ChevronRight, ShieldCheck } from "lucide-react";
import type { Product } from "@/lib/product-types";

/** Legacy presentation: product-owned texts and markup remain independent. */
export function OriginalProtection({ protection }: { protection: Product["protection"] }) {
  return (
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
  );
}