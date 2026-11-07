import { describe, expect, it } from "vitest";
import { ambiguousPixAttempt, permanentPixLock, pixCreationFilter } from "./pix-creation-policy";
import { pixAttemptProvider, pixRetryBlocked } from "../pix-attempt";

describe("VenusPay creation safety", () => {
  it("pins incomplete VenusPay creations even after a process interruption", () => {
    expect(ambiguousPixAttempt({ payment_provider: "venuspay", provider_status: "creating", transaction_id: null })).toBe(true);
    expect(ambiguousPixAttempt({ payment_provider: "venuspay", provider_status: "venuspay_uncertain", transaction_id: null })).toBe(true);
    expect(ambiguousPixAttempt({ payment_provider: "venuspay", provider_status: "pending", transaction_id: "tx1" })).toBe(false);
  });
  it("never uses an age-based reclaim for VenusPay", () => {
    expect(pixCreationFilter("venuspay", "2000-01-01")).toBe("provider_status.is.null,and(provider_status.neq.creating,provider_status.neq.venuspay_uncertain)");
    expect(permanentPixLock("venuspay")).toBe(true);
    expect(permanentPixLock("wappi")).toBe(false);
  });
  it("keeps the returned provider and retry block for checkout", () => {
    const failure = { provider: "venuspay", retry_blocked: true };
    expect(pixAttemptProvider(failure)).toBe("venuspay");
    expect(pixRetryBlocked(failure)).toBe(true);
    expect(pixRetryBlocked({ retry_blocked: false })).toBe(false);
  });
});