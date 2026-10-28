import { forwardRef, useEffect, useImperativeHandle, useRef, type VideoHTMLAttributes } from "react";

/** Link de streaming HLS (ex.: Panda Vídeo .m3u8). */
export const isHlsUrl = (url?: string | null) => !!url && /\.m3u8(\?|#|$)/i.test(url);

/** Capa automática do Panda Vídeo (mesma pasta do playlist.m3u8). Outros links: null. */
export const pandaThumb = (url?: string | null) =>
  url && isHlsUrl(url) && /pandavideo\.com/i.test(url) ? url.replace(/[^/]+\.m3u8([?#].*)?$/i, "thumbnail.jpg") : null;

type Props = Omit<VideoHTMLAttributes<HTMLVideoElement>, "src"> & { src: string };

/**
 * <video> que também toca links HLS (.m3u8): Safari/iPhone tocam nativo;
 * nos demais navegadores o hls.js é carregado só no navegador, sob demanda.
 * Com autoPlay, dá o play (mudo) assim que a transmissão fica pronta.
 */
export const StreamVideo = forwardRef<HTMLVideoElement, Props>(function StreamVideo({ src, ...rest }, outer) {
  const ref = useRef<HTMLVideoElement>(null);
  useImperativeHandle(outer, () => ref.current as HTMLVideoElement);
  const hls = isHlsUrl(src);
  const auto = !!rest.autoPlay;

  useEffect(() => {
    const v = ref.current;
    if (!v || !hls) return;
    const kick = () => {
      if (!auto) return;
      v.muted = true;
      void v.play().catch(() => undefined);
    };
    if (v.canPlayType("application/vnd.apple.mpegurl")) {
      v.src = src;
      v.addEventListener("loadedmetadata", kick, { once: true });
      return () => v.removeEventListener("loadedmetadata", kick);
    }
    let destroyed = false;
    let instance: { destroy: () => void } | null = null;
    void import("hls.js").then(({ default: Hls }) => {
      if (destroyed) return;
      if (!Hls.isSupported()) { v.src = src; kick(); return; }
      const h = new Hls({ capLevelToPlayerSize: true, maxBufferLength: 10 });
      instance = h;
      h.on(Hls.Events.MANIFEST_PARSED, kick);
      h.loadSource(src);
      h.attachMedia(v);
    });
    return () => { destroyed = true; instance?.destroy(); };
  }, [src, hls, auto]);

  return <video ref={ref} src={hls ? undefined : src} {...rest} />;
});
