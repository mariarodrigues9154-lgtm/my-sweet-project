import { describe, expect, it } from "vitest";

import { buildUtmifyBody, utcStamp } from "./utmify.server";

const order = {
  id: "1", order_number: "20261014-ABCDE", store_id: "s", status: "pago", created_at: "2026-10-14T20:00:00-03:00", paid_at: "2026-10-14T20:05:30-03:00",
  payment_method: "pix", transaction_id: "t", product_id: "p", quantity: 2, unit_price: 49.9, total: 99.8,
  customer: { name: "Ana", email: "a@b.com", phone: "(11) 99999-0000", document: "123.456.789-00" },
  product_snapshot: { title: "Produto" }, meta_attribution: {}, tracking_params: { utm_source: "FB" }, utmify_sent_status: null, payment: {},
};

describe("UTMify", () => {
  it("datas em UTC 0 no formato YYYY-MM-DD HH:MM:SS", () => {
    expect(utcStamp("2026-10-14T20:00:00-03:00")).toBe("2026-10-14 23:00:00");
  });
  it("valores em centavos e approvedDate só quando pago", () => {
    const paid = buildUtmifyBody(order, "paid");
    expect(paid.commission.totalPriceInCents).toBe(9980);
    expect(paid.products[0]!.priceInCents).toBe(4990);
    expect(paid.approvedDate).toBe("2026-10-14 23:05:30");
    expect(buildUtmifyBody(order, "waiting_payment").approvedDate).toBeNull();
  });
  it("parâmetros ausentes vão como null", () => {
    const tp = buildUtmifyBody(order, "paid").trackingParameters;
    expect(tp["utm_source"]).toBe("FB");
    expect(tp["sck"]).toBeNull();
  });
});
