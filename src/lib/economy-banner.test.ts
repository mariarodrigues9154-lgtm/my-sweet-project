import { describe, expect, it } from "vitest";
import { economyBannerSchema, economyBannerText, toggleBold, editBold } from "./economy-banner";

const clean = (s: string | null) => s?.replace(/\u00a0/g, " ");

describe("faixa Economize", () => {
  it("destaca separadamente as duas economias", () => {
    const text = "Leve 1 e economize R$ 38 | Leve 2 e economize R$ 92";
    const a = text.indexOf("economize R$ 38"), b = text.indexOf("economize R$ 92");
    const ranges = toggleBold(toggleBold([], a, a + 15, text.length), b, b + 15, text.length);
    expect(ranges.map(r => text.slice(r.start, r.end))).toEqual(["economize R$ 38", "economize R$ 92"]);
  });
  it("remove só o destaque selecionado", () => {
    expect(toggleBold([{ start: 8, end: 23 }, { start: 35, end: 50 }], 8, 23, 50)).toEqual([{ start: 35, end: 50 }]);
  });
  it("salva pulsação e alvo junto com negritos", () => {
    const settings = { mode: "manual", text: "Economize", bold: [{ start: 0, end: 9 }], pulse: true, pulse_target: "bold" };
    expect(economyBannerSchema.parse(JSON.parse(JSON.stringify(settings)))).toEqual(settings);
  });
  it("produtos existentes não ativam pulsação", () => {
    expect(economyBannerSchema.parse({ text: "Oferta" })?.pulse).toBeUndefined();
  });
  it("editar antes do destaque preserva palavras destacadas", () => {
    expect(editBold([{ start: 4, end: 12 }], "Oi, economize", "Olá! Oi, economize")).toEqual([{ start: 9, end: 17 }]);
  });
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