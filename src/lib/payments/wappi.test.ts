import { describe, expect, it } from "vitest";
import { validateWappiInput, wappiErrorDetail } from "./providers.server";

const address = { street: "Rua 25", street_number: "25", zip_code: "71691130", neighborhood: "Centro", city: "Brasília", state: "DF" };

describe("wappiErrorDetail", () => {
  it("lê error_messages[].message (recusa do adquirente)", () => {
    const body = { success: false, error_messages: [{ code: null, target: null, message: "Erro ao processar a transação com as adquirentes." }] };
    expect(wappiErrorDetail(body)).toContain("adquirentes");
  });
  it("lê errors RFC 9110 por campo", () => {
    const body = { status: 400, errors: { "Customer.Phone": ["The Phone field is required."] } };
    expect(wappiErrorDetail(body)).toContain("Customer.Phone");
  });
  it("devolve null quando não há detalhe", () => {
    expect(wappiErrorDetail(null)).toBeNull();
    expect(wappiErrorDetail({})).toBeNull();
  });
});

describe("validateWappiInput", () => {
  it("aceita CPF, telefone e endereço válidos", () => {
    expect(validateWappiInput({ doc: "52998224725", phone: "5561995635324", address })).toBeNull();
  });
  it("rejeita CPF com dígito verificador errado", () => {
    expect(validateWappiInput({ doc: "52998224720", phone: "5561995635324", address })).toContain("CPF");
  });
  it("rejeita CPF vazio ou sequencial", () => {
    expect(validateWappiInput({ doc: "", phone: "5561995635324", address })).toContain("CPF");
    expect(validateWappiInput({ doc: "00000000000", phone: "5561995635324", address })).toContain("CPF");
  });
  it("rejeita telefone curto demais", () => {
    expect(validateWappiInput({ doc: "52998224725", phone: "6199563", address })).toContain("telefone");
  });
  it("rejeita endereço sem número", () => {
    expect(validateWappiInput({ doc: "52998224725", phone: "5561995635324", address: { ...address, street_number: "" } })).toContain("número");
  });
  it("rejeita CEP incompleto", () => {
    expect(validateWappiInput({ doc: "52998224725", phone: "5561995635324", address: { ...address, zip_code: "7169" } })).toContain("CEP");
  });
});

import { classifyWappiError, WAPPI_CREATE_TIMEOUT_MS } from "./providers.server";
describe("classifyWappiError", () => {
  it("separa autenticação, validação, 5xx e 4xx", () => {
    expect(classifyWappiError(401, null)).toBe("AUTH_ERROR");
    expect(classifyWappiError(400, "Customer.Phone: required")).toBe("VALIDATION_ERROR");
    expect(classifyWappiError(502, null)).toBe("HTTP_5XX");
    expect(classifyWappiError(400, "Erro ao processar a transação com as adquirentes.")).toBe("HTTP_4XX");
    expect(classifyWappiError(409, null)).toBe("DUPLICATE_TRANSACTION");
  });
  it("criação do PIX tem limite de tempo finito", () => {
    expect(WAPPI_CREATE_TIMEOUT_MS).toBe(25000);
  });
});
