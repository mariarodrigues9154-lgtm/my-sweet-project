import { imageSrcSet, sizedImage } from "@/lib/media-url";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, Volume2, VolumeX } from "lucide-react";

import type { Media } from "@/lib/product-types";

export function Gallery({ media, title }: { media: Media[]; title: string }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const items = media.length ? media : [];

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const onScroll = () => {
      const i = Math.round(rail.scrollLeft / Math.max(1, rail.clientWidth));
      setIndex(Math.min(items.length - 1, Math.max(0, i)));
    };
    rail.addEventListener("scroll", onScroll, { passive: true });
    return () => rail.removeEventListener("scroll", onScroll);
  }, [items.length]);

  const goTo = (i: number) => {
    const rail = railRef.current;
    if (!rail) return;
    const next = Math.min(items.length - 1, Math.max(0, i));
    rail.scrollTo({ left: next * rail.clientWidth, behavior: "smooth" });
    setIndex(next);
  };

  if (!items.length) {
    return <div className="aspect-square w-full bg-surface-strong" />;
  }

  return (
    <div className="relative bg-card">
      <div ref={railRef} className="no-scrollbar snap-row flex w-full overflow-x-auto overscroll-x-contain">
        {items.map((m, i) => (
          <div key={`${m.url}-${i}`} className="w-full shrink-0 snap-center">
            {m.type === "video" ? (
              <GalleryVideo media={m} active={i === index} />
            ) : (
              <img
                src={sizedImage(m.url, 720)}
                srcSet={imageSrcSet(m.url)}
                sizes="(min-width: 520px) 520px, 100vw"
                alt={m.alt ?? `${title} — imagem ${i + 1}`}
                width={1024}
                height={1024}
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "low"}
                decoding={i === 0 ? "sync" : "async"}
                className="aspect-square w-full object-cover"
              />
            )}
          </div>
        ))}
      </div>

      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="Imagem anterior"
            className="absolute left-2 top-1/2 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-card/85 text-foreground shadow-card-soft transition-opacity hover:bg-card sm:grid"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="Próxima imagem"
            className="absolute right-2 top-1/2 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-card/85 text-foreground shadow-card-soft transition-opacity hover:bg-card sm:grid"
          >
            <ChevronRight size={18} />
          </button>

          <div className="pointer-events-none absolute inset-x-0 bottom-2.5 flex items-center justify-center gap-1.5">
            {items.map((_, i) => (
              <span
                key={i}
                className={
                  i === index
                    ? "h-1.5 w-4 rounded-full bg-foreground/85"
                    : "size-1.5 rounded-full bg-foreground/25"
                }
              />
            ))}
          </div>

          <span className="absolute bottom-2 right-2.5 rounded-full bg-foreground/55 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-background">
            {index + 1}/{items.length}
          </span>
        </>
      )}
    </div>
  );
}

function GalleryVideo({ media, active }: { media: Media; active: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!active) {
      el.pause();
      setPlaying(false);
    }
  }, [active]);

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="relative aspect-square w-full bg-foreground/90">
      <video
        ref={ref}
        src={media.url}
        poster={media.poster ?? undefined}
        muted={muted}
        playsInline
        loop
        preload="none"
        onClick={toggle}
        className="size-full object-cover"
      />
      <span className="absolute left-2.5 top-2.5 rounded-full bg-foreground/60 px-2 py-0.5 text-[10px] font-bold tracking-wide text-background">
        VÍDEO
      </span>
      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        className="absolute right-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-foreground/60 px-2.5 py-1 text-[11px] font-semibold text-background"
      >
        {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
        {muted ? "Toque para ouvir" : "Som ligado"}
      </button>
      {!playing && (
        <button
          type="button"
          onClick={toggle}
          aria-label="Reproduzir vídeo"
          className="absolute inset-0 grid place-items-center"
        >
          <span className="grid size-14 place-items-center rounded-full bg-card/90 text-foreground shadow-card-soft">
            <Play size={22} className="translate-x-[1px] fill-current" />
          </span>
        </button>
      )}
    </div>
  );
}
