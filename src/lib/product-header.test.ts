import { describe, expect, it } from "vitest";
import { productHeaderSchema, resolveProductHeader } from "./product-header";

const product = { name: "Mini lavadora", title: "Mini lavadora portátil", display: {} };
describe("Configuração do cabeçalho por loja e produto", () => {
  it("mantém o cabeçalho normal em lojas sem configuração", () => {
    expect(resolveProductHeader(product, { checkout: {} }).enabled).toBe(false);
  });
  it("herda a ativação da loja", () => {
    expect(resolveProductHeader({ ...product, display: { header_mode: "inherit" } }, { checkout: { mobile_header_enabled: true } }).enabled).toBe(true);
  });
  it("ativa somente o produto mesmo com loja desligada", () => {
    expect(resolveProductHeader({ ...product, display: { header_mode: "enabled" } }, { checkout: { mobile_header_enabled: false } }).enabled).toBe(true);
  });
  it("desativa somente o produto mesmo com loja ligada", () => {
    expect(resolveProductHeader({ ...product, display: { header_mode: "disabled" } }, { checkout: { mobile_header_enabled: true } }).enabled).toBe(false);
  });
  it("mantém lojas independentes", () => {
    expect(resolveProductHeader(product, { checkout: { mobile_header_enabled: true } }).enabled).toBe(true);
    expect(resolveProductHeader(product, { checkout: { mobile_header_enabled: false } }).enabled).toBe(false);
  });
  it("aceita os três modos no salvamento e rejeita modos desconhecidos", () => {
    for (const header_mode of ["inherit", "enabled", "disabled"]) {
      expect(productHeaderSchema.parse({ header_mode }).header_mode).toBe(header_mode);
    }
    expect(productHeaderSchema.safeParse({ header_mode: "unknown" }).success).toBe(false);
  });
});