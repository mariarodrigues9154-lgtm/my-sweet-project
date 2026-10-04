import { useEffect, useState } from "react";

/** QR Code visual gerado no navegador a partir do mesmo código PIX do botão Copiar. */
export function PixQr({ code, fallback, className }: { code?: string | null | undefined; fallback?: string | null | undefined; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setSrc(null);
    const payload = code?.trim();
    if (payload) {
      import("qrcode")
        .then((QR) => QR.toDataURL(payload, { margin: 1, width: 320, errorCorrectionLevel: "M" }))
        .then((url) => { if (alive) setSrc(url); })
        .catch(() => { if (alive && fallback?.startsWith("data:image")) setSrc(fallback); });
    } else if (fallback && /^(data:image|https:\/\/)/.test(fallback)) {
      setSrc(fallback);
    }
    return () => { alive = false; };
  }, [code, fallback]);
  if (!src) return <div className={`${className ?? ""} grid place-items-center text-[12px] text-muted-foreground`}>Gerando QR Code...</div>;
  return <img src={src} alt="QR Code do PIX" className={className} />;
}
