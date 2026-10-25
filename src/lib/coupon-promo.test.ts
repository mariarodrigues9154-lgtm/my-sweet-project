import { describe, expect, it } from "vitest";
import { fillCouponText, resolveCouponPromo, sanitizeCouponPromo } from "./coupon-promo";

describe("cupom promocional", () => {
  it("produto antigo sem configuração: chip e barra desligados", () => {
    const c = resolveCouponPromo({});
    expect([c.chip_enabled, c.bar_enabled]).toEqual([false, false]);
  });
  it("desligar não apaga textos salvos", () => {
    const c = resolveCouponPromo({ coupon_promo: { chip_enabled: false, chip_text: "Cupom especial de outubro" } });
    expect(c.chip_enabled).toBe(false);
    expect(c.chip_text).toBe("Cupom especial de outubro");
  });
  it("chip e barra são independentes", () => {
    const c = resolveCouponPromo({ coupon_promo: { chip_enabled: true, bar_enabled: false } });
    expect([c.chip_enabled, c.bar_enabled]).toEqual([true, false]);
  });
  it("preenche percentual e máximo", () => {
    expect(fillCouponText("Desconto de {percent}%, máximo de {max}", { percent: 60, max_value: 20 })).toBe("Desconto de 60%, máximo de R$\u00a020");
  });
  it("percentual fica entre 0 e 100", () => {
    expect(sanitizeCouponPromo({ percent: 150 }).percent).toBe(100);
  });
  it("aceita destaque livre sem depender de cupom ou percentual", () => {
    const c = resolveCouponPromo({ coupon_promo: { highlight_text: "Última chance", secondary_text: "de comprar por esse valor" } });
    expect(c.highlight_text).toBe("Última chance");
    expect(c.secondary_text).toBe("de comprar por esse valor");
  });
  it("mantém os textos independentes entre produtos", () => {
    const a = resolveCouponPromo({ coupon_promo: { highlight_text: "Últimas unidades", secondary_text: "disponíveis nesse preço" } });
    const b = resolveCouponPromo({ coupon_promo: { highlight_text: "Somente hoje", secondary_text: "aproveite antes que termine" } });
    expect(a.highlight_text).toBe("Últimas unidades");
    expect(b.highlight_text).toBe("Somente hoje");
    expect(a.secondary_text).toBe("disponíveis nesse preço");
    expect(b.secondary_text).toBe("aproveite antes que termine");
  });
  it("permite apagar qualquer uma das partes sem restaurar texto padrão", () => {
    const c = resolveCouponPromo({ coupon_promo: { highlight_text: "", secondary_text: "Oferta exclusiva" } });
    expect(c.highlight_text).toBe("");
    expect(c.secondary_text).toBe("Oferta exclusiva");
    expect(resolveCouponPromo({ coupon_promo: { highlight_text: "Última chance", secondary_text: "" } }).secondary_text).toBe("");
  });
  it("preserva texto legado inteiro sem inferir destaque", () => {
    const c = resolveCouponPromo({ coupon_promo: { bar_text: "O cupom de 75% de desconto está expirando" } });
    expect(c.highlight_text).toBe("");
    expect(c.secondary_text).toBe("O cupom de 75% de desconto está expirando");
  });
  it("salva as partes sem alterar duração ou outras opções", () => {
    expect(sanitizeCouponPromo({ highlight_text: "Últimas unidades", secondary_text: "disponíveis nesse preço", countdown_hours: 18, countdown_minutes: 9, show_close: true })).toEqual({ highlight_text: "Últimas unidades", secondary_text: "disponíveis nesse preço", countdown_hours: 18, countdown_minutes: 9, show_close: true });
  });
});
