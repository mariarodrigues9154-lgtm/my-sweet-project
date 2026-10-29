import { describe, expect, it } from "vitest";
import { economyBannerSchema, economyBannerText } from "./economy-banner";

const clean = (s: string | null) => s?.replace(/\u00a0/g, " ");

describe("faixa Economize", () => {
  it("automático calcula R$ 38,00 com 147 e 109", () => {
    expect(clean(economyBannerText(109, 147))).toBe("Economize R$ 38,00");
  });
  it("automático acompanha preços novos", () => {
    expect(clean(economyBannerText(100, 150, { mode: "auto" }))).toBe("Economize R$ 50,00");
  });
  it("automático oculta economia zero", () => {
    expect(economyBannerText(109, 109)).toBeNull();
  });
  it("automático nunca exibe economia negativa", () => {
    expect(economyBannerText(147, 109)).toBeNull();
  });
  it("manual mostra exatamente o texto e ignora preços", () => {
    const s = { mode: "manual" as const, text: "  Desconto exclusivo  " };
    expect(economyBannerText(109, 147, s)).toBe("  Desconto exclusivo  ");
    expect(economyBannerText(80, 200, s)).toBe("  Desconto exclusivo  ");
  });
  it("salva modo e texto individuais", () => {
    expect(economyBannerSchema.parse({ mode: "manual", text: "Preço especial para você" })).toEqual({ mode: "manual", text: "Preço especial para você" });
  });
  it("configurações sobrevivem recarga e ficam isoladas", () => {
    const a = economyBannerSchema.parse(JSON.parse(JSON.stringify({ mode: "manual", text: "Oferta especial por tempo limitado" })));
    const b = economyBannerSchema.parse(JSON.parse(JSON.stringify({ mode: "auto", text: "Outro produto" })));
    expect(economyBannerText(109, 147, a)).toBe("Oferta especial por tempo limitado");
    expect(clean(economyBannerText(109, 147, b))).toBe("Economize R$ 38,00");
  });
});