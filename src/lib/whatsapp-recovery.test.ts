import { describe, expect, it } from "vitest";
import { DEFAULT_RECOVERY_MESSAGE, fillTemplate, normalizeBrPhone, recoveryText, reminderDelays } from "./whatsapp-recovery.server";

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
  it("mensagem de recuperação nunca leva link de pagamento", () => {
    const vars = { nome: "Maria", pedido: "1258", produto: "Pano", valor: "R$ 19,90", pix: "", nome_loja: "Dona de Casa" };
    const out = recoveryText("Oi {nome}, seu pix de {valor} está pendente. Acesse: {link_pagamento}", vars);
    expect(out).not.toContain("http");
    expect(out).not.toContain("{link_pagamento}");
    expect(out).toBe("Oi Maria, seu pix de R$ 19,90 está pendente. Acesse:");
  });
  it("modelo salvo da loja é enviado sem link", () => {
    const saved = "Olá, {nome}! Tudo bem?\n\nMeu nome é Jéssica, sou atendente da loja onde você gerou um Pix no valor de {valor}.\n\nVerifiquei aqui que o pagamento ainda não foi finalizado.";
    const out = recoveryText(saved, { nome: "Maria", pedido: "1258", produto: "Pano", valor: "R$ 117,90", pix: "", nome_loja: "Dona de Casa" });
    expect(out).not.toContain("http");
    expect(out).toContain("R$ 117,90");
  });
  it("mensagem padrão não tem link", () => {
    expect(DEFAULT_RECOVERY_MESSAGE).not.toContain("http");
    expect(recoveryText("", { nome: "Maria", pedido: "1", produto: "", valor: "R$ 1,00", pix: "", nome_loja: "" })).not.toContain("http");
  });
});
