/**
 * Contrato para gateways de cartão. O número e o CVV vão do navegador direto ao SDK
 * do gateway (tokenizeCard); nosso backend só recebe o token.
 */
import type { CardProviderId } from "@/lib/payment-methods";

export type CardInput = { number: string; expiry: string; cvv: string; holder: string };
export type CardToken = { token: string; brand: string; last4: string };

export interface CreditCardProvider {
  id: CardProviderId;
  isAvailable(): boolean;
  /** Roda no navegador com o SDK do gateway. Nunca envia o cartão ao nosso backend. */
  tokenizeCard(card: CardInput): Promise<CardToken>;
  getInstallments?(totalCents: number): Promise<Array<{ n: number; totalCents: number }>>;
  createPayment?(input: { orderNumber: string; token: string; installments: number }): Promise<{ status: string }>;
  getPaymentStatus?(orderNumber: string): Promise<{ status: string }>;
}

const noneProvider: CreditCardProvider = {
  id: "none",
  isAvailable: () => false,
  tokenizeCard: async () => {
    throw new Error("Nenhum gateway de cartão conectado.");
  },
};

export function getCardProvider(_id: CardProviderId): CreditCardProvider {
  // Gateways reais serão registrados aqui quando forem liberados.
  return noneProvider;
}
