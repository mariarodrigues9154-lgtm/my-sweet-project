import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getProductBySlug } from "./store.functions";
import { discountPercent, type Product } from "./product-types";

function buildContext(p: Product) {
  const lines: string[] = [
    `Nome: ${p.name}`,
    `Título: ${p.title}`,
    p.subtitle ? `Subtítulo: ${p.subtitle}` : "",
    `Preço atual: R$ ${p.price.toFixed(2)} (antes R$ ${p.previous_price.toFixed(2)}, ${discountPercent(p.price, p.previous_price)}% de desconto)`,
    `Estoque: ${p.stock} unidades`,
    p.warranty ? `Garantia: ${p.warranty}` : "",
  ];
  const j = (label: string, v: unknown) => {
    if (v && (!Array.isArray(v) || v.length)) lines.push(`${label}: ${JSON.stringify(v)}`);
  };
  j("Variações", p.variants);
  j("Frete", p.shipping);
  j("Proteção ao cliente", p.protection);
  j("Especificações", p.specs);
  j("Descrição", p.description);
  j("Termos", p.terms);
  return lines.filter(Boolean).join("\n");
}

export const askProductQuestion = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string; question: string }) =>
    z.object({ slug: z.string().min(1).max(200), question: z.string().trim().min(3).max(500) }).parse(d),
  )
  .handler(async ({ data }) => {
    const product = await getProductBySlug({ data: { slug: data.slug } });
    if (!product) return { ok: false as const, error: "Produto não encontrado." };
    try {
      const { answerProductQuestion } = await import("./product-qa.server");
      const answer = await answerProductQuestion(buildContext(product), data.question);
      if (!answer) return { ok: false as const, error: "Não foi possível gerar uma resposta. Tente outra pergunta." };
      return { ok: true as const, answer };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/429|rate/i.test(msg)) return { ok: false as const, error: "Muitas perguntas agora. Aguarde um instante." };
      if (/402|credit/i.test(msg)) return { ok: false as const, error: "Assistente temporariamente indisponível." };
      console.error("askProductQuestion", e);
      return { ok: false as const, error: "Não foi possível responder agora. Tente novamente mais tarde." };
    }
  });
