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
  it("registra status e resposta sanitizada sem devolver diagnóstico ao navegador", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "recusado", token: input.token, detail: input.token }), { status: 401 })));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await sendPlugSendTest(input)).ok).toBe(false);
    expect(log.mock.calls[0]?.[1]).toEqual({ store_id: "store-test", http_status: 401, response: { error: "recusado", token: "[redacted]", detail: "[redacted]" } });
  });
  it("falha de rede não repete envio", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network")); vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await sendPlugSendTest(input)).ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});