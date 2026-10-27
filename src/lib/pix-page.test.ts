import { describe, expect, it } from "vitest";
import { resolvePixPage } from "./pix-page";

describe("resolvePixPage", () => {
  it("começa com card, explicação, comprovante e Ver pedido ligados e aviso de dados seguros desligado", () => {
    const r = resolvePixPage(undefined);
    expect([r.show_info_card, r.show_how_to, r.show_proof, r.show_view_order, r.show_secure_notice]).toEqual([true, true, true, true, false]);
  });
  it("respeita desligar comprovante e Ver pedido de forma independente", () => {
    const r = resolvePixPage({ show_proof: false });
    expect(r.show_proof).toBe(false);
    expect(r.show_view_order).toBe(true);
  });
  it("usa o texto editado e volta ao padrão quando vazio", () => {
    expect(resolvePixPage({ info_1: "Novo" }).info_1).toBe("Novo");
    expect(resolvePixPage({ proof_title: "  " }).proof_title).toBe("Já pagou o Pix?");
  });
});
