import { describe, it, expect } from "vitest";
import { sheetBadges, promoBadges } from "./product-types";
const base = { offer: { badge: "SUPER OFERTA", highlight: "POR TEMPO LIMITADO" }, display: {} } as never;
describe("sheetBadges", () => {
  it("herda do template por padrão", () => expect(sheetBadges(base)).toEqual({ badge1: "SUPER OFERTA", badge2: "POR TEMPO LIMITADO" }));
  it("personalizado só muda o pop-up e vazio oculta", () => {
    const p = { offer: { badge: "SUPER OFERTA", highlight: "POR TEMPO LIMITADO" }, display: { sheet_badges_mode: "custom", sheet_badge1_text: "LEVE 2", sheet_badge2_text: "" } } as never;
    expect(sheetBadges(p)).toEqual({ badge1: "LEVE 2", badge2: null });
    expect(promoBadges(p).badge1).toBe("SUPER OFERTA");
  });
  it("voltar para herdar ignora textos salvos", () => {
    const p = { offer: { badge: "A", highlight: "B" }, display: { sheet_badges_mode: "inherit", sheet_badge1_text: "X" } } as never;
    expect(sheetBadges(p).badge1).toBe("A");
  });
});
