/** Filtro da busca na lista "Pedidos pagos" do painel Magnus Frete. */
export type ShipmentSearchRow = {
  id: string;
  order_number: string;
  customer: string;
  phone: string;
  shipment: { tracking_code: string | null } | null;
};

const digits = (v: string) => v.replace(/\D/g, "");

/**
 * Busca por nome do cliente, telefone (só dígitos, tolera máscara),
 * número/ID do pedido ou código de rastreio. Case-insensitive.
 * Consulta vazia mantém todos os pedidos.
 */
export function shipmentMatchesQuery(row: ShipmentSearchRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const qd = digits(q);
  return row.customer.toLowerCase().includes(q)
    || row.order_number.toLowerCase().includes(q)
    || row.id.toLowerCase().includes(q)
    || (row.shipment?.tracking_code ?? "").toLowerCase().includes(q)
    || (qd.length >= 2 && digits(row.phone).includes(qd));
}
