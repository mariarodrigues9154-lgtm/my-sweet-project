import type { ShippingOption } from "./product-types";

/** Única modalidade de entrega da loja — fonte de verdade para página, modal, checkouts e servidor. */
export const SHIPPING = {
  id: "gratis",
  name: "Frete Expresso",
  originalPrice: 24.9, // referência visual riscada, nunca cobrada
  currentPrice: 0, // valor realmente cobrado
  minDeliveryDays: 2,
  maxDeliveryDays: 4,
} as const;

const dayMonth = (d: Date) => new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" }).format(d);
const dayOnly = (d: Date) => new Intl.DateTimeFormat("pt-BR", { day: "numeric" }).format(d);

/** Datas reais de calendário: hoje + mínimo até hoje + máximo (vira mês e ano corretamente). */
export function getEstimatedDeliveryRange(now: Date = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + SHIPPING.minDeliveryDays);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + SHIPPING.maxDeliveryDays);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  return {
    start,
    end,
    /** "5 de outubro e 7 de outubro" */
    long: `${dayMonth(start)} e ${dayMonth(end)}`,
    /** "5 e 7 de outubro" · "30 de outubro e 1 de novembro" */
    compact: sameMonth ? `${dayOnly(start)} e ${dayMonth(end)}` : `${dayMonth(start)} e ${dayMonth(end)}`,
    /** "5 a 7 de outubro" · "30 de outubro a 1 de novembro" */
    short: sameMonth ? `${dayOnly(start)} a ${dayMonth(end)}` : `${dayMonth(start)} a ${dayMonth(end)}`,
  };
}

/** A lista de opções exibida e aceita: sempre uma só, grátis. */
export function shippingOptions(now?: Date): ShippingOption[] {
  return [{ id: SHIPPING.id, label: SHIPPING.name, eta: `Chegará entre ${getEstimatedDeliveryRange(now).compact}`, price: SHIPPING.currentPrice }];
}
