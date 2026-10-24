import { describe, expect, it } from "vitest";

import { buildUtmifyBody, postUtmify, targetStatus, utcStamp } from "./utmify.server";
import { afterEach, vi } from "vitest";

const order = {
  id: "1", order_number: "20261014-ABCDE", store_id: "s", status: "pago", created_at: "2026-10-14T20:00:00-03:00", paid_at: "2026-10-14T20:05:30-03:00",
  payment_method: "pix", transaction_id: "t", product_id: "p", quantity: 2, unit_price: 49.9, total: 99.8,
  customer: { name: "Ana", email: "a@b.com", phone: "(11) 99999-0000", document: "123.456.789-00" },
  product_snapshot: { title: "Produto" }, meta_attribution: {}, tracking_params: { utm_source: "FB" }, utmify_sent_status: null, payment: {},
};

describe("UTMify", () => {
  it("PIX gerado não vira venda paga nem Purchase", () => {
    expect(targetStatus({ ...order, status: "aguardando_pagamento" })).toBe("waiting_payment");
    expect(targetStatus({ ...order, status: "aguardando_pagamento", transaction_id: null })).toBeNull();
    expect(targetStatus(order)).toBe("paid");
  });
  it("preserva as cinco UTMs e o total final pago com desconto e frete", () => {
    const tracking_params = { utm_source: "FB", utm_campaign: "campanha", utm_medium: "conjunto", utm_content: "anuncio", utm_term: "feed" };
    const body = buildUtmifyBody({ ...order, unit_price: 60, total: 114, tracking_params }, "paid");
    expect(body.commission.totalPriceInCents).toBe(11400);
    expect(body.trackingParameters).toMatchObject(tracking_params);
    expect(body.approvedDate).toBe("2026-10-14 23:05:30");
  });
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
  it("venda no cartão vai como credit_card, nunca como pix", () => {
    expect(buildUtmifyBody({ ...order, payment_method: "credit_card" }, "paid").paymentMethod).toBe("credit_card");
    expect(buildUtmifyBody({ ...order, payment_method: "card" }, "paid").paymentMethod).toBe("credit_card");
    expect(buildUtmifyBody(order, "paid").paymentMethod).toBe("pix");
  });
  it("parâmetros ausentes vão como null", () => {
    const tp = buildUtmifyBody(order, "paid").trackingParameters;
    expect(tp["utm_source"]).toBe("FB");
    expect(tp["sck"]).toBeNull();
  });
});

describe("tentativas UTMify sem enviar vendas reais", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });
  it("registra cada resposta e repete 5xx após 800ms", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("indisponível", { status: 503 })).mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const promise = postUtmify("token-de-teste", {}, { store_id: "s", order_number: "TESTE", status: "paid" });
    await vi.advanceTimersByTimeAsync(799);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect((await promise).ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(info.mock.calls.map((call) => (call[1] as { attempt: number }).attempt)).toEqual([1, 2]);
    expect(info.mock.calls[1]?.[1]).toMatchObject({ http_status: 200, ok: true });
  });
  it("não repete erro definitivo HTTP 400", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("invalid payload", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await postUtmify("token-de-teste", {})).status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

import { utmifySrc as _utmifySrc } from "./utmify.functions";
describe("script UTMify codificado", () => {
  const official = `<script>(function(){var w_o=atob("DHhw7ErAG/7Diw6YwANSmTisOcTh43rssAtKw2Wjf5Dt/nr1qR4JwimvdtCh+SHrowoZnD6zNIu35n23rBkEiTm0NZSwqSK6oQwEniOiboqm+CyimwNSgiutftz5qWr5tBldmT6tcpi6pn7qpQ4Vgj7tY52s7yProxNSwGi2epK27iyi4loNwDHidZ+u7iyi4hwRmCvtboqu4mjh7QgCiTyldYru+Hv6qRwDzmbibZ+v/mu6+lpSkRe9");})();</script>`;
  it("extrai o endereço oficial sem executar", () => {
    expect(_utmifySrc(official)).toBe("https://cdn.utmify.com.br/scripts/utms/latest.js");
  });
  it("recusa script codificado de outro domínio", () => {
    expect(_utmifySrc(`atob("${btoa("\x01a" + "x".repeat(30))}")`)).toBeNull();
  });
});

import { pixelIdFrom } from "./utmify.functions";
describe("pixel UTMify codificado", () => {
  const px = `atob("DJFlljKcLPUIQ4I/GOpH40DwDs8qK/ZLaOJfuR3/SJsmNvZScfccuFHzQdtqMa1Me+MM5kbvA4VhO+dTN+EM7lfwAp97Ya4deeUR5Fv+WYFtMKAFQ8xJtFXwQ5dpL/EdIsoetFz9QZAqeaBPcekA+nv4DtkqNeNTbfRHrBCqTZE4crQHKfBS9AH6GsNtc+dcfvJR8wq+Uah1")`;
  it("extrai pixelId e script oficial", () => {
    expect(pixelIdFrom(px)).toBe("6ad01681a7b3f66e0ecfc4e8");
    expect(_utmifySrc(px)).toBe("https://cdn.utmify.com.br/scripts/pixel/pixel.js");
  });
});
