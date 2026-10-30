import { describe, expect, it } from "vitest";
import { optionPromoBadge, type Product } from "./product-types";

const product = {
  variants: [
    {
      name: "kit",
      label: "Kit",
      use_image: true,
      options: [
        { label: "1 Processador", value: "1x", image: "https://img/1x.png" },
        { label: "2 Processadores", value: "2x", image: "https://img/2x.png" },
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
        {
          name: "kit",
          label: "Kit",
          use_image: true,
          options: [
            { label: "1x", value: "1x", image: "https://img/1x.png" },
            { label: "2x", value: "2x", image: "https://img/2x.png" },
          ],
        },
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

  it("nunca exibe selo em grupo de botões sem imagem (voltagem)", () => {
    const p = {
      variants: [
        {
          name: "kit",
          label: "Quantidades",
          use_image: true,
          options: [
            { label: "1 Processador", value: "1x", image: "https://img/1x.png" },
            { label: "2 Processadores", value: "2x", image: "https://img/2x.png" },
          ],
        },
        {
          name: "voltagem",
          label: "Voltagem",
          options: [
            { label: "110V", value: "110v" },
            { label: "220V", value: "220v" },
          ],
        },
      ],
      variant_combos: [
        { key: "1x|110v" },
        { key: "1x|220v" },
        { key: "2x|110v", promo_badge: { enabled: true, text: "LEVE 2 E ECONOMIZE" } },
        { key: "2x|220v", promo_badge: { enabled: true, text: "LEVE 2 E ECONOMIZE" } },
      ],
    } as unknown as Product;
    // selo aparece no card com imagem
    expect(optionPromoBadge(p, { voltagem: "110v" }, "kit", "2x")?.text).toBe("LEVE 2 E ECONOMIZE");
    // e nunca nos botões de voltagem, mesmo com o combo tendo selo
    expect(optionPromoBadge(p, { kit: "2x" }, "voltagem", "110v")).toBeNull();
    expect(optionPromoBadge(p, { kit: "2x" }, "voltagem", "220v")).toBeNull();
  });

  it("nunca exibe selo quando o grupo inteiro não usa imagem", () => {
    const p = {
      variants: [
        {
          name: "tamanho",
          label: "Tamanho",
          options: [
            { label: "P", value: "p" },
            { label: "M", value: "m" },
          ],
        },
      ],
      variant_combos: [{ key: "m", promo_badge: { enabled: true, text: "MAIS VENDIDO" } }],
    } as unknown as Product;
    expect(optionPromoBadge(p, {}, "tamanho", "m")).toBeNull();
  });
});
