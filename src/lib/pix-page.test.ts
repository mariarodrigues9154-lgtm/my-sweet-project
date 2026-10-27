import { describe, expect, it } from "vitest";
import { isUsableWaNumber, resolvePixPage } from "./pix-page";

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
  it("bloco do WhatsApp vem ativado com textos padrão e respeita desligar e número editado", () => {
    const r = resolvePixPage(undefined);
    expect([r.show_whatsapp, r.wa_title, r.wa_button]).toEqual([true, "Dúvidas?", "Falar no WhatsApp"]);
    expect(resolvePixPage({ show_whatsapp: false }).show_whatsapp).toBe(false);
    expect(resolvePixPage({ wa_number: "5585999999999" }).wa_number).toBe("5585999999999");
    expect(resolvePixPage({ wa_number: "   " }).wa_number).toBe("");
  });
});
