import { afterEach, describe, expect, it, vi } from "vitest";
import { sendPlugSendTest } from "./plugsend-test.server";

const input = { storeId: "store-test", phone: "(94) 99999-9999", message: "Teste real", token: "test-fixture-only" };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("teste isolado PlugSend", () => {
  it("envia texto livre ao destinatário normalizado no endpoint documentado", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await sendPlugSendTest(input)).ok).toBe(true);
    const [url, options] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://plugsend.uazapi.com/send/text");
    expect(options.method).toBe("POST");
    expect(options.headers).toEqual({ "Content-Type": "application/json", token: input.token });
    expect(JSON.parse(options.body)).toEqual({ number: "5594999999999", text: "Teste real", linkPreview: true });
  });
  it("não duplica DDI já informado", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal("fetch", fetchMock);
    await sendPlugSendTest({ ...input, phone: "+55 (94) 99999-9999" });
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body).number).toBe("5594999999999");
  });
  it("não envia número inválido ou mensagem vazia", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect((await sendPlugSendTest({ ...input, phone: "123" })).ok).toBe(false);
    expect((await sendPlugSendTest({ ...input, message: " " })).ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("mostra HTTP 401 útil sem expor token no resultado ou nos logs", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "recusado", token: input.token, detail: input.token }), { status: 401 })));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await sendPlugSendTest(input);
    expect(result.ok).toBe(false);
    expect(result.httpStatus).toBe(401);
    expect(result.detail).toContain("Token inválido");
    expect(JSON.stringify(result)).not.toContain(input.token);
    expect(log.mock.calls[0]?.[1]).toEqual({ store_id: "store-test", http_status: 401, response: { error: "recusado", token: "[redacted]", detail: "[redacted]" } });
  });
  it("falha de rede não repete envio", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network")); vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await sendPlugSendTest(input)).ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("retorna ID e horário do envio aceito", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"messageid":"MSG_123"}', { status: 201 })));
    const result = await sendPlugSendTest(input);
    expect(result.ok).toBe(true);
    expect(result.httpStatus).toBe(201);
    expect(result.messageId).toBe("MSG_123");
    expect(Number.isNaN(Date.parse(result.testedAt))).toBe(false);
  });
  it("preserva texto exato de recuperação incluindo variáveis e espaços", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal("fetch", fetchMock);
    const message = "  Oi, {nome}!\nPIX pendente #{pedido}\n{pix}  ";
    await sendPlugSendTest({ ...input, message });
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body).text).toBe(message);
  });
  it("indisponibilidade HTTP 500 retorna falha sem repetir envio", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('unavailable', { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await sendPlugSendTest(input);
    expect(result.ok).toBe(false);
    expect(result.httpStatus).toBe(500);
    expect(result.detail).toContain("indisponível");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("timeout retorna diagnóstico sem repetir", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException("fixture", "TimeoutError"));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await sendPlugSendTest(input)).detail).toContain("Timeout");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("não aceita rejeição no corpo mesmo com HTTP 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"success":false,"error":"rejected"}')));
    expect((await sendPlugSendTest(input)).ok).toBe(false);
  });
  it("não devolve ID contendo token ou conteúdo arbitrário", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: input.token }))));
    expect((await sendPlugSendTest(input)).messageId).toBeNull();
  });
});