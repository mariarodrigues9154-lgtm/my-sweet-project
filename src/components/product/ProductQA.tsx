import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircleQuestion, Loader2, Send, Phone, MessageCircle } from "lucide-react";

import { askProductQuestion, type SupportLinks } from "@/lib/product-qa.functions";
import type { Product } from "@/lib/product-types";

type Item = { q: string; a?: string; error?: string; support?: SupportLinks | null };

function suggestions(p: Product) {
  const list: string[] = [];
  if (p.warranty) list.push("Qual é a garantia?");
  if (p.description.length || p.sections?.qa_ai_info) list.push("Como funciona?");
  list.push("Qual o prazo de entrega?");
  if (p.variants?.length) list.push("Quais opções estão disponíveis?");
  const all = JSON.stringify([p.specs, p.description, p.sections?.qa_ai_info ?? ""]).toLowerCase();
  if (/embalagem|acompanha|itens inclusos|vem com/.test(all)) list.push("O que vem na embalagem?");
  return list.slice(0, 4);
}

export function ProductQA({ product, storeId }: { product: Product; storeId: string }) {
  const ask = useServerFn(askProductQuestion);
  const [question, setQuestion] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const quick = useMemo(() => suggestions(product), [product]);
  const s = product.sections ?? {};
  if (s.qa_enabled === false) return null;

  async function send(raw: string) {
    const q = raw.trim();
    if (q.length < 2 || loading) return;
    setLoading(true);
    const history = items.filter((i) => i.a).slice(0, 3).reverse().map((i) => ({ q: i.q, a: i.a! }));
    setItems((prev) => [{ q }, ...prev]);
    setQuestion("");
    try {
      const res = await ask({ data: { slug: product.slug, productId: product.id, storeId: storeId || undefined, question: q, history } });
      setItems((prev) => [res.ok ? { q, a: res.answer, support: res.support } : { q, error: res.error, support: res.support }, ...prev.slice(1)]);
    } catch {
      setItems((prev) => [{ q, error: "Não consegui responder agora. Você pode falar com nosso suporte." }, ...prev.slice(1)]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-2 bg-card px-4 py-4">
      <div className="flex items-center gap-2">
        <MessageCircleQuestion className="h-5 w-5 text-primary" />
        <h2 className="text-[15px] font-extrabold">{s.qa_title || "Perguntas sobre o produto"}</h2>
      </div>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        {s.qa_subtitle || "Tire suas dúvidas — respostas com base nas informações deste produto."}
      </p>
      <form onSubmit={(e) => { e.preventDefault(); void send(question); }} className="mt-3 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          placeholder={s.qa_placeholder || "Ex.: Funciona em 220V?"}
          className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-[14px] outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={loading || question.trim().length < 2}
          aria-label="Enviar pergunta"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
      {items.length === 0 && quick.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {quick.map((q) => (
            <button key={q} type="button" disabled={loading} onClick={() => void send(q)} className="rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] text-foreground/80 disabled:opacity-50">
              {q}
            </button>
          ))}
        </div>
      )}
      {items.length > 0 && (
        <ul className="mt-3 space-y-3">
          {items.map((it, i) => (
            <li key={i} className="rounded-lg bg-surface px-3 py-2.5">
              <p className="text-[13px] font-bold">P: {it.q}</p>
              {it.a ? (
                <p className="mt-1 text-[13px] leading-relaxed">R: {it.a}</p>
              ) : it.error ? (
                <p className="mt-1 text-[13px] text-destructive">{it.error}</p>
              ) : (
                <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Respondendo...</p>
              )}
              {it.support && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {it.support.whatsapp && (
                    <a href={it.support.whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-foreground">
                      <MessageCircle className="h-4 w-4" />Falar pelo WhatsApp
                    </a>
                  )}
                  {it.support.phone && (
                    <a href={it.support.phone} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-[12.5px] font-semibold">
                      <Phone className="h-4 w-4" />Ligar agora
                    </a>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
