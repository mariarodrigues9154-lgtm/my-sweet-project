import { describe, expect, it } from "vitest";
import { buildMagnusBody, postMagnus } from "./magnus.server";

const order = { id: "1", order_number: "N1", store_id: "s", status: "pago", quantity: 2, unit_price: 49.9, total: 99.8,
  customer: { name: "Ana", email: "a@b.com", phone: "(11) 99999-0000", document: "123.456.789-00" },
  address: { cep: "01001-000", city: "São Paulo", state: "sp", number: "1", street: "Rua X", district: "Centro", complement: "" },
  product_snapshot: { title: "Produto" } };
const fake = (status: number, body: string) => (async () => new Response(body, { status })) as unknown as typeof fetch;

describe("Magnus Frete", () => {
  it("monta payload com obrigatórios, endereço e valores em reais", () => {
    const b = buildMagnusBody(order) as any;
    expect(b.customer).toEqual({ name: "Ana", email: "a@b.com", document: "12345678900", phone: "11999990000" });
    expect(b.items).toEqual([{ name: "Produto", quantity: 2, price: 49.9 }]);
    expect(b.total).toBe(99.8);
    expect(b.address.zipcode).toBe("01001000");
    expect(b.address.state).toBe("SP");
  });
  it("201 com código = sucesso", async () => {
    const r = await postMagnus("t", {}, fake(201, '{"success":true,"codigo_rastreio":"BR1A","pedido_id":"p","envio_id":"e"}'));
    expect(r).toMatchObject({ kind: "ok", tracking: "BR1A" });
  });
  it("401/422 = recusado (seguro tentar de novo), 500 = incerto (não reenvia sozinho)", async () => {
    expect((await postMagnus("t", {}, fake(401, "{}"))).kind).toBe("rejected");
    expect((await postMagnus("t", {}, fake(422, '{"details":["x"]}'))).kind).toBe("rejected");
    expect((await postMagnus("t", {}, fake(500, ""))).kind).toBe("uncertain");
    expect((await postMagnus("t", {}, (async () => { throw new Error("x"); }) as never)).kind).toBe("uncertain");
  });
});
