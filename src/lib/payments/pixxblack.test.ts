import { describe, expect, it } from "vitest";
import {
  mapPixxblackStatus,
  parsePixxblackCharge,
  pixxblackIdempotencyKey,
  pixxblackPayload,
  verifyPixxblackSignature,
} from "./pixxblack.server";
import type { PixChargeInput } from "./providers.server";

const input: PixChargeInput = {
  orderNumber: "20261030-ABC12",
  amount: 119.9,
  description: "Pedido 20261030-ABC12",
  customer: { name: "Maria Silva", email: "maria@exemplo.com", document: "123.456.789-09", phone: "(11) 98888-7777" },
};

describe("pixxblackPayload", () => {
  it("monta o corpo documentado: centavos, descrição, referência e pagador", () => {
    const p = pixxblackPayload({ ...input, amountCents: 11990 });
    expect(p).toEqual({
      amount_cents: 11990,
      description: "Pedido 20261030-ABC12",
      external_reference: "20261030-ABC12",
      payer: { name: "Maria Silva", email: "maria@exemplo.com", document: "12345678909" },
    });
  });

  it("recusa valor abaixo do mínimo de R$ 5,00", () => {
    expect(() => pixxblackPayload({ ...input, amountCents: 499 })).toThrow(/R\$ 5,00/);
  });

  it("omite documento fora de CPF/CNPJ e corta descrição em 140 caracteres", () => {
    const p = pixxblackPayload({ ...input, customer: { ...input.customer, document: "123" }, description: "x".repeat(200) });
    expect(p.payer).not.toHaveProperty("document");
    expect(p.description).toHaveLength(140);
  });
});

describe("pixxblackIdempotencyKey", () => {
  it("mantém o número do pedido quando já é válido", () => {
    expect(pixxblackIdempotencyKey("20261030-ABC12")).toBe("20261030-ABC12");
  });

  it("substitui caracteres fora de [A-Za-z0-9_-] e garante o mínimo de 8", () => {
    expect(pixxblackIdempotencyKey("ped 1/2")).toBe("ped-1-20");
    expect(pixxblackIdempotencyKey("ab")).toBe("pix-ab00");
  });
});

describe("mapPixxblackStatus", () => {
  it("mapeia somente os status documentados", () => {
    expect(mapPixxblackStatus("pending")).toBe("pending");
    expect(mapPixxblackStatus("paid")).toBe("paid");
    expect(mapPixxblackStatus("expired")).toBe("expired");
    expect(mapPixxblackStatus("canceled")).toBe("canceled");
    expect(mapPixxblackStatus("refunded")).toBe("refunded");
    expect(mapPixxblackStatus("PAID")).toBe("paid");
    expect(mapPixxblackStatus("qualquer-outro")).toBe("unknown");
  });
});

describe("parsePixxblackCharge", () => {
  const charge = {
    id: "8d3f6a12-4b9e-4c71-a2d5-6e0f1b3c9a47",
    status: "pending",
    amount_cents: 11990,
    pix: { copy_paste: "00020126...6304ABCD", expires_at: "2026-10-30T10:10:00.000Z" },
    paid_at: null,
    end_to_end_id: null,
  };

  it("aceita a resposta 201 documentada e calcula a expiração", () => {
    const r = parsePixxblackCharge(charge);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.transaction_id).toBe(charge.id);
      expect(r.copy_paste).toBe("00020126...6304ABCD");
      expect(r.expiration_date).toBe("2026-10-30T10:10:00.000Z");
      expect(r.provider_status).toBe("pending");
    }
  });

  it("marca como incerta uma resposta sem copia-e-cola válido (não libera nova tentativa)", () => {
    const r = parsePixxblackCharge({ id: "x", status: "pending", pix: { copy_paste: "invalido", expires_at: "2026-10-30T10:10:00.000Z" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.uncertain).toBe(true);
  });
});

describe("verifyPixxblackSignature", () => {
  const secret = "whsec_teste_123";
  const raw = JSON.stringify({ id: "evt_1", type: "charge.paid", data: { charge_id: "c1" } });

  async function sign(t: number, body: string, key: string): Promise<string> {
    const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${t}.${body}`)));
    return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  it("aceita assinatura válida dentro da tolerância de 300s", async () => {
    const t = 1793315112;
    const v1 = await sign(t, raw, secret);
    expect(await verifyPixxblackSignature(raw, `t=${t},v1=${v1}`, secret, t + 120)).toBe(true);
  });

  it("recusa segredo errado, timestamp antigo e header malformado", async () => {
    const t = 1793315112;
    const v1 = await sign(t, raw, secret);
    expect(await verifyPixxblackSignature(raw, `t=${t},v1=${v1}`, "whsec_outro", t)).toBe(false);
    expect(await verifyPixxblackSignature(raw, `t=${t},v1=${v1}`, secret, t + 301)).toBe(false);
    expect(await verifyPixxblackSignature(raw, "lixo", secret, t)).toBe(false);
    expect(await verifyPixxblackSignature(raw, null, secret, t)).toBe(false);
  });
});
