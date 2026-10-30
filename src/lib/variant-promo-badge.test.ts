import { describe, expect, it } from "vitest";
import { optionPromoBadge, type Product } from "./product-types";

const product = {
  variants: [
    {
      name: "kit",
      label: "Kit",
      options: [
        { label: "1 Processador", value: "1x" },
        { label: "2 Processadores", value: "2x" },
      ],
    },
  ],
  variant_combos: [
    { key: "1x", price: 99, active: true },
    {
      key: "2x",
      price: 179,
      active: true,
      promo_badge: { enabled: true, text: "LEVE 2 E ECONOMIZE", pulse: true, bg_color: "#e8304f", text_color: "#ffffff" },
    },
  ],
} as unknown as Product;

describe("optionPromoBadge", () => {
  it("retorna o selo da variante que tem selo ativo", () => {
    const badge = optionPromoBadge(product, {}, "kit", "2x");
    expect(badge?.text).toBe("LEVE 2 E ECONOMIZE");
    expect(badge?.pulse).toBe(true);
  });

  it("retorna null para a variante sem selo", () => {
    expect(optionPromoBadge(product, {}, "kit", "1x")).toBeNull();
  });

  it("retorna null quando o selo está desativado", () => {
    const p = {
      ...product,
      variant_combos: [{ key: "1x", promo_badge: { enabled: false, text: "OFERTA" } }],
    } as unknown as Product;
    expect(optionPromoBadge(p, {}, "kit", "1x")).toBeNull();
  });

  it("retorna null quando o texto está vazio", () => {
    const p = {
      ...product,
      variant_combos: [{ key: "1x", promo_badge: { enabled: true, text: "   " } }],
    } as unknown as Product;
    expect(optionPromoBadge(p, {}, "kit", "1x")).toBeNull();
  });

  it("respeita a seleção dos outros grupos", () => {
    const p = {
      variants: [
        { name: "cor", label: "Cor", options: [{ label: "Preto", value: "preto" }, { label: "Branco", value: "branco" }] },
        { name: "kit", label: "Kit", options: [{ label: "1x", value: "1x" }, { label: "2x", value: "2x" }] },
      ],
      variant_combos: [
        { key: "preto|1x" },
        { key: "preto|2x", promo_badge: { enabled: true, text: "COMBO PRETO" } },
        { key: "branco|1x" },
        { key: "branco|2x", promo_badge: { enabled: true, text: "COMBO BRANCO" } },
      ],
    } as unknown as Product;
    expect(optionPromoBadge(p, { cor: "preto" }, "kit", "2x")?.text).toBe("COMBO PRETO");
    expect(optionPromoBadge(p, { cor: "branco" }, "kit", "2x")?.text).toBe("COMBO BRANCO");
  });

  it("não altera preço nem desconto (selo é só visual)", () => {
    const badge = optionPromoBadge(product, {}, "kit", "2x");
    expect(badge).not.toHaveProperty("price");
  });
});
