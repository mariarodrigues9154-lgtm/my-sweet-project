import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { emptyDraft, readDraft, writeDraft, type CheckoutDraft } from "@/lib/checkout-store";
import { digits, isValidCep, isValidCpfCnpj, isValidEmail, isValidPhone, maskCep, maskDocument, maskPhone } from "@/lib/format";

export const Route = createFileRoute("/pagamento-2-endereco")({
  head: () => ({ meta: [
    { title: "Adicionar endereço | Checkout" },
    { name: "description", content: "Cadastre o endereço de entrega do seu pedido." },
    { property: "og:title", content: "Adicionar endereço" },
    { property: "og:description", content: "Cadastre o endereço de entrega do seu pedido." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: AddressPage,
});

function AddressPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<CheckoutDraft>(emptyDraft);
  const [isDefault, setIsDefault] = useState(true);
  useEffect(() => setForm(readDraft() ?? emptyDraft), []);
  const customer = (patch: Partial<CheckoutDraft["customer"]>) => setForm((v) => ({ ...v, customer: { ...v.customer, ...patch } }));
  const address = (patch: Partial<CheckoutDraft["address"]>) => setForm((v) => ({ ...v, address: { ...v.address, ...patch } }));

  async function lookupCep(value: string) {
    const cep = digits(value);
    if (cep.length !== 8) return undefined;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json() as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (data.erro) { toast.error("CEP não encontrado."); return undefined; }
      address({ cep: maskCep(cep), street: data.logradouro ?? "", district: data.bairro ?? "", city: data.localidade ?? "", state: data.uf ?? "" });
    } catch { toast.error("Não foi possível consultar o CEP agora."); }
  }

  function save() {
    if (form.customer.name.trim().split(" ").length < 2) { toast.error("Informe seu nome completo."); return; }
    if (!isValidPhone(form.customer.phone)) { toast.error("Informe um telefone válido com DDD."); return; }
    if (!isValidEmail(form.customer.email)) { toast.error("Informe um e-mail válido."); return; }
    if (!isValidCep(form.address.cep)) { toast.error("Informe um CEP válido."); return; }
    if (form.address.state.length !== 2 || !form.address.city.trim() || !form.address.district.trim() || !form.address.street.trim() || !form.address.number.trim()) { toast.error("Preencha o endereço completo."); return; }
    if (!isValidCpfCnpj(form.customer.document)) { toast.error("Informe um CPF válido."); return; }
    writeDraft(form);
    void navigate({ to: "/pagamento-2" });
  }

  return <div className="min-h-[100dvh] overflow-x-hidden bg-background text-foreground">
    <header className="grid h-12 grid-cols-[44px_minmax(0,1fr)_44px] items-center border-b border-border bg-card px-1">
      <Button variant="ghost" size="icon" aria-label="Voltar" onClick={() => void navigate({ to: "/pagamento-2" })}><ChevronLeft size={23} /></Button>
      <h1 className="text-center text-[18px] font-semibold leading-tight">Adicionar o novo<br className="max-[370px]:block hidden" /> endereço</h1><span />
    </header>
    <main className="mx-auto w-full max-w-[520px] pb-28">
      <Section title="Informações de contato">
        <LineInput placeholder="Nome completo" value={form.customer.name} onChange={(v) => customer({ name: v })} />
        <label className="grid h-[52px] grid-cols-[auto_minmax(0,1fr)] items-center border-b border-border px-4 text-[15px]"><span className="border-r border-border pr-3 font-medium">BR&nbsp;&nbsp;+55</span><input aria-label="Número de telefone" inputMode="numeric" placeholder="Número de telefone" value={form.customer.phone} onChange={(e) => customer({ phone: maskPhone(e.target.value) })} className="min-w-0 bg-transparent pl-3 outline-none placeholder:text-muted-foreground" /></label>
        <LineInput type="email" placeholder="Email" value={form.customer.email} onChange={(v) => customer({ email: v })} />
      </Section>
      <Section title="Informações de endereço">
        <LineInput inputMode="numeric" placeholder="CEP/Código postal" value={form.address.cep} onChange={(v) => { const masked=maskCep(v); address({ cep: masked }); if (digits(masked).length === 8) void lookupCep(masked); }} />
        <div className="grid grid-cols-2"><LineInput placeholder="Estado/UF" value={form.address.state} onChange={(v) => address({ state: v.toUpperCase().slice(0,2) })} split /><LineInput placeholder="Cidade" value={form.address.city} onChange={(v) => address({ city: v })} /></div>
        <LineInput placeholder="Bairro/Distrito" value={form.address.district} onChange={(v) => address({ district: v })} />
        <LineInput placeholder="Endereço" value={form.address.street} onChange={(v) => address({ street: v })} />
        <LineInput placeholder={'Nº da residência. Use "s/n" se nenhum'} value={form.address.number} onChange={(v) => address({ number: v })} />
        <LineInput placeholder="Apartamento, bloco, unidade etc. (opcional)" value={form.address.complement} onChange={(v) => address({ complement: v })} />
      </Section>
      <Section title="Informações fiscais">
        <LineInput inputMode="numeric" placeholder="CPF" value={form.customer.document} onChange={(v) => customer({ document: maskDocument(v) })} />
        <p className="px-4 py-3 text-[13px] text-muted-foreground">O CPF será usado para emitir faturas.</p>
      </Section>
      <Section title="Configurações">
        <label className="flex h-14 items-center justify-between px-4 text-[14px] font-medium">Definir como padrão<input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="size-5 accent-primary" /></label>
      </Section>
    </main>
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <Button onClick={save} className="mx-auto flex h-12 w-full max-w-[488px] rounded-full text-[16px] font-semibold">Salvar</Button>
    </div>
  </div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section><h2 className="bg-surface px-4 py-3 text-[13px] text-muted-foreground">{title}</h2><div className="bg-card">{children}</div></section>; }
function LineInput({ placeholder, value, onChange, type="text", inputMode, split=false }: { placeholder:string; value:string; onChange:(v:string)=>void; type?:string; inputMode?:"numeric"; split?:boolean }) { return <input aria-label={placeholder} type={type} inputMode={inputMode} placeholder={placeholder} value={value} onChange={(e)=>onChange(e.target.value)} className={`h-[52px] w-full min-w-0 border-b border-border bg-transparent px-4 text-[15px] outline-none placeholder:text-muted-foreground ${split ? "border-r" : ""}`} />; }