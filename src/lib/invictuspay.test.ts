import { describe, expect, it } from "vitest";
import { mapInvictusStatus } from "./payments/providers.server";
import { maskSecret } from "./payments/catalog";

describe("InvictusPay", () => {
  it("só 'paid' vira pago; pending não", () => {
    expect(mapInvictusStatus("paid")).toBe("paid");
    expect(mapInvictusStatus("pending")).toBe("pending");
    expect(mapInvictusStatus("EXPIRED")).toBe("expired");
    expect(mapInvictusStatus("aprovado")).toBe("unknown");
  });
  it("máscara mostra só os 4 últimos", () => {
    expect(maskSecret("sk_abcdefghijkl1234")).toBe("sk_••••••••••••1234");
  });
});
