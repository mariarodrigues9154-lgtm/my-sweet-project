import { describe, expect, it } from "vitest";
import { fillTemplate, normalizeBrPhone, reminderDelays } from "./whatsapp-recovery.server";

describe("recuperação PIX via WhatsApp", () => {
  it("normaliza telefone brasileiro para 55 + DDD + número", () => {
    expect(normalizeBrPhone("(85) 99999-1234")).toBe("5585999991234");
    expect(normalizeBrPhone("+55 85 99999-1234")).toBe("5585999991234");
  });
  it("telefone inválido retorna null", () => {
    expect(normalizeBrPhone("1234")).toBeNull();
  });
  it("normaliza (49) 99938-2747 para 5549999382747", () => {
    expect(normalizeBrPhone("(49) 99938-2747")).toBe("5549999382747");
  });
  it("não duplica o DDI 55 quando o número já começa com 55", () => {
    expect(normalizeBrPhone("5549999382747")).toBe("5549999382747");
    expect(normalizeBrPhone("+55 (49) 99938-2747")).toBe("5549999382747");
  });
  it("padrão é 1 lembrete aos 15 minutos", () => {
    expect(reminderDelays(undefined, 1)).toEqual([15]);
  });
  it("até 3 lembretes com tempos próprios", () => {
    expect(reminderDelays([15, 60, 180], 3)).toEqual([15, 60, 180]);
    expect(reminderDelays([5, 10, 20], 5)).toEqual([5, 10, 20]);
  });
  it("preenche variáveis da mensagem", () => {
    expect(fillTemplate("Olá, {nome}! Pedido #{pedido}", { nome: "Maria", pedido: "1258" })).toBe("Olá, Maria! Pedido #1258");
  });
});
