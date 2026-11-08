import { describe, it, expect } from "vitest";
import { wappiError } from "./providers.server";
describe("wappiError limite da conta", () => {
  it("não culpa os dados do cliente", () => {
    expect(wappiError(400, "Valor da transação (R$ 148,00) excede o limite máximo de R$ 0,01 para esta empresa.")).toBe("Pagamento com cartão indisponível no momento. Tente pagar com PIX.");
  });
});
