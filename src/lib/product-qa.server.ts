import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";

import { createLovableAiGatewayRunIdFetch } from "./run-id.server";

const MODEL = "openai/gpt-6-astra";

const SYSTEM = `Você é o assistente de dúvidas de um produto numa loja virtual brasileira.
REGRAS OBRIGATÓRIAS:
- Responda em português do Brasil, em 1 a 4 frases, de forma simples, educada e objetiva. Sem markdown.
- Use SOMENTE os dados de LOJA e PRODUTO fornecidos. Nunca invente potência, voltagem, certificações, garantia, materiais, estoque, prazos, compatibilidade ou funcionalidades.
- Se a informação não estiver nos dados, responda: "Não encontrei essa informação nos dados cadastrados deste produto. Posso te encaminhar para o suporte para confirmar." e termine com a marca [SUPORTE].
- Se houver várias opções (ex.: voltagens), diga que existem opções e peça para conferir a variação selecionada antes de finalizar.
- Não faça elogios sem base (ex.: "a loja mais confiável").
- Nunca informe status de pedidos ou pagamentos; encaminhe ao suporte com [SUPORTE].
- Se a pergunta não tiver relação com o produto, entrega, pagamento ou compra, responda: "Posso ajudar com dúvidas sobre este produto, entrega, pagamento ou sua compra."
- As perguntas anteriores da conversa são sobre este mesmo produto.`;

export async function answerProductQuestion(input: {
  store: string;
  product: string;
  question: string;
  history: Array<{ q: string; a: string }>;
}) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Assistente indisponível no momento.");
  const runIdFetch = createLovableAiGatewayRunIdFetch(undefined);
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  const messages: ModelMessage[] = [];
  for (const h of input.history) {
    messages.push({ role: "user", content: h.q }, { role: "assistant", content: h.a });
  }
  messages.push({ role: "user", content: input.question });
  const result = streamText({
    model: provider.responses(MODEL),
    system: `${SYSTEM}\n\nLOJA\n${input.store}\n\nPRODUTO\n${input.product}`,
    messages,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  return (await result.text).trim();
}
