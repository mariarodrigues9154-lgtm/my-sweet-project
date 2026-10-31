/** Regra da "mesma tentativa de compra" para a recuperação de PIX (pura, testável). */

export const ATTEMPT_WINDOW_MIN = 24 * 60;

export type AttemptOrder = {
  id: string;
  order_number?: string | null;
  status: string;
  created_at: string;
  customer?: { phone?: string | null; email?: string | null; document?: string | null; cpf?: string | null } | null;
};

function phoneKey(raw: unknown): string | null {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return /^55\d{10,11}$/.test(d) ? d : null;
}

export function customerKeys(c: AttemptOrder["customer"]): string[] {
  const keys: string[] = [];
  const p = phoneKey(c?.phone);
  if (p) keys.push(`p:${p}`);
  const doc = String(c?.document ?? c?.cpf ?? "").replace(/\D/g, "");
  if (doc.length >= 11) keys.push(`d:${doc}`);
  const email = String(c?.email ?? "").trim().toLowerCase();
  if (email.includes("@")) keys.push(`e:${email}`);
  return keys;
}

const isPaid = (s: string) => s === "pago" || s === "aprovado";

export type AttemptDecision =
  | { action: "send" }
  | { action: "skip_paid"; by: AttemptOrder }
  | { action: "skip_superseded"; by: AttemptOrder };

/**
 * Decide se o PIX pendente `target` pode receber lembrete.
 * Relacionados = mesmo cliente (telefone, CPF ou e-mail) criados até 24h antes do alvo ou depois dele.
 * Algum pago → não envia. Outro pendente mais novo → só o mais novo recebe (sem duplicar).
 */
export function decideAttempt(target: AttemptOrder, others: AttemptOrder[], windowMin = ATTEMPT_WINDOW_MIN): AttemptDecision {
  const keys = new Set(customerKeys(target.customer));
  if (!keys.size) return { action: "send" };
  const start = new Date(target.created_at).getTime() - windowMin * 60000;
  const related = others.filter(
    (o) => o.id !== target.id && new Date(o.created_at).getTime() >= start && customerKeys(o.customer).some((k) => keys.has(k)),
  );
  const paid = related.find((o) => isPaid(o.status));
  if (paid) return { action: "skip_paid", by: paid };
  const newer = related.find((o) => o.status === "aguardando_pagamento" && new Date(o.created_at).getTime() > new Date(target.created_at).getTime());
  if (newer) return { action: "skip_superseded", by: newer };
  return { action: "send" };
}
