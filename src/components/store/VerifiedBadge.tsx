/** Selo azul de loja verificada (SVG leve, nítido em qualquer tela). */
export function VerifiedBadge({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      role="img"
      aria-label="Loja verificada"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`inline-block shrink-0 align-middle ${className}`}
    >
      <path
        fill="var(--verified)"
        d="M21.60 12.00Q23.78 15.16 20.31 16.80Q20.63 20.63 16.80 20.31Q15.16 23.78 12.00 21.60Q8.84 23.78 7.20 20.31Q3.37 20.63 3.69 16.80Q0.22 15.16 2.40 12.00Q0.22 8.84 3.69 7.20Q3.37 3.37 7.20 3.69Q8.84 0.22 12.00 2.40Q15.16 0.22 16.80 3.69Q20.63 3.37 20.31 7.20Q23.78 8.84 21.60 12.00Z"
      />
      <path d="M7.9 12.3l2.75 2.75 5.45-5.6" fill="none" stroke="var(--verified-foreground)" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Um único controle global: o campo "verified" da loja. */
export function isStoreVerified(store: { verified?: boolean | null }) {
  return store.verified !== false;
}

export function PixIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg role="img" aria-label="Pix" width={size} height={size} viewBox="0 0 24 24" className={`shrink-0 ${className}`}>
      <path
        fill="var(--pix)"
        d="M5.283 18.36a3.505 3.505 0 0 0 2.493-1.032l3.6-3.6a.684.684 0 0 1 .946 0l3.613 3.613a3.504 3.504 0 0 0 2.493 1.032h.71l-4.56 4.56a3.647 3.647 0 0 1-5.156 0L4.85 18.36ZM18.428 5.627a3.505 3.505 0 0 0-2.493 1.032l-3.613 3.614a.67.67 0 0 1-.946 0l-3.6-3.6A3.505 3.505 0 0 0 5.283 5.64h-.434l4.573-4.572a3.646 3.646 0 0 1 5.156 0l4.559 4.559ZM1.068 9.422 3.79 6.699h1.492a2.483 2.483 0 0 1 1.744.722l3.6 3.6a1.73 1.73 0 0 0 2.443 0l3.614-3.613a2.482 2.482 0 0 1 1.744-.723h1.767l2.737 2.737a3.646 3.646 0 0 1 0 5.156l-2.736 2.736h-1.768a2.482 2.482 0 0 1-1.744-.722l-3.613-3.613a1.77 1.77 0 0 0-2.444 0l-3.6 3.6a2.483 2.483 0 0 1-1.744.722H3.791l-2.723-2.723a3.646 3.646 0 0 1 0-5.156"
      />
    </svg>
  );
}
