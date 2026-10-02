import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

import { createLovableAiGatewayRunIdFetch } from "./run-id.server";

const MODEL = "openai/gpt-6-astra";

export async function answerProductQuestion(productContext: string, question: string) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Assistente indisponível no momento.");
  const runIdFetch = createLovableAiGatewayRunIdFetch(undefined);
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  const result = streamText({
    model: provider.responses(MODEL),
    system:
      "Você é o assistente de atendimento de uma loja virtual brasileira. Responda em português do Brasil, de forma curta (no máximo 4 frases), cordial e objetiva, usando SOMENTE as informações do produto fornecidas. Se a informação não estiver nos dados, diga que não tem essa informação e sugira falar com a loja. Nunca invente preços, prazos, garantias ou especificações. Não use markdown.",
    prompt: `DADOS DO PRODUTO:\n${productContext}\n\nPERGUNTA DO CLIENTE:\n${question}`,
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
