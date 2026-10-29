import { normalizeBrPhone } from "./whatsapp-recovery.server";

// Provider responses may echo credentials or customer data: redact before logging.
function safeResponse(raw: string, token: string): unknown {
  const cleaned = raw.split(token).join("[redacted]");
  try {
    const redact = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(redact);
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /token|secret|authorization|apikey|api_key|number|phone|text|content|jid/i.test(key) ? "[redacted]" : redact(item)]));
      return value;
    };
    return redact(JSON.parse(cleaned));
  } catch {
    return "Resposta não JSON omitida por segurança.";
  }
}

/** Test-only send: never changes settings, orders or reminder history. */
export async function sendPlugSendTest(input: { storeId: string; phone: string; message: string; token: string }) {
  const failure = { ok: false, message: "Não foi possível enviar a mensagem." };
  const number = normalizeBrPhone(input.phone);
  if (!number || !input.message.trim() || !input.token) return failure;
  try {
    const response = await fetch("https://plugsend.uazapi.com/send/text", {
      method: "POST",
      headers: { "Content-Type": "application/json", token: input.token },
      body: JSON.stringify({ number, text: input.message, linkPreview: true }),
      signal: AbortSignal.timeout(20000),
    });
    const raw = await response.text();
    if (!response.ok) {
      console.error("[PlugSend test]", { store_id: input.storeId, http_status: response.status, response: safeResponse(raw, input.token) });
      return failure;
    }
    return { ok: true, message: "Mensagem de teste enviada com sucesso." };
  } catch {
    console.error("[PlugSend test]", { store_id: input.storeId, http_status: null, response: "Falha de rede ou tempo limite." });
    return failure;
  }
}