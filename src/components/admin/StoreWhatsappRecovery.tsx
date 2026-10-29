import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PlugSendTestResult, type PlugSendResult } from "./PlugSendTestResult";
import { getWhatsappRecovery, saveWhatsappRecovery, testWhatsappConnection, testWhatsappRecovery, testPlugSendMessage } from "@/lib/whatsapp-recovery.functions";

type Provider = "meta" | "zapi" | "evolution" | "plugsend";
const VARS = ["{nome}", "{pedido}", "{produto}", "{valor}", "{pix}", "{link_pagamento}", "{nome_loja}"];
const STATUS: Record<string, string> = { enviada: "Enviada", nao_enviada: "Não enviada", falha: "Falha", processando: "Processando" };

export function StoreWhatsappRecovery({ storeId }: { storeId: string }) {
  const load = useServerFn(getWhatsappRecovery);
  const save = useServerFn(saveWhatsappRecovery);
  const test = useServerFn(testWhatsappRecovery);
  const testPlugSend = useServerFn(testPlugSendMessage);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-wa", storeId], queryFn: () => load({ data: { store_id: storeId } }) });
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<Provider>("meta");
  const [sender, setSender] = useState("");
  const [message, setMessage] = useState("");
  const [delays, setDelays] = useState([15, 60, 180]);
  const [max, setMax] = useState(1);
  const [pub, setPub] = useState<Record<string, string>>({});
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [testPhone, setTestPhone] = useState("");
  const [testKind, setTestKind] = useState<"pending" | "paid">("pending");
  const [testMessage, setTestMessage] = useState("Olá! Esta é uma mensagem de teste da integração PlugSend.");
  const [testResult, setTestResult] = useState<PlugSendResult | null>(null);
  const [manualPhone, setManualPhone] = useState("");
  const [manualResults, setManualResults] = useState<Record<string, PlugSendResult>>({});
  const checkConn = useServerFn(testWhatsappConnection);
  const [conn, setConn] = useState<{ connected: boolean | null; message: string } | null>(null);
  const [busy, setBusy] = useState("");

  useEffect(() => { setTestResult(null); setManualResults({}); setConn(null); }, [storeId, provider, secrets]);

  useEffect(() => {
    if (!data) return;
    const s = data.settings;
    setEnabled(s.enabled); setProvider(s.provider as Provider); setSender(s.sender); setMessage(s.message);
    setDelays(s.delays); setMax(s.max_reminders); setPub(s.public_data); setSecrets({});
  }, [data]);

  const P = (k: string) => pub[k] ?? "";
  const setP = (k: string) => (v: string) => setPub((x) => ({ ...x, [k]: v }));
  const S = (k: string, label: string) => (
    <Field label={`${label}${data?.settings.secrets_set[k] ? " (salvo — deixe vazio para manter)" : ""}`} type="password" value={secrets[k] ?? ""} placeholder={data?.settings.secrets_set[k] ? "••••••••••••" : ""} onChange={(v) => setSecrets((x) => ({ ...x, [k]: v }))} />
  );

  async function onSave() {
    setTestResult(null); setManualResults({});
    setBusy("save");
    try {
      const r = await save({ data: { store_id: storeId, enabled, provider, sender, message, delays, max_reminders: max, public_data: pub, secrets: secrets as never } });
      if (!r.ok) toast.error(r.error); else { toast.success("Recuperação via WhatsApp salva."); await refetch(); }
    } catch (e) {
      toast.error("Não foi possível salvar. Confira os campos e tente novamente.");
      console.error(e);
    } finally { setBusy(""); }
  }
  async function onTest() {
    setBusy("test");
    try {
      const r = await test({ data: { store_id: storeId, phone: testPhone, kind: testKind } });
      if (r.ok) { toast.success(r.message); }
      else toast.error(r.message);
    } catch { toast.error("Não foi possível enviar a mensagem."); }
    finally { setBusy(""); }
  }

  const canTestPlugSend = provider === "plugsend" && data?.settings.provider === "plugsend" && !!data?.settings.secrets_set["plugsend_token"];
  async function onPlugSendTest(key = "free", text = testMessage, phone = testPhone) {
    setBusy(key);
    let result: PlugSendResult;
    try { result = await testPlugSend({ data: { store_id: storeId, phone, message: text } }); }
    catch { result = { ok: false, message: "Falha ao enviar mensagem pela PlugSend.", detail: "Não foi possível concluir o teste. Tente novamente.", httpStatus: null, messageId: null, testedAt: new Date().toISOString() }; }
    setTestResult(result);
    if (key !== "free") setManualResults((previous) => ({ ...previous, [key]: result }));
    if (result.ok) toast.success(result.message); else toast.error(result.message);
    setBusy("");
  }
  function manualTest(key: string, text: string) {
    return provider === "plugsend" && <div className="mt-2 space-y-2">
      <Button variant="outline" onClick={() => onPlugSendTest(key, text, manualPhone)} disabled={!!busy || !canTestPlugSend || !manualPhone.trim() || !text.trim()}>{busy === key ? <><Loader2 className="animate-spin" />Enviando...</> : "ENVIAR TESTE DESTA MENSAGEM"}</Button>
      {manualResults[key] && <PlugSendTestResult result={manualResults[key]} />}
    </div>;
  }

  async function onConn() {
    setBusy("conn");
    try { setConn(await checkConn({ data: { store_id: storeId } })); } catch { setConn({ connected: false, message: "Falha ao testar." }); }
    finally { setBusy(""); }
  }

  return <section className="rounded-xl bg-card p-4 shadow-card-soft">
    <h2 className="text-[15px] font-extrabold">Recuperação de PIX pendente via WhatsApp</h2>
    <p className="mt-1 text-[11.5px] text-muted-foreground">Configuração exclusiva desta loja. Antes de cada envio o status real do pagamento é conferido; pedido pago não recebe mensagem.</p>
    {isLoading ? <div className="grid place-items-center py-6"><Loader2 className="animate-spin text-muted-foreground" /></div> : <>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[["PIX pendentes hoje", data?.summary.pending], ["Mensagens enviadas", data?.summary.sent], ["Pagos após a mensagem", data?.summary.recovered]].map(([l, v]) => (
          <div key={l as string} className="rounded-lg bg-surface p-2.5"><p className="text-[20px] font-extrabold tnum">{v ?? 0}</p><p className="text-[11px] text-muted-foreground">{l}</p></div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[11.5px] font-semibold sm:col-span-2"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />Ativar mensagens automáticas para PIX pendente</label>
        <label className="grid gap-1 text-[11.5px] font-semibold">Quantidade máxima de lembretes
          <select className="rounded-lg border border-border bg-background px-3 py-2" value={max} onChange={(e) => setMax(Number(e.target.value))}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select>
        </label>
        {Array.from({ length: max }, (_, i) => (
          <Field key={i} label={`${i + 1}º lembrete — enviar após (minutos)`} type="number" value={String(delays[i])} onChange={(v) => setDelays((d) => d.map((x, j) => (j === i ? Math.max(1, Number(v) || 1) : x)))} />
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">O PIX vale 15 minutos. Lembretes depois disso levam o cliente a uma página para gerar uma nova cobrança (nenhum PIX é criado sem o clique dele).</p>

      <h3 className="mt-5 text-[13px] font-extrabold">Integração WhatsApp</h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-[11.5px] font-semibold">Provedor
          <select className="rounded-lg border border-border bg-background px-3 py-2" value={provider} onChange={(e) => setProvider(e.target.value as Provider)}>
            <option value="meta">WhatsApp Business (oficial Meta)</option>
            <option value="zapi">Z-API</option>
            <option value="evolution">Evolution API</option>
            <option value="plugsend">PlugSend</option>
          </select>
        </label>
        <Field label="Número/remetente (referência)" value={sender} placeholder="5585999999999" onChange={setSender} />
        {provider === "meta" && <>
          <Field label="ID do número (Phone Number ID)" value={P("phone_number_id")} onChange={setP("phone_number_id")} />
          {S("access_token", "Token de acesso")}
          <Field label="Nome do modelo aprovado" value={P("template_name")} placeholder="pix_pendente" onChange={setP("template_name")} />
          <Field label="Idioma do modelo" value={P("template_lang") || "pt_BR"} onChange={setP("template_lang")} />
          <Field label="Variáveis do modelo, em ordem ({{1}}, {{2}}...)" value={P("template_vars") || "nome,pedido,valor"} onChange={setP("template_vars")} />
          <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[11.5px] font-semibold"><input type="checkbox" checked={P("template_button") === "true"} onChange={(e) => setP("template_button")(String(e.target.checked))} />Modelo tem botão "PAGAR COM PIX" (URL termina em /pix/{"{{1}}"})</label>
        </>}
        {provider === "zapi" && <>
          <Field label="ID da instância" value={P("instance_id")} onChange={setP("instance_id")} />
          {S("instance_token", "Token da instância")}
          {S("client_token", "Client-Token (segurança da conta)")}
        </>}
        {provider === "evolution" && <>
          <Field label="URL do servidor (https://...)" value={P("base_url")} onChange={setP("base_url")} />
          <Field label="Nome da instância" value={P("instance")} onChange={setP("instance")} />
          {S("api_key", "API key")}
        </>}
        {provider === "plugsend" && <>
          {S("plugsend_token", "Token PlugSend")}
          <p className="text-[11px] text-muted-foreground sm:col-span-2">O token fica salvo só no servidor e nunca aparece na página da loja. O envio usa a instância já conectada na sua conta PlugSend.</p>
        </>}
      </div>
      {provider === "plugsend" ? <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <h3 className="text-[13px] font-extrabold sm:col-span-2">TESTAR INTEGRAÇÃO PLUGSEND</h3>
        <Field label="Número que receberá o teste" value={testPhone} placeholder="(94) 99999-9999" onChange={setTestPhone} />
        <label className="grid gap-1 text-[11.5px] font-semibold">Mensagem
          <textarea rows={3} maxLength={2000} className="rounded-lg border border-border bg-background px-3 py-2 font-normal" value={testMessage} onChange={(e) => setTestMessage(e.target.value)} />
        </label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <Button variant="outline" onClick={() => onPlugSendTest()} disabled={!!busy || !testPhone.trim() || !testMessage.trim() || !canTestPlugSend}>{busy === "free" ? <><Loader2 className="animate-spin" />Enviando...</> : "ENVIAR TESTE"}</Button>
        </div>
        {!canTestPlugSend && <p className="text-[12px] text-muted-foreground sm:col-span-2">Salve PlugSend e o token nesta loja antes de testar.</p>}
        <div className="sm:col-span-2"><PlugSendTestResult result={testResult} /></div>
      </div> : <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
        <span className="font-bold">Status do WhatsApp:</span>
        <span>{!conn ? "não verificado" : conn.connected === true ? "🟢 Conectado" : conn.connected === false ? "🔴 Desconectado" : "—"}</span>
        <Button size="sm" variant="outline" onClick={onConn} disabled={!!busy}>{busy === "conn" ? <Loader2 className="animate-spin" /> : "Testar conexão"}</Button>
        {conn && <span className="text-muted-foreground">{conn.message}</span>}
      </div>}
      {provider === "meta" && <p className="mt-2 text-[11px] text-muted-foreground">Na API oficial a mensagem enviada é o modelo aprovado pela Meta; o texto abaixo é usado nas APIs Z-API/Evolution e como referência.</p>}

      <label className="mt-4 grid gap-1 text-[11.5px] font-semibold">Mensagem automática
        <textarea rows={6} className="rounded-lg border border-border bg-background px-3 py-2 font-normal" value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      <p className="mt-1 text-[11px] text-muted-foreground">Variáveis: {VARS.join("  ")}</p>
      <h3 className="mt-5 text-[13px] font-extrabold">Mensagens do WhatsApp (envio manual)</h3>
      {provider === "plugsend" && <div className="mt-2"><Field label="Número para receber" value={manualPhone} placeholder="(94) 99999-9999" onChange={setManualPhone} /></div>}
      <label className="mt-2 grid gap-1 text-[11.5px] font-semibold">Mensagem 1 — PIX pendente
        <textarea rows={6} maxLength={2000} className="rounded-lg border border-border bg-background px-3 py-2 font-normal" value={P("manual_message")} placeholder="Vazio = usa a mensagem automática" onChange={(e) => setP("manual_message")(e.target.value)} />
      </label>
      {manualTest("pending", P("manual_message") || message)}
      <label className="mt-3 grid gap-1 text-[11.5px] font-semibold">Mensagem 2 — Pagamento confirmado
        <textarea rows={6} maxLength={2000} className="rounded-lg border border-border bg-background px-3 py-2 font-normal" value={P("paid_message")} placeholder={"Olá, {nome}! ✅\nRecebemos o pagamento do seu pedido #{pedido} com sucesso!\nValor: {valor}\nObrigado pela compra! 💚"} onChange={(e) => setP("paid_message")(e.target.value)} />
      </label>
      {manualTest("paid", P("paid_message"))}
      <p className="mt-1 text-[11px] text-muted-foreground">Variáveis: {VARS.join("  ")}</p>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <Button onClick={onSave} disabled={!!busy}>{busy === "save" ? <Loader2 className="animate-spin" /> : "Salvar"}</Button>
        {provider !== "plugsend" && <><div className="flex-1 min-w-[180px]"><Field label="Testar envio para o número" value={testPhone} placeholder="(85) 99999-9999" onChange={setTestPhone} /></div>
        <select className="rounded-lg border border-border bg-background px-3 py-2 text-[12px]" value={testKind} onChange={(e) => setTestKind(e.target.value as never)}><option value="pending">PIX pendente</option><option value="paid">Pedido pago</option></select>
        <Button variant="outline" onClick={onTest} disabled={!!busy || !testPhone}>{busy === "test" ? <Loader2 className="animate-spin" /> : "Enviar teste"}</Button></>}
      </div>

      <h3 className="mt-5 text-[13px] font-extrabold">Histórico de mensagens</h3>
      <div className="mt-2 space-y-1.5">
        {data?.logs.map((l) => (
          <div key={l.id} className="rounded-lg bg-surface p-2.5 text-[11.5px]">
            <div className="flex justify-between gap-2 font-bold"><span>Pedido #{l.order_number} · {l.step}º lembrete</span><span>{new Date(l.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span></div>
            <p className="text-muted-foreground">Cliente: {l.customer || "—"} · WhatsApp: {l.phone} · PIX: {l.pix_status ?? "—"}</p>
            <p className="font-semibold">{STATUS[l.status] ?? l.status}{l.detail ? ` — ${l.detail}` : ""}</p>
          </div>
        ))}
        {!data?.logs.length && <p className="text-[11.5px] text-muted-foreground">Nenhuma mensagem ainda.</p>}
      </div>
    </>}
  </section>;
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return <label className="grid gap-1 text-[11.5px] font-semibold">{label}<input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 font-normal" /></label>;
}
