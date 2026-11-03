import { describe, expect, it } from "vitest";
import { directSettingResult, searchSettings, settingsCatalog } from "./admin-settings-search";

const items = settingsCatalog([{ id: "own-product", title: "Mini Máquina" }]);
describe("Pesquisa administrativa por loja", () => {
  it("encontra automação de frete sem acento e ignora maiúsculas", () => {
    expect(directSettingResult(searchSettings(items, "AUTOMACAO DE FRETE"), "AUTOMACAO DE FRETE")?.area).toBe("magnus");
  });
  it("direciona Pagamento para formas de pagamento", () => {
    expect(directSettingResult(searchSettings(items, "Pagamento"), "Pagamento")?.section).toBe("Formas de pagamento");
  });
  it("inclui avaliações dos produtos mesmo sem montar o editor", () => {
    const results = searchSettings(items, "avaliacoes");
    expect(results.some((result) => result.section === "Avaliações" && result.productId === "own-product")).toBe(true);
    expect(results.filter((result) => result.productId).every((result) => result.productId === "own-product")).toBe(true);
  });
  it("oferece escolha para as diferentes configurações PIX", () => {
    const results = searchSettings(items, "pix");
    expect(results.length).toBeGreaterThan(1);
    expect(directSettingResult(results, "pix")).toBeUndefined();
  });
  it("encontra nome parcial de campos não montados", () => {
    expect(searchSettings(items, "modelo para aval").some((result) => result.section === "Popup / Notificações flutuantes")).toBe(true);
  });
  it("não inventa configurações inexistentes", () => {
    expect(searchSettings(items, "Tema de frete")).toEqual([]);
    expect(searchSettings(items, "zzzinexistente")).toEqual([]);
    expect(searchSettings(items, "")).toEqual([]);
  });
  it("abre as credenciais Wappi sem depender do editor montado", () => {
    expect(directSettingResult(searchSettings(items, "Wappi"), "Wappi")?.providerId).toBe("wappi");
  });
  it("preserva escolha entre produtos com avaliações", () => {
    const results = searchSettings(settingsCatalog([{ id: "a", title: "Máquina" }, { id: "b", title: "Mop" }]), "Avaliações").filter((result) => result.section === "Avaliações");
    expect(results.map((result) => result.productId).sort()).toEqual(["a", "b"]);
    expect(directSettingResult(results, "Avaliações")).toBeUndefined();
  });
});