import { describe, expect, it } from "vitest";
import { parseGatewayDate } from "./pix-time";

describe("parseGatewayDate", () => {
  it("data sem fuso é horário de Brasília", () => {
    expect(parseGatewayDate("2026-10-12T14:15:00")).toBe(Date.parse("2026-10-12T17:15:00Z"));
  });
  it("respeita fuso explícito", () => {
    expect(parseGatewayDate("2026-10-12T14:15:00Z")).toBe(Date.parse("2026-10-12T14:15:00Z"));
  });
  it("Unix em segundos vira milissegundos", () => {
    expect(parseGatewayDate(1760000000)).toBe(1760000000000);
  });
});
