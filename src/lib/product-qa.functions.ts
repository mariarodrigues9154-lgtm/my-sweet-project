import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getProductBySlug } from "./store.functions";
import { discountPercent, type Product, type StoreAiSupport } from "./product-types";
import { SHIPPING } from "./shipping";

type StoreCtx = {
  id: string;
  name: string;
  support_email: string | null;
  policies: { privacy?: string; refund?: string; terms?: string; shipping?: string } | null;
  ai_support: StoreAiSupport | null;
};

export type SupportLinks = { whatsapp?: string; phone?: string };

const cut = (s: string | null | undefined, n: number) => (s ? (s.length > n ? `${s.slice(0, n)}…` : s) : "");

function blockText(p: Product) {
  return p.description
    .map((b) => (b.type === "list" ? b.items.map((i) => `- ${i}`).join("\n") : "text" in b ? b.text : ""))
    .filter(Boolean)
    .join("\n");
}

function buildProductContext(p: Product) {
  const lines = [
    `Nome: ${p.name}`,
    `Título: ${p.title}`,
    p.subtitle ? `Subtítulo: ${p.subtitle}` : "",
    `Preço atual: R$ ${p.price.toFixed(2)}${p.previous_price > p.price ? ` (antes R$ ${p.previous_price.toFixed(2)}, ${discountPercent(p.price, p.previous_price)}% de desconto)` : ""}`,
    `Estoque disponível: ${p.stock > 0 ? "sim" : "esgotado"}`,
    p.warranty ? `Garantia do produto: ${p.warranty}` : "",
  ];
  if (p.variants?.length) lines.push(`Variações: ${p.variants.map((g) => `${g.name}: ${g.options.map((o) => o.label).join(", ")}`).join(" | ")}`);
  if (p.specs.length) lines.push(`Especificações:\n${p.specs.map((s) => `- ${s.label}: ${s.value}`).join("\n")}`);
  const desc = blockText(p);
  if (desc) lines.push(`Descrição:\n${cut(desc, 6000)}`);
  if (p.terms) lines.push(`Termos: ${cut(p.terms, 1500)}`);
  if (p.sections?.qa_ai_info) lines.push(`Informações adicionais do produto:\n${p.sections.qa_ai_info}`);
  return lines.filter(Boolean).join("\n");
}

function buildStoreContext(s: StoreCtx) {
  const ai = s.ai_support ?? {};
  const lines = [
    `Nome da loja: ${s.name}`,
    `Entrega: ${SHIPPING.name}, frete grátis, prazo estimado de ${SHIPPING.minDeliveryDays} a ${SHIPPING.maxDeliveryDays} dias (data exata aparece na página e no checkout).`,
    ai.ships_brazil ? "Regiões atendidas: entregamos para todo o Brasil." : "",
    "Forma de pagamento: PIX.",
    ai.warranty_text ? `Garantia da loja: ${ai.warranty_text}` : "",
    s.policies?.refund ? `Política de troca/reembolso: ${cut(s.policies.refund, 2000)}` : "",
    s.policies?.shipping ? `Política de entrega: ${cut(s.policies.shipping, 2000)}` : "",
    ai.store_info ? `Informações da loja: ${ai.store_info}` : "",
    ai.extra_info ? `Informações adicionais: ${ai.extra_info}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

function supportLinks(s: StoreCtx, productName: string): SupportLinks | null {
  const ai = s.ai_support ?? {};
  if (!ai.forward_enabled) return null;
  const digits = (ai.support_phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const full = digits.length <= 11 ? `55${digits}` : digits;
  const links: SupportLinks = {};
  if (ai.whatsapp_enabled) {
    const msg = (ai.whatsapp_message || "Olá! Preciso de ajuda com o produto {produto}.").replace(/\{produto\}/g, productName);
    links.whatsapp = `https://wa.me/${full}?text=${encodeURIComponent(msg)}`;
  }
  if (ai.phone_enabled) links.phone = `tel:+${full}`;
  return links.whatsapp || links.phone ? links : null;
}

