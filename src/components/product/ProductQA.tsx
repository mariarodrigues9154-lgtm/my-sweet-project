import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircleQuestion, Loader2, Send } from "lucide-react";

import { askProductQuestion } from "@/lib/product-qa.functions";

type Item = { q: string; a?: string; error?: string };

export function ProductQA({ slug }: { slug: string }) {
  const ask = useServerFn(askProductQuestion);
  const [question, setQuestion] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (q.length < 3 || loading) return;
    setLoading(true);
    setItems((prev) => [{ q }, ...prev]);
    setQuestion("");
    try {
      const res = await ask({ data: { slug, question: q } });
      setItems((prev) => [res.ok ? { q, a: res.answer } : { q, error: res.error }, ...prev.slice(1)]);
    } catch {
      setItems((prev) => [{ q, error: "Não foi possível responder agora." }, ...prev.slice(1)]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-2 bg-card px-4 py-4">
      <div className="flex items-center gap-2">
        <MessageCircleQuestion className="h-5 w-5 text-primary" />
        <h2 className="text-[15px] font-extrabold">Perguntas sobre o produto</h2>
      </div>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        Tire suas dúvidas — respostas geradas por IA com base nas informações deste produto.
      </p>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          placeholder="Ex.: Funciona em 220v?"
          className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-[14px] outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={loading || question.trim().length < 3}
          aria-label="Enviar pergunta"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
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
                <p className="mt-1 text-[13px] text-muted-foreground">Gerando resposta…</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
