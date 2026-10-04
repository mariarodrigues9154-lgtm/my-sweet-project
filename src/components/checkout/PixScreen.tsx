import { useState } from "react";
import { PixQr } from "@/components/checkout/PixQr";
import { ChevronLeft, Clock, Copy, Check, QrCode } from "lucide-react";
import { PixIcon } from "@/components/store/VerifiedBadge";
import { brl, clock } from "@/lib/format";

type Props = {
  total: number;
  orderNumber: string;
  productTitle: string;
  qr?: string | undefined;
  code?: string | undefined;
  left: number | null;
  expiresAt: number | null;
  onBack: () => void;
  onNew: () => void;
};

/** Tela final do PIX: usa somente os dados reais da cobrança salva no pedido. */
export function PixScreen({ total, orderNumber, productTitle, qr, code, left, expiresAt, onBack, onNew }: Props) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const expired = left !== null && left <= 0;
  const deadline = expiresAt
    ? new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(expiresAt)
    : null;

  async function copy() {
    if (!code || expired) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-10 grid h-12 grid-cols-[40px_minmax(0,1fr)_40px] items-center bg-background px-2">
        <button type="button" aria-label="Voltar" onClick={onBack} className="grid size-10 place-items-center">
          <ChevronLeft size={24} />
        </button>
        <h1 className="truncate text-center text-[16px] font-bold">Código do pagamento</h1>
        <span />
      </header>

      <main className="mx-auto w-full max-w-[520px] flex-1 px-4 pt-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <p className="text-[20px] font-extrabold leading-tight">{expired ? "Pix expirado" : "Aguardando o pagamento"}</p>
            <p className="text-[22px] font-extrabold leading-tight tnum">{brl(total)}</p>
          </div>
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
            <Clock size={24} strokeWidth={2.4} />
          </span>
        </div>

        {left !== null && (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground">
            Vence em:
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[13px] font-bold text-primary-foreground tnum">
              <Clock size={12} strokeWidth={2.6} /> {clock(left)}
            </span>
          </p>
        )}
        {deadline && (
          <p className="mt-2 text-[13px] text-muted-foreground">
            Prazo <span className="text-foreground">{deadline}</span>
          </p>
        )}

        <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-card-soft">
          <p className="flex items-center gap-2 text-[14px] font-semibold"><PixIcon size={20} /> PIX</p>

          {showQr && (code || qr) && !expired && (
            <PixQr code={code} fallback={qr} className="mx-auto mt-4 size-48 rounded-xl border border-border bg-card p-2" />
          )}

          {code && (
            <p className={`mt-4 truncate text-[18px] font-bold ${expired ? "text-muted-foreground line-through" : ""}`}>{code}</p>
          )}

          {expired && (
            <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-[12.5px] font-medium text-destructive">Este código PIX expirou e não pode mais ser usado. Não pague com ele — gere uma nova cobrança abaixo.</p>
          )}
          {expired ? (
            <button type="button" onClick={onNew} className="mt-4 flex h-12 w-full items-center justify-center rounded-lg bg-primary text-[15px] font-bold text-primary-foreground">
              Gerar nova cobrança PIX
            </button>
          ) : (
            <button
              type="button"
              onClick={copy}
              disabled={!code}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-[15px] font-bold text-primary-foreground disabled:opacity-50"
            >
              {copied ? <><Check size={18} /> Código Pix copiado!</> : <><Copy size={18} /> Copiar</>}
            </button>
          )}

          {(code || qr) && !expired && (
            <button
              type="button"
              onClick={() => setShowQr((v) => !v)}
              className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border text-[13px] font-semibold"
            >
              <QrCode size={16} /> {showQr ? "Ocultar QR Code" : "Mostrar QR Code"}
            </button>
          )}
        </section>

        <h2 className="mt-7 text-[17px] font-bold">Como fazer pagamentos com PIX?</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-foreground/80">
          Copie o código de pagamento acima, selecione Pix no seu app de internet ou de banco e cole o código.
        </p>

        {showOrder && (
          <div className="mt-5 rounded-xl bg-surface p-3 text-[13px]">
            <p><span className="text-muted-foreground">Pedido:</span> <strong>{orderNumber}</strong></p>
            {productTitle && <p className="mt-1 line-clamp-2">{productTitle}</p>}
            <p className="mt-1"><span className="text-muted-foreground">Total:</span> <strong className="tnum">{brl(total)}</strong></p>
            <p className="mt-1 text-muted-foreground">Status: {expired ? "Pix expirado" : "Aguardando pagamento"}</p>
          </div>
        )}
      </main>

      <div className="sticky bottom-0 mx-auto w-full max-w-[520px] bg-background px-4 pt-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
        <button type="button" onClick={() => setShowOrder((v) => !v)} className="h-12 w-full rounded-lg bg-muted text-[15px] font-semibold">
          {showOrder ? "Ocultar pedido" : "Ver pedido"}
        </button>
      </div>
    </div>
  );
}
