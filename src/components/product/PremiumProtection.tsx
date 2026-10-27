import { useId, useState } from "react";
import { ChevronRight, Headset, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { protectionBenefitKeys, type ResolvedCustomerProtection } from "@/lib/customer-protection";

function BenefitIcon({ index }: { index: number }) {
  const props = { className: "size-7", strokeWidth: 1.9, "aria-hidden": true as const };
  if (index === 0) return <svg {...props} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 10-6 10 6-10 6L3 9Zm0 0v14l10 6V15m10-6v7M8 6l10 6"/><path d="m25 20-4 4 4 4m-4-4h6a4 4 0 0 1 0 8" transform="translate(0 -3)"/></svg>;
  if (index === 1) return <LockKeyhole {...props} />;
  if (index === 2) return <svg {...props} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m15 3 11 5v8m-11 14C5 26 4 22 4 16V8l11-5Z"/><path d="M18 12c-1-2-6-2-6 1 0 3 6 1 6 5 0 3-5 3-7 1m4-10v14"/><circle cx="26" cy="25" r="5"/><path d="M26 22v3l2 1"/></svg>;
  if (index === 3) return <svg {...props} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M28 15.5A12 12 0 0 1 10 26L3 28l2-7A12 12 0 1 1 28 15.5Z"/><path d="M11 9c-2 0-2 3-1 5 2 4 5 7 9 8 2 1 5-1 4-3l-4-2-2 2c-3-1-5-3-6-6l2-1-2-3Z" fill="currentColor" strokeWidth="0.7"/></svg>;
  if (index === 4) return <svg {...props} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="7" width="21" height="18" rx="2"/><path d="m10 9 10 7 9-7M2 12h3M1 20h4"/></svg>;
  return <Headset {...props} />;
}

export function PremiumProtection({ config }: { config: ResolvedCustomerProtection }) {
  const [open, setOpen] = useState(true);
  const id = useId();
  const expanded = !config.collapsible || open;
  const header = <>
    <span className="protection-emblem grid size-12 shrink-0 place-items-center rounded-full text-protection-check">
      <ShieldCheck className="!size-8" strokeWidth={2} aria-hidden="true" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block break-words text-[18px] font-extrabold leading-tight text-protection-foreground">{config.title}</span>
      <span className="mt-1 block break-words text-[13px] font-medium leading-snug text-muted-foreground">{config.subtitle}</span>
    </span>
    {config.collapsible && <ChevronRight className={`!size-5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none ${expanded ? "" : "rotate-90"}`} aria-hidden="true" />}
  </>;
  return (
    <div className="premium-protection rounded-[20px] border border-border bg-card p-3 shadow-card-soft sm:p-4">
      {config.collapsible ? <Button type="button" variant="ghost" aria-expanded={expanded} aria-controls={id} onClick={() => setOpen((v) => !v)} className="h-auto w-full justify-start gap-3 whitespace-normal p-0 text-left hover:bg-transparent">{header}</Button> : <div className="flex items-center gap-3">{header}</div>}
      {expanded && <ul id={id} className="protection-benefits mt-4 grid gap-x-4 gap-y-4 border-t border-border pt-4">
        {protectionBenefitKeys.map((key, index) => <li key={key} className="protection-benefit flex min-w-0 items-center gap-3">
          <span className="protection-benefit-icon grid size-11 shrink-0 place-items-center rounded-[14px] bg-protection-soft text-protection-icon"><BenefitIcon index={index} /></span>
          <span className="protection-benefit-text min-w-0 break-words text-[13px] font-semibold leading-snug text-protection-foreground">{config[key]}</span>
        </li>)}
      </ul>}
    </div>
  );
}