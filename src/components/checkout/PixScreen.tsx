import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PixQr } from "@/components/checkout/PixQr";
import { ChevronLeft, Clock, Copy, Check, QrCode, ShieldCheck, Mail, CircleCheck, Package, Upload } from "lucide-react";
import { PixIcon } from "@/components/store/VerifiedBadge";
import { WhatsAppIcon } from "@/components/store/WhatsAppIcon";
import { brl, clock } from "@/lib/format";
import { resolvePixPage, type PixPageSettings } from "@/lib/pix-page";
import { uploadPaymentProof } from "@/lib/payment-proof.functions";

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
  settings?: PixPageSettings | null | undefined;
  /** WhatsApp de suporte da loja (usado quando o bloco não tem número próprio). */
  whatsapp?: string | null | undefined;
};

/** Tela final do PIX: usa somente os dados reais da cobrança salva no pedido. */
export function PixScreen({ total, orderNumber, productTitle, qr, code, left, expiresAt, onBack, onNew, settings, whatsapp }: Props) {
  const page = resolvePixPage(settings);
  const waDigits = ((page.wa_number || "").trim() || (whatsapp ?? "")).replace(/\D/g, "");
  const waLink = `https://wa.me/${waDigits}?text=${encodeURIComponent(`Olá! Tenho uma dúvida sobre o pagamento do meu pedido ${orderNumber}.`)}`;
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const [sending, setSending] = useState(false);
  const [proofSent, setProofSent] = useState(false);
  const upload = useServerFn(uploadPaymentProof);
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

  async function sendProof(file?: File) {
    if (!file) return;
    const types = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
    if (!types.includes(file.type as (typeof types)[number])) { toast.error("Envie uma imagem (JPG, PNG, WEBP) ou PDF."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Arquivo muito grande (máx. 5 MB)."); return; }
    setSending(true);
    try {
      const base64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = rej; r.readAsDataURL(file); });
      const result = await upload({ data: { order_number: orderNumber, contentType: file.type as (typeof types)[number], base64 } });
      if (result.ok) { setProofSent(true); toast.success("Comprovante enviado!"); } else toast.error(result.error);
    } catch { toast.error("Não foi possível enviar o comprovante."); }
    finally { setSending(false); }
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

        {page.show_how_to && (
          <>
            <h2 className="mt-6 text-[17px] font-bold">{page.how_to_title}</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-foreground/75">{page.how_to_text}</p>
          </>
        )}

        {page.show_info_card && (
          <ul className="mt-4 space-y-4 rounded-xl border border-border bg-card px-3 py-4">
            {([[Mail, page.info_1], [CircleCheck, page.info_2], [Package, page.info_3]] as const).map(([Icon, text], i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Icon size={18} strokeWidth={2.2} />
                </span>
                <p className="text-[12.5px] leading-snug text-foreground/75">{text}</p>
              </li>
            ))}
          </ul>
        )}

        {page.show_whatsapp && waDigits.length >= 10 && (
          <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-success/25 bg-success-soft p-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-success/15 text-success">
              <WhatsAppIcon size={24} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-extrabold leading-tight">{page.wa_title}</p>
              <p className="mt-1 text-[11px] leading-[1.35] text-foreground/70">{page.wa_text}</p>
            </div>
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-whatsapp px-3 text-[12.5px] font-bold text-whatsapp-foreground shadow-sm transition-opacity active:opacity-90"
            >
              <WhatsAppIcon size={16} /> {page.wa_button}
            </a>
          </div>
        )}

        {page.show_secure_notice && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-secure-soft px-4 py-3.5">
            <p className="text-[13px] text-secure">Seus dados estão seguros e criptografados</p>
            <ShieldCheck size={22} strokeWidth={2} className="shrink-0 text-secure" />
          </div>
        )}

        {page.show_proof && (
          <div className="mt-3 rounded-xl border border-border bg-muted/60 px-3 py-3 text-center">
            <p className="text-[14px] font-bold">{page.proof_title}</p>
            {proofSent ? (
              <p className="mt-2 flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card text-[13px] font-semibold text-success"><Check size={16} /> Comprovante enviado</p>
            ) : (
              <label className={`mt-2 flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-card text-[13.5px] ${sending ? "opacity-60" : ""}`}>
                <Upload size={16} /> {sending ? "Enviando..." : "Enviar comprovante"} <span className="text-[11px] text-muted-foreground">(Opcional)</span>
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" disabled={sending} onChange={(e) => void sendProof(e.target.files?.[0])} />
              </label>
            )}
            <p className="mt-2 text-[12px] leading-snug text-muted-foreground">{page.proof_text}</p>
          </div>
        )}

        {page.show_view_order && (
          <button type="button" onClick={() => setShowOrder((v) => !v)} className="mt-3 h-12 w-full rounded-lg bg-muted text-[15px] font-semibold text-foreground/85">
            {showOrder ? "Ocultar pedido" : "Ver pedido"}
          </button>
        )}

        {showOrder && (
          <div className="mt-3 rounded-xl bg-surface p-3 text-[13px]">
            <p><span className="text-muted-foreground">Pedido:</span> <strong>{orderNumber}</strong></p>
            {productTitle && <p className="mt-1 line-clamp-2">{productTitle}</p>}
            <p className="mt-1"><span className="text-muted-foreground">Total:</span> <strong className="tnum">{brl(total)}</strong></p>
            <p className="mt-1 text-muted-foreground">Status: {expired ? "Pix expirado" : "Aguardando pagamento"}</p>
          </div>
        )}
        <div style={{ height: "calc(env(safe-area-inset-bottom) + 24px)" }} />
      </main>
    </div>
  );
}
