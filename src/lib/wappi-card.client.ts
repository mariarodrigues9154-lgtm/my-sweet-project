/**
 * SDK de cartão da Wappi Brasil (HiSo) — SOMENTE navegador.
 * Doc: https://app.wappibrasil.com.br/docs/cartao-3ds
 *
 * O SDK tokeniza o cartão e conduz a autenticação 3DS no navegador; os dados
 * abertos do cartão nunca passam pelo nosso servidor — só o token de encrypt().
 */

const SDK_URL = "https://api.hiso.com.br/v1/js";

export type WappiThreeDSSettings = {
  threeDSSecurity: boolean;
  threeDSSecurityType: "NONE" | "IFRAME" | "REDIRECT" | "SCRIPT";
  iframeUrl: string | null;
  hideCardForm: boolean;
};

export type WappiCardData = {
  number: string;
  holderName: string;
  expMonth: number;
  expYear: number;
  cvv: string;
};

export type WappiFinishResult = {
  status: "PAID" | "PENDING" | "REFUSED" | string;
  approved: boolean;
  transactionId: string;
  threeDSRequired: boolean;
  redirectUrl: string | null;
  message: string | null;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type HiSoHelper = {
  getModuleName(): string;
  getIframeId(): string;
  convertDecimalToCents(value: number, currency: string): number;
  prepareThreeDS(input: { amount: number; installments: number }): Promise<unknown>;
  finishThreeDS(transaction: unknown, options?: { disableRedirect?: boolean }): Promise<WappiFinishResult>;
  subscribeIframeFormValidation(cb: (data: { hasError: boolean }) => void): void;
};

type HiSoModule = {
  setPublicKey(publicKey: string): Promise<WappiThreeDSSettings>;
  encrypt(card: WappiCardData): Promise<string>;
};

function helper(): HiSoHelper {
  const h = (window as any)["HiSoHelper"] as HiSoHelper | undefined;
  if (!h) throw new Error("SDK da Wappi não carregou.");
  return h;
}

function module(): HiSoModule {
  const name = helper().getModuleName();
  const m = (window as any)[name] as HiSoModule | undefined;
  if (!m) throw new Error("SDK da Wappi não carregou.");
  return m;
}

let loading: Promise<void> | null = null;

/** Carrega o script do SDK uma única vez por página. */
export function loadWappiSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SDK da Wappi só roda no navegador."));
  if ((window as any)["HiSoHelper"]) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SDK_URL;
    s.async = true;
    s.onload = () => ((window as any)["HiSoHelper"] ? resolve() : reject(new Error("SDK da Wappi não carregou.")));
    s.onerror = () => reject(new Error("Não foi possível carregar o SDK de pagamento."));
    document.head.appendChild(s);
  });
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

/** Ativa a public key e devolve as configurações 3DS da conta. */
export async function wappiCardSettings(publicKey: string): Promise<WappiThreeDSSettings> {
  await loadWappiSdk();
  return module().setPublicKey(publicKey);
}

/** Quando o tipo 3DS for IFRAME, embute o iframe da adquirente no elemento indicado. */
export function mountWappiIframe(settings: WappiThreeDSSettings, container: HTMLElement): void {
  if (settings.threeDSSecurityType !== "IFRAME" || !settings.iframeUrl) return;
  if (document.getElementById(helper().getIframeId())) return;
  const iframe = document.createElement("iframe");
  iframe.id = helper().getIframeId();
  iframe.src = settings.iframeUrl;
  iframe.width = "100%";
  iframe.height = "400";
  iframe.style.border = "none";
  container.appendChild(iframe);
}

/** Prepara a autenticação 3DS. Chamar antes do encrypt e sempre que valor/parcelas mudarem. */
export async function prepareWappiThreeDS(amountCents: number, installments: number): Promise<void> {
  await helper().prepareThreeDS({ amount: amountCents, installments });
}

/** Tokeniza o cartão no navegador. Rejeita com erro de validação (error.code) do SDK. */
export async function tokenizeWappiCard(card: WappiCardData): Promise<string> {
  return module().encrypt(card);
}

/**
 * Finaliza a autenticação 3DS com a transação criada no backend.
 * Sem 3DS obrigatório, resolve na hora com o status atual.
 */
export async function finishWappiThreeDS(transaction: unknown): Promise<WappiFinishResult> {
  return helper().finishThreeDS(transaction, { disableRedirect: false });
}
