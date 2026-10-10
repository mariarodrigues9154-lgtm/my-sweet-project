import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getWhatsappRecovery, saveWhatsappRecovery, testWhatsappRecovery } from "@/lib/whatsapp-recovery.functions";

type Provider = "meta" | "zapi" | "evolution";
const VARS = ["{nome}", "{pedido}", "{produto}", "{valor}", "{pix}", "{link_pagamento}", "{nome_loja}"];
const STATUS: Record<string, string> = { enviada: "Enviada", nao_enviada: "Não enviada", falha: "Falha", processando: "Processando" };

export function StoreWhatsappRecovery({ storeId }: { storeId: string }) {
  const load = useServerFn(getWhatsappRecovery);
  const save = useServerFn(saveWhatsappRecovery);
  const test = useServerFn(testWhatsappRecovery);
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
  const [busy, setBusy] = useState("");

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
    try { const r = await test({ data: { store_id: storeId, phone: testPhone } }); r.ok ? toast.success(r.message) : toast.error(r.message); }
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
      </div>
      {provider === "meta" && <p className="mt-2 text-[11px] text-muted-foreground">Na API oficial a mensagem enviada é o modelo aprovado pela Meta; o texto abaixo é usado nas APIs Z-API/Evolution e como referência.</p>}

      <label className="mt-4 grid gap-1 text-[11.5px] font-semibold">Mensagem automática
        <textarea rows={6} className="rounded-lg border border-border bg-background px-3 py-2 font-normal" value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      <p className="mt-1 text-[11px] text-muted-foreground">Variáveis: {VARS.join("  ")}</p>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <Button onClick={onSave} disabled={!!busy}>{busy === "save" ? <Loader2 className="animate-spin" /> : "Salvar"}</Button>
        <div className="flex-1 min-w-[180px]"><Field label="Testar envio para o número" value={testPhone} placeholder="(85) 99999-9999" onChange={setTestPhone} /></div>
        <Button variant="outline" onClick={onTest} disabled={!!busy || !testPhone}>{busy === "test" ? <Loader2 className="animate-spin" /> : "Enviar teste"}</Button>
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
