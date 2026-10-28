import { forwardRef, useEffect, useImperativeHandle, useRef, type VideoHTMLAttributes } from "react";

/** Link de streaming HLS (ex.: Panda Vídeo .m3u8). */
export const isHlsUrl = (url?: string | null) => !!url && /\.m3u8(\?|#|$)/i.test(url);

type Props = Omit<VideoHTMLAttributes<HTMLVideoElement>, "src"> & { src: string };

/**
 * <video> que também toca links HLS (.m3u8): Safari/iPhone tocam nativo;
 * nos demais navegadores o hls.js é carregado só no navegador, sob demanda.
 */
export const StreamVideo = forwardRef<HTMLVideoElement, Props>(function StreamVideo({ src, ...rest }, outer) {
  const ref = useRef<HTMLVideoElement>(null);
  useImperativeHandle(outer, () => ref.current as HTMLVideoElement);
  const hls = isHlsUrl(src);

  useEffect(() => {
    const v = ref.current;
    if (!v || !hls) return;
    if (v.canPlayType("application/vnd.apple.mpegurl")) {
      v.src = src;
      return;
    }
    let destroyed = false;
    let instance: { destroy: () => void } | null = null;
    void import("hls.js").then(({ default: Hls }) => {
      if (destroyed) return;
      if (!Hls.isSupported()) { v.src = src; return; }
      const h = new Hls({ capLevelToPlayerSize: true, maxBufferLength: 10 });
      instance = h;
      h.loadSource(src);
      h.attachMedia(v);
    });
    return () => { destroyed = true; instance?.destroy(); };
  }, [src, hls]);

  return <video ref={ref} src={hls ? undefined : src} {...rest} />;
});
