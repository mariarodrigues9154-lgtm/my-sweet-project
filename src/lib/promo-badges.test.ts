import { describe, expect, it } from "vitest";
import { promoBadges, type MetricsProduct } from "./product-types";

function product(display: MetricsProduct["display"]): MetricsProduct {
  return {
    rating: 4.8,
    reviews_count: 10,
    sold_count: 5,
    offer: { badge: "OFERTA", highlight: "HOJE" },
    display,
  } as MetricsProduct;
}

describe("promoBadges — selo WhatsApp", () => {
  it("não exibe o selo quando wa_seal_show está desligado ou ausente", () => {
    expect(promoBadges(product({})).wa).toBeNull();
    expect(promoBadges(product({ wa_seal_show: false, wa_seal_text: "Fale conosco" })).wa).toBeNull();
  });

  it("usa o texto padrão quando o campo está vazio", () => {
    const r = promoBadges(product({ wa_seal_show: true }));
    expect(r.wa).toEqual({ text: "Atendimento via WhatsApp", href: null });
  });

  it("usa o texto editado pelo painel", () => {
    const r = promoBadges(product({ wa_seal_show: true, wa_seal_text: "Tirar dúvidas" }));
    expect(r.wa?.text).toBe("Tirar dúvidas");
  });

  it("selo clicável monta link wa.me só com dígitos e mensagem codificada", () => {
    const r = promoBadges(
      product({
        wa_seal_show: true,
        wa_seal_text: "Chamar no WhatsApp",
        wa_seal_clickable: true,
        wa_seal_number: "+55 (91) 99999-9999",
        wa_seal_message: "Olá, gostaria de tirar uma dúvida",
      }),
    );
    expect(r.wa?.href).toBe("https://wa.me/5591999999999?text=Ol%C3%A1%2C%20gostaria%20de%20tirar%20uma%20d%C3%BAvida");
  });

  it("clicável sem número válido vira selo apenas visual (sem link)", () => {
    const r = promoBadges(product({ wa_seal_show: true, wa_seal_clickable: true, wa_seal_number: " " }));
    expect(r.wa?.href).toBeNull();
  });

  it("não altera os selos promocionais 1 e 2", () => {
    const r = promoBadges(product({ wa_seal_show: true }));
    expect(r.badge1).toBe("OFERTA");
    expect(r.badge2).toBe("HOJE");
  });
});