const SUPPORT_RE = /(falar|conversar|contato|contatar|ligar|chamar).{0,25}(algu[eé]m|atendente|vendedor|humano|suporte|voc[eê]s|loja|pessoa)|\b(suporte|atendente|atendimento humano|sac)\b|como (entro|entrar) em contato|whats\s?app|telefone/i;
const ORDER_RE = /(meu|minha|o) (pedido|compra|pix|pagamento|encomenda)|onde est[aá] (meu|minha|o pedido)|rastre|cancelar|reembols|estornar|deu problema|n[aã]o (chegou|recebi)/i;

// Limite básico por IP (memória do servidor): 6 perguntas a cada 30 s, 40 por 10 min.
const hits = new Map<string, number[]>();
function rateLimited(key: string) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < 600_000);
  const recent = list.filter((t) => now - t < 30_000).length;
  if (recent >= 6 || list.length >= 40) {
    hits.set(key, list);
    return true;
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return false;
}

const FALLBACK = "Não consegui responder agora. Você pode falar com nosso suporte.";

export const askProductQuestion = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string().min(1).max(200),
        productId: z.string().uuid(),
        storeId: z.string().max(60).optional(),
        question: z.string().trim().min(2).max(500),
        history: z.array(z.object({ q: z.string().max(500), a: z.string().max(1500) })).max(6).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const product = await getProductBySlug({ data: { slug: data.slug } });
    if (!product || product.id !== data.productId) return { ok: false as const, error: "Produto não encontrado.", support: null };
    if (product.sections?.qa_enabled === false) return { ok: false as const, error: "Perguntas desativadas para este produto.", support: null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pRow } = await supabaseAdmin.from("products").select("store_id").eq("id", product.id).maybeSingle();
    const storeId = (pRow?.store_id as string | null) ?? null;
    if (!storeId || (data.storeId && data.storeId !== storeId)) return { ok: false as const, error: "Loja não encontrada.", support: null };
    const { data: sRow } = await supabaseAdmin
      .from("store_settings")
      .select("id, name, support_email, policies, ai_support")
      .eq("id", storeId)
      .maybeSingle();
    if (!sRow) return { ok: false as const, error: "Loja não encontrada.", support: null };
    const store = sRow as unknown as StoreCtx;
    const support = supportLinks(store, product.name);
    if (store.ai_support?.enabled === false) return { ok: false as const, error: "As perguntas estão indisponíveis no momento.", support: null };

    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const ip = getRequestHeader("cf-connecting-ip") || getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
    if (rateLimited(ip)) return { ok: false as const, error: "Muitas perguntas seguidas. Aguarde alguns segundos.", support: null };

    if (SUPPORT_RE.test(data.question)) {
      return {
        ok: true as const,
        answer: support ? "Claro! Fale com nosso suporte pelos botões abaixo." : "No momento o atendimento humano não está disponível por aqui.",
        support,
      };
    }
    if (ORDER_RE.test(data.question)) {
      return {
        ok: true as const,
        answer: support
          ? "Para consultar informações específicas do seu pedido, fale com nosso suporte."
          : "Para consultar informações específicas do seu pedido, entre em contato com a loja.",
        support,
      };
    }

    try {
      const { answerProductQuestion } = await import("./product-qa.server");
      const raw = await answerProductQuestion({
        store: buildStoreContext(store),
        product: buildProductContext(product),
        question: data.question,
        history: data.history,
      });
      if (!raw) return { ok: false as const, error: FALLBACK, support };
      const wantsSupport = /\[SUPORTE\]/i.test(raw);
      const answer = raw.replace(/\[SUPORTE\]/gi, "").trim();
      return { ok: true as const, answer, support: wantsSupport ? support : null };
    } catch (e) {
      console.error("askProductQuestion", e instanceof Error ? e.message : e);
      return { ok: false as const, error: FALLBACK, support };
    }
  });
