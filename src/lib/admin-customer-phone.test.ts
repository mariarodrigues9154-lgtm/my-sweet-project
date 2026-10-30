import { describe, expect, it } from "vitest";
import { adminCustomerPhone } from "./admin-customer-phone";

describe("contato manual administrativo", () => {
  it("exibe o telefone real completo e adiciona DDI apenas ao link", () => {
    expect(adminCustomerPhone("(22) 99999-5552")).toEqual({ display: "(22) 99999-5552", raw: "(22) 99999-5552", digits: "22999995552", whatsappUrl: "https://wa.me/5522999995552", canCopy: true });
  });
  it("preserva DDI 55 na cópia e não o duplica no link", () => {
    const phone = adminCustomerPhone("+55 (22) 99999-5552");
    expect(phone.raw).toBe("+55 (22) 99999-5552");
    expect(phone.display).toBe("+55 (22) 99999-5552");
    expect(phone.whatsappUrl).toBe("https://wa.me/5522999995552");
  });
  it("não inventa o nono dígito de um telefone fixo", () => {
    expect(adminCustomerPhone("2233335552").display).toBe("(22) 3333-5552");
    expect(adminCustomerPhone("2233335552").whatsappUrl).toBe("https://wa.me/552233335552");
  });
  it("DDD 55 local não é confundido com DDI", () => {
    expect(adminCustomerPhone("55999995552").whatsappUrl).toBe("https://wa.me/5555999995552");
  });
  it("não reconstrói telefones mascarados", () => {
    expect(adminCustomerPhone("(22) *****-5552")).toMatchObject({ display: "(22) *****-5552", whatsappUrl: null, canCopy: false });
  });
  it("telefone ausente não permite contato", () => {
    expect(adminCustomerPhone(null)).toMatchObject({ display: "—", whatsappUrl: null, canCopy: false });
  });
  it("link só contém dígitos e não inclui mensagem automática", () => {
    expect(adminCustomerPhone("+55 22 99999 5552").whatsappUrl).toMatch(/^https:\/\/wa\.me\/5522999995552$/);
  });
});