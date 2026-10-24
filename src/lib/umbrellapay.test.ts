import { describe, expect, it } from "vitest";

import { mapUmbrellaStatus } from "@/lib/payments/providers.server";

describe("mapUmbrellaStatus", () => {
  it("reconhece pago em qualquer casing (postback usa minúsculo, API maiúsculo)", () => {
    expect(mapUmbrellaStatus("paid")).toBe("paid");
    expect(mapUmbrellaStatus("PAID")).toBe("paid");
  });

  it("mapeia pendente documentado (WAITING_PAYMENT) e variações", () => {
    expect(mapUmbrellaStatus("WAITING_PAYMENT")).toBe("pending");
    expect(mapUmbrellaStatus("waiting_payment")).toBe("pending");
    expect(mapUmbrellaStatus("pending")).toBe("pending");
    expect(mapUmbrellaStatus("PROCESSING")).toBe("pending");
  });

  it("mapeia recusa, estorno, contestação e expiração", () => {
    expect(mapUmbrellaStatus("REFUSED")).toBe("refused");
    expect(mapUmbrellaStatus("FAILED")).toBe("failed");
    expect(mapUmbrellaStatus("REFUNDED")).toBe("refunded");
    expect(mapUmbrellaStatus("CHARGEBACK")).toBe("chargeback");
    expect(mapUmbrellaStatus("EXPIRED")).toBe("expired");
    expect(mapUmbrellaStatus("CANCELLED")).toBe("expired");
  });

  it("status desconhecido vira unknown, nunca recusa", () => {
    expect(mapUmbrellaStatus("QUALQUER_COISA")).toBe("unknown");
    expect(mapUmbrellaStatus("")).toBe("unknown");
    expect(mapUmbrellaStatus(null)).toBe("unknown");
    expect(mapUmbrellaStatus(undefined)).toBe("unknown");
  });
});
