import { normalizeBold, type EconomyBannerSettings } from "@/lib/economy-banner";

export function EconomyBannerText({ text, settings }: { text: string; settings?: EconomyBannerSettings }) {
  const ranges = settings?.mode === "manual" ? normalizeBold(settings.bold ?? [], text.length) : [];
  const parts: { text: string; bold: boolean; start: number }[] = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start > cursor) parts.push({ text: text.slice(cursor, r.start), bold: false, start: cursor });
    parts.push({ text: text.slice(r.start, r.end), bold: true, start: r.start });
    cursor = r.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), bold: false, start: cursor });
  const allPulse = settings?.pulse === true && settings.pulse_target === "all";
  const formatted = settings?.mode === "manual" && settings.bold !== undefined;
  return (
    <span className={`min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${formatted ? "font-normal" : "font-semibold"} ${allPulse ? "economy-pulse" : ""}`}>
      {parts.map(part => part.bold ? (
        <strong key={part.start} className={`font-bold ${settings?.pulse && !allPulse ? "inline-block economy-pulse" : ""}`}>{part.text}</strong>
      ) : <span key={part.start}>{part.text}</span>)}
    </span>
  );
}