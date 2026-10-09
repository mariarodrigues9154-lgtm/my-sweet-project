import { imageSrcSet, sizedImage } from "@/lib/media-url";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, ChevronRight, Play, Video, X } from "lucide-react";

import { Stars } from "@/components/store/Stars";
import type { CreatorVideo, ProductSections } from "@/lib/product-types";

const at = (h: string) => (h.startsWith("@") ? h : `@${h}`);
const nota = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

export function CreatorVideos({ videos, sections }: { videos: CreatorVideo[]; sections: ProductSections }) {
  const [active, setActive] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  const list = videos.slice(0, 7);
  const current = active !== null ? list[active] : undefined;
  const style = sections.videos_card_style === "below" ? "below" : "overlay";

  const title = sections.videos_title?.trim() || "Vídeos de criadores";
  const count = sections.videos_count?.trim() || String(list.length);
  const showCount = sections.videos_show_count !== false;
  const showMore = sections.videos_show_more === true;
  const moreText = sections.videos_more_text?.trim() || "Ver mais";
  const subtitle = sections.videos_subtitle?.trim() || "Criadores que compraram mostrando o produto funcionando";
  const showIcon = sections.videos_show_icon === true;
  const showHint = sections.videos_show_hint === true;
  const hintText = sections.videos_hint_text?.trim() || "arraste";

  useEffect(() => {
    if (active === null && !all) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (active !== null) setActive(null);
      else setAll(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [active, all]);

  if (!list.length) return null;

  return (
    <section className="mt-2 bg-card px-3 py-3">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-[15px] font-bold">
          {title} {showCount && <span className="font-normal text-muted-foreground">({count})</span>}
        </h2>
        {showMore && (
          <button type="button" onClick={() => setAll(true)} className="flex shrink-0 items-center text-[12.5px] text-muted-foreground">
            {moreText} <ChevronRight size={15} />
          </button>
        )}
      </div>
      <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted-foreground">
          {showIcon && <Video size={15} className="shrink-0 text-foreground" />}
          <span className={`truncate ${showIcon ? "font-semibold text-foreground" : ""}`}>{subtitle}</span>
        </p>
        {showHint && (
          <span className="flex shrink-0 items-center gap-1 text-[11.5px] text-muted-foreground">
            {hintText} <ArrowRight size={12} />
          </span>
        )}
      </div>

      <div className="no-scrollbar snap-row -mx-3 mt-2.5 flex gap-2 overflow-x-auto overscroll-x-contain px-3 pb-1">
        {list.map((v, i) =>
          style === "below" ? (
            <BelowCard key={`${v.handle}-${i}`} video={v} onPlay={() => v.video && setActive(i)} />
          ) : (
            <CreatorCard key={`${v.handle}-${i}`} video={v} onPlay={() => v.video && setActive(i)} />
          ),
        )}
      </div>

      {all && active === null && createPortal(
        <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 overflow-y-auto bg-card animate-in fade-in">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-3 py-3">
            <h3 className="truncate text-[15px] font-bold">{title}</h3>
            <button type="button" onClick={() => setAll(false)} aria-label="Fechar" className="grid size-8 place-items-center rounded-full bg-surface">
              <X size={18} />
            </button>
          </div>
          <div className="mx-auto grid max-w-[520px] grid-cols-2 gap-2 p-3">
            {list.map((v, i) => (
              <BelowCard key={`all-${i}`} video={v} grid onPlay={() => v.video && setActive(i)} />
            ))}
          </div>
        </div>
      )}

      {current?.video && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Vídeo de ${current.handle}`}
          onClick={() => setActive(null)}
          className="fixed inset-0 z-[60] grid place-items-center bg-foreground/80 p-4 animate-in fade-in"
        >
          <div onClick={(e) => e.stopPropagation()} className="relative">
            <video
              key={current.video}
              src={current.video}
              poster={current.thumb || undefined}
              controls
              autoPlay
              playsInline
              preload="auto"
              onError={() => console.warn("[videos] falha ao reproduzir vídeo do criador")}
              className="block max-h-[88vh] w-auto max-w-[min(92vw,420px)] aspect-[9/16] rounded-2xl bg-foreground object-contain"
            />
            <button
              type="button"
              onClick={() => setActive(null)}
              aria-label="Fechar vídeo"
              className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-foreground/60 text-background backdrop-blur-sm"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Prévia do vídeo: capa se houver, senão um quadro do próprio vídeo quando o cartão chega perto da tela. */
function Preview({ video }: { video: CreatorVideo }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [near, setNear] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === "undefined") return setNear(true);
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setNear(true);
        io.disconnect();
      }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  const useThumb = video.thumb && !thumbFailed;
  return (
    <span ref={ref} className="absolute inset-0 block">
      {useThumb ? (
        <img src={sizedImage(video.thumb, 480)} alt={video.title || `Vídeo de ${video.handle}`} loading="lazy" decoding="async" onError={() => setThumbFailed(true)} className="size-full object-cover" />
      ) : video.video && near && !previewFailed ? (
        <video src={`${video.video}#t=0.5`} preload="metadata" muted playsInline onError={() => setPreviewFailed(true)} className="pointer-events-none size-full object-cover" />
      ) : null}
    </span>
  );
}

function PlayIcon({ size = 32 }: { size?: number }) {
  return (
    <span className="absolute inset-0 grid place-items-center">
      <span className="grid place-items-center rounded-full bg-background/85 text-foreground shadow-sm" style={{ width: size, height: size }}>
        <Play size={size * 0.42} className="translate-x-[1px] fill-current" />
      </span>
    </span>
  );
}

function Avatar({ video, size }: { video: CreatorVideo; size: number }) {
  const [failed, setFailed] = useState(false);
  if (video.show_avatar === false || !video.avatar || failed) return null;
  return (
    <img
      src={sizedImage(video.avatar, 240)}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full border border-background/70 object-cover"
    />
  );
}

function CreatorCard({ video, onPlay }: { video: CreatorVideo; onPlay: () => void }) {
  const showHandle = video.show_handle !== false && video.handle;
  const showTitle = video.show_title !== false && video.title;
  const showName = video.show_name === true && video.name;
  const showStars = video.show_stars === true && video.rating;
  const showAvatar = video.show_avatar !== false && video.avatar;

  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={`Assistir vídeo de ${video.handle || video.name || "criador"}`}
      className="relative aspect-[9/16] w-[calc((100%-18px)/4.2)] min-w-[78px] max-w-[112px] shrink-0 snap-start overflow-hidden rounded-xl bg-surface-strong text-left"
    >
      <Preview video={video} />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-foreground/80 to-transparent" />
      <PlayIcon />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 block p-1.5 text-background">
        {showStars && <Stars rating={Number(video.rating)} size={9} />}
        {showTitle && <span className="line-clamp-2 text-[10.5px] font-bold leading-tight">{video.title}</span>}
        {(showName || showHandle || showAvatar) && (
          <span className="mt-0.5 flex min-w-0 items-center gap-1">
            {showAvatar && <Avatar video={video} size={16} />}
            <span className="min-w-0">
              {showName && (
                <span className="flex items-center gap-0.5 truncate text-[9.5px] font-semibold">
                  <span className="truncate">{video.name}</span>
                  {video.verified && <Check size={9} strokeWidth={3} className="shrink-0 text-success" />}
                </span>
              )}
              {showHandle && <span className="block truncate text-[9.5px] opacity-85">{at(video.handle)}</span>}
            </span>
          </span>
        )}
      </span>
    </button>
  );
}

function BelowCard({ video, onPlay, grid = false }: { video: CreatorVideo; onPlay: () => void; grid?: boolean }) {
  const showHandle = video.show_handle !== false && video.handle;
  const showTitle = video.show_title !== false && video.title;
  const showName = video.show_name === true && video.name;
  const showStars = video.show_stars === true && video.rating;
  const showNumber = video.show_rating_number === true && video.rating;
  const showDesc = video.show_description === true && video.description;
  const [open, setOpen] = useState(false);

  return (
    <div className={grid ? "min-w-0" : "w-[40%] min-w-[132px] max-w-[176px] shrink-0 snap-start"}>
      <button
        type="button"
        onClick={onPlay}
        aria-label={`Assistir vídeo de ${video.handle || video.name || "criador"}`}
        className="relative block aspect-[9/16] w-full overflow-hidden rounded-xl bg-surface-strong"
      >
        <Preview video={video} />
        <PlayIcon size={38} />
      </button>
      <div className="mt-1.5 min-w-0 px-0.5">
        {(showName || video.avatar) && (
          <div className="flex min-w-0 items-center gap-1.5">
            <Avatar video={video} size={20} />
            {showName && <span className="truncate text-[13px] font-semibold">{video.name}</span>}
            {showName && video.verified && <Check size={13} strokeWidth={3} className="shrink-0 text-success" aria-label="Verificado" />}
          </div>
        )}
        {showHandle && <p className="truncate text-[11.5px] text-muted-foreground">{at(video.handle)}</p>}
        {(showStars || showNumber) && (
          <div className="mt-0.5 flex items-center gap-1">
            {showNumber && <span className="text-[11.5px] font-semibold">{nota(Number(video.rating))} <span className="font-normal text-muted-foreground">/ 5</span></span>}
            {showStars && <Stars rating={Number(video.rating)} size={11} />}
          </div>
        )}
        {showTitle && <p className="mt-0.5 line-clamp-2 text-[12px] font-medium leading-snug">{video.title}</p>}
        {showDesc && (
          <button type="button" onClick={() => setOpen((o) => !o)} className="mt-0.5 block text-left">
            <span className={`text-[11.5px] leading-snug text-muted-foreground ${open ? "" : "line-clamp-2"}`}>{video.description}</span>
          </button>
        )}
      </div>
    </div>
  );
}
