export type PlugSendResult = { ok: boolean; message: string; detail: string; httpStatus: number | null; messageId: string | null; testedAt: string };

export function PlugSendTestResult({ result }: { result: PlugSendResult | null }) {
  return <div className="space-y-1 text-[12px]" role="status" aria-live="polite">
    <p className="font-semibold">Status PlugSend: {!result ? "⚪ Não testado" : result.ok ? "🟢 Teste realizado com sucesso" : "🔴 Falha no teste"}</p>
    {result && <>
      <p>{result.ok ? "✅" : "❌"} {result.message}</p>
      {result.detail && <p className="text-muted-foreground">{result.detail}</p>}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
        {result.httpStatus !== null && <span>HTTP Status: {result.httpStatus}</span>}
        {result.messageId && <span className="break-all">ID da mensagem: {result.messageId}</span>}
        <span>Horário do teste: {new Date(result.testedAt).toLocaleString("pt-BR")}</span>
      </div>
    </>}
  </div>;
}