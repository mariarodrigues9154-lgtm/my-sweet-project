import { describe, it, expect } from "vitest";
import { recoveryProductName } from "./recovery-product-name";
describe("recoveryProductName", () => {
  it("usa o nome curto quando preenchido", () => {
    expect(recoveryProductName({ title: "Mini Máquina de Lavar Portátil Dobrável", whatsapp_name: "máquina de lavar" })).toBe("máquina de lavar");
  });
  it("usa o título completo quando o nome curto está vazio", () => {
    expect(recoveryProductName({ title: "Mini Máquina de Lavar", whatsapp_name: "  " })).toBe("Mini Máquina de Lavar");
  });
});
