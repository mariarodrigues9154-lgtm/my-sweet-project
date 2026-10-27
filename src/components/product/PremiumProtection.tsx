import { useId, useState } from "react";
import { ChevronRight, Headset, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { protectionBenefitKeys, type ResolvedCustomerProtection } from "@/lib/customer-protection";

function BenefitIcon({ index }: { index: number }) {
  const props = { className: "size-7", strokeWidth: 1.9, "aria-hidden": true as const };
  if (index === 0) return <svg {...props} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 10-6 10 6-10 6L3 9Zm0 0v14l10 6V15m10-6v7M8 6l10 6"/><path d="m25 20-4 4 4 4m-4-4h6a4 4 0 0 1 0 8" transform="translate(0 -3)"/></svg>;
  if (index === 1) return <LockKeyhole {...props} />;
  if (index === 2) return <svg {...props} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m15 3 11 5v8m-11 14C5 26 4 22 4 16V8l11-5Z"/><path d="M18 12c-1-2-6-2-6 1 0 3 6 1 6 5 0 3-5 3-7 1m4-10v14"/><circle cx="26" cy="25" r="5"/><path d="M26 22v3l2 1"/></svg>;
  if (index === 3) return <svg className="size-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>;
  if (index === 4) return <svg {...props} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="7" width="21" height="18" rx="2"/><path d="m10 9 10 7 9-7M2 12h3M1 20h4"/></svg>;
  return <Headset {...props} />;
}

export function PremiumProtection({ config }: { config: ResolvedCustomerProtection }) {
  const [open, setOpen] = useState(true);
  const id = useId();
  const expanded = !config.collapsible || open;
  const header = <>
    <span className="protection-emblem grid size-12 shrink-0 place-items-center rounded-full text-protection-check">
      <ShieldCheck className="protection-emblem-icon size-8" strokeWidth={2.4} aria-hidden="true" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="protection-title block break-words text-[18px] font-extrabold leading-tight text-protection-foreground">{config.title}</span>
      <span className="protection-subtitle mt-1 block break-words text-[13px] font-medium leading-snug text-muted-foreground">{config.subtitle}</span>
    </span>
    {config.collapsible && <ChevronRight className={`protection-chevron !size-5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none ${expanded ? "" : "rotate-90"}`} aria-hidden="true" />}
  </>;
  return (
    <div className="premium-protection rounded-2xl border border-border bg-card p-3 shadow-card-soft sm:rounded-[20px] sm:p-4">
      {config.collapsible ? <Button type="button" variant="ghost" aria-expanded={expanded} aria-controls={id} onClick={() => setOpen((v) => !v)} className="protection-header grid h-auto w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center justify-start gap-3 whitespace-normal p-0 text-left hover:bg-transparent">{header}</Button> : <div className="protection-header grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">{header}</div>}
      {expanded && <ul id={id} className="protection-benefits mt-4 grid gap-x-4 gap-y-4 border-t border-border pt-4">
        {protectionBenefitKeys.map((key, index) => <li key={key} className="protection-benefit flex min-w-0 items-center gap-3">
          <span className="protection-benefit-icon grid size-11 shrink-0 place-items-center rounded-[14px] bg-protection-soft text-protection-icon"><BenefitIcon index={index} /></span>
          <span className="protection-benefit-text min-w-0 break-words text-[13px] font-semibold leading-snug text-protection-foreground">{config[key]}</span>
        </li>)}
      </ul>}
    </div>
  );
}