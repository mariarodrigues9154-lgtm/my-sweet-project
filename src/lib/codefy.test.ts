import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { mapCodefyStatus, verifyCodefySignature } from "./payments/providers.server";

describe("CodeFy", () => {
  it("só 'paid' é pago; status fora da doc vira unknown", () => {
    expect(mapCodefyStatus("paid")).toBe("paid");
    expect(mapCodefyStatus("pending")).toBe("pending");
    expect(mapCodefyStatus("approved")).toBe("unknown");
  });
  it("assinatura HMAC válida passa e inválida falha", async () => {
    const raw = '{"id":"x","status":"paid"}';
    const sig = "sha256=" + createHmac("sha256", "seg").update(raw).digest("hex");
    expect(await verifyCodefySignature(raw, sig, "seg")).toBe(true);
    expect(await verifyCodefySignature(raw, sig, "outra")).toBe(false);
  });
});
