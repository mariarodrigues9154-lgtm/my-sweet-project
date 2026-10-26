import { describe, expect, it } from "vitest";

import { shipmentMatchesQuery, type ShipmentSearchRow } from "./magnus-search";

const row: ShipmentSearchRow = {
  id: "3f2a1b4c-0000-4000-8000-000000000001",
  order_number: "20261026-24DVJ",
  customer: "Teresinha de Souza",
  phone: "+55 49 99999-9999",
  shipment: { tracking_code: "BR266XYZ789BR" },
};

describe("busca da lista de rastreamento", () => {
  it("encontra pelo nome, sem diferenciar maiúsculas", () => {
    expect(shipmentMatchesQuery(row, "Teresinha")).toBe(true);
    expect(shipmentMatchesQuery(row, "  teresinha  ")).toBe(true);
    expect(shipmentMatchesQuery(row, "TERESINHA DE SOUZA")).toBe(true);
    expect(shipmentMatchesQuery(row, "Teresina")).toBe(false);
  });

  it("encontra pelo telefone mesmo com máscara ou sem DDI", () => {
    expect(shipmentMatchesQuery(row, "49999999999")).toBe(true);
    expect(shipmentMatchesQuery(row, "(49) 99999-9999")).toBe(true);
    expect(shipmentMatchesQuery(row, "5549999999999")).toBe(true);
    expect(shipmentMatchesQuery(row, "99999")).toBe(true);
    expect(shipmentMatchesQuery(row, "49999998888")).toBe(false);
  });

  it("encontra pelo número do pedido e pelo ID", () => {
    expect(shipmentMatchesQuery(row, "20261026-24DVJ")).toBe(true);
    expect(shipmentMatchesQuery(row, "24dvj")).toBe(true);
    expect(shipmentMatchesQuery(row, "3f2a1b4c")).toBe(true);
    expect(shipmentMatchesQuery(row, "20261026-8U489")).toBe(false);
  });

  it("continua encontrando pelo código de rastreio", () => {
    expect(shipmentMatchesQuery(row, "br266xyz")).toBe(true);
    expect(shipmentMatchesQuery(row, "BR000")).toBe(false);
  });

  it("consulta vazia mantém todos os pedidos e texto sem relação não casa", () => {
    expect(shipmentMatchesQuery(row, "")).toBe(true);
    expect(shipmentMatchesQuery(row, "   ")).toBe(true);
    expect(shipmentMatchesQuery(row, "zzz-inexistente")).toBe(false);
  });

  it("ignora telefone quando o pedido não tem telefone cadastrado", () => {
    const noPhone = { ...row, phone: "" };
    expect(shipmentMatchesQuery(noPhone, "49999999999")).toBe(false);
    expect(shipmentMatchesQuery(noPhone, "Teresinha")).toBe(true);
  });
});
