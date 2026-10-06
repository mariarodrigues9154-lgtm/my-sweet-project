/**
 * Catálogo de provedores de pagamento — arquivo seguro para o navegador.
 * Descreve apenas quais campos cada provedor precisa; nunca contém credenciais.
 */

export type PaymentProviderId = "none" | "wappi" | "pinpay" | "blackcat" | "mercadopago" | "asaas";
export type PaymentEnvironment = "sandbox" | "production";

export type ProviderField = {
  key: string;
  label: string;
  hint?: string;
  secret: boolean;
  required: boolean;
};

export type ProviderSpec = {
  id: PaymentProviderId;
  name: string;
  supportsPix: boolean;
  docs?: string;
  /** Provedor com uma única URL (sem ambiente de teste separado). */
  singleEnvironment?: boolean;
  fields: ProviderField[];
};

export const PAYMENT_PROVIDERS: ProviderSpec[] = [
  { id: "none", name: "Nenhum", supportsPix: false, fields: [] },
  {
    id: "wappi",
    name: "Wappi Brasil",
    supportsPix: true,
    singleEnvironment: true,
    docs: "Painel da Wappi Brasil > Credenciais de API",
    fields: [
      { key: "public_key", label: "PUBLIC_KEY", secret: false, required: true },
      { key: "secret_key", label: "SECRET_KEY", secret: true, required: true },
    ],
  },
  {
    id: "pinpay",
    name: "PinPay",
    supportsPix: true,
    singleEnvironment: true,
    docs: "Painel da PinPay > Configurações > Chaves de API",
    fields: [
      { key: "secret_key", label: "Secret Key", secret: true, required: true, hint: "Começa com sk_" },
      { key: "webhook_secret", label: "Signing Secret do webhook (opcional)", secret: true, required: false, hint: "Começa com whsec_ — só se você cadastrar o webhook no painel da PinPay" },
    ],
  },
  {
    id: "blackcat",
    name: "Blackcat",
    supportsPix: true,
    singleEnvironment: true,
    docs: "Painel da Blackcat > Integrações > API Key",
    fields: [{ key: "api_key", label: "API Key", secret: true, required: true }],
  },
  {
    id: "mercadopago",
    name: "Mercado Pago",
    supportsPix: true,
    docs: "Painel do Mercado Pago > Suas integrações > Credenciais",
    fields: [
      { key: "access_token", label: "Access Token", secret: true, required: true, hint: "Começa com APP_USR ou TEST" },
      { key: "public_key", label: "Public Key", secret: false, required: false },
      { key: "webhook_secret", label: "Assinatura do webhook", secret: true, required: false },
    ],
  },
  {
    id: "asaas",
    name: "Asaas",
    supportsPix: true,
    docs: "Painel do Asaas > Integrações > Chave de API",
    fields: [
      { key: "api_key", label: "Chave de API", secret: true, required: true },
      { key: "webhook_secret", label: "Token do webhook", secret: true, required: false },
    ],
  },
];

export function providerSpec(id: string): ProviderSpec {
  return PAYMENT_PROVIDERS.find((p) => p.id === id) ?? (PAYMENT_PROVIDERS[0] as ProviderSpec);
}

export function providerName(id: string): string {
  return providerSpec(id).name;
}

/** Credencial salva nunca é exibida, nem parcialmente. */
export function maskSecret(_value: string): string {
  return "••••••••••••••••";
}
