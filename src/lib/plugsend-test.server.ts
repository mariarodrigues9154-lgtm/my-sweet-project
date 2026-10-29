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
  const result = (ok: boolean, detail: string, httpStatus: number | null = null, messageId: string | null = null) => ({
    ok, message: ok ? "Mensagem enviada com sucesso pela PlugSend." : "Falha ao enviar mensagem pela PlugSend.",
    detail, httpStatus, messageId, testedAt: new Date().toISOString(),
  });
  const number = normalizeBrPhone(input.phone);
  if (!number) return result(false, "Número inválido. Informe DDD e número brasileiro.");
  if (!input.message.trim()) return result(false, "Mensagem vazia.");
  if (!input.token) return result(false, "Token PlugSend não salvo nesta loja.");
  try {
    const response = await fetch("https://plugsend.uazapi.com/send/text", {
      method: "POST",
      headers: { "Content-Type": "application/json", token: input.token },
      body: JSON.stringify({ number, text: input.message, linkPreview: true }),
      signal: AbortSignal.timeout(20000),
    });
    const raw = await response.text();
    let payload: Record<string, unknown> = {};
    try { const parsed: unknown = JSON.parse(raw); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed as Record<string, unknown>; } catch { /* Some accepted responses have no JSON body. */ }
    if (!response.ok) {
      console.error("[PlugSend test]", { store_id: input.storeId, http_status: response.status, response: safeResponse(raw, input.token) });
      const detail = response.status === 401 || response.status === 403 ? "Token inválido ou sem autorização." : response.status === 400 ? "Resposta rejeitada pela PlugSend. Confira número e mensagem." : response.status === 429 ? "Limite de envios atingido." : response.status >= 500 ? "PlugSend indisponível." : "Resposta rejeitada pela PlugSend.";
      return result(false, `Erro HTTP ${response.status}: ${detail}`, response.status);
    }
    if (payload["error"] || payload["success"] === false || payload["ok"] === false) return result(false, "Resposta rejeitada pela PlugSend.", response.status);
    const id = payload["messageid"] ?? payload["messageId"] ?? payload["id"];
    // Only an opaque identifier can cross to the browser, never raw provider data.
    const messageId = typeof id === "string" && /^[a-zA-Z0-9_.:-]{1,200}$/.test(id) && !id.includes(input.token) ? id : null;
    return result(true, "", response.status, messageId);
  } catch (error) {
    console.error("[PlugSend test]", { store_id: input.storeId, http_status: null, response: "Falha de rede ou tempo limite." });
    return result(false, error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name) ? "Timeout: a PlugSend não respondeu em até 20 segundos. O envio não foi repetido." : "Não foi possível acessar a PlugSend. O envio não foi repetido.");
  }
}