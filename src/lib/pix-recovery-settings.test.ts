import { expect, test } from "vitest";
import { resolvePixRecovery } from "./product-types";
test("default on", () => expect(resolvePixRecovery(undefined).show_notice).toBe(true));
test("master off disables all", () => { const r = resolvePixRecovery({ enabled: false }); expect([r.show_notice, r.allow_copy, r.allow_chat, r.show_badge]).toEqual([false,false,false,false]); });
test("notice off, chat on", () => { const r = resolvePixRecovery({ show_notice: false }); expect(r.show_notice).toBe(false); expect(r.allow_chat).toBe(true); });
