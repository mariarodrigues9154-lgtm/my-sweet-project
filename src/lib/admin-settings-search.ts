import catalog from "./admin-settings-catalog.json";

export type SettingsDestination = { id: string; section: string; label: string; area?: string; productId?: string; productName?: string; aliases?: string[] };
export const normalizeSettingsQuery = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const aliases: Record<string, string[]> = {
  "Formas de pagamento": ["Pagamento", "Métodos de pagamento", "Cartão de crédito", "Parcelamento"],
  "Rastreamento — Magnus Frete": ["Automação de frete", "Frete", "Entrega", "Rastreio"],
  "Logos": ["Logotipo"],
  "Recuperação de PIX pendente via WhatsApp": ["WhatsApp", "Automação WhatsApp", "PlugSend"],
  "Avaliações": ["Importar CSV", "Excluir avaliações", "Fixar no topo"],
  "Variações do produto": ["Variantes", "Esgotado", "SKU"],
};

export function settingsCatalog(products: { id: string; title: string }[]): SettingsDestination[] {
  return catalog.flatMap((group) => {
    const labels = [group.section, ...group.labels.filter((label) => normalizeSettingsQuery(label).length > 1)];
    const rows = (product?: { id: string; title: string }) => labels.map((label, index) => ({
      id: `${product?.id ?? "store"}:${group.section}:${index}`, section: group.section, label,
      area: "area" in group ? group.area : undefined, productId: product?.id, productName: product?.title,
      aliases: index === 0 ? aliases[group.section] ?? [] : [],
    }));
    return group.scope === "product" ? products.flatMap(rows) : rows();
  });
}

export function searchSettings(items: SettingsDestination[], query: string): SettingsDestination[] {
  const q = normalizeSettingsQuery(query);
  if (!q) return [];
  const words = q.split(" ");
  const matches = items.map((item) => {
    const label = normalizeSettingsQuery(item.label);
    const alias = item.aliases?.map(normalizeSettingsQuery) ?? [];
    const haystack = normalizeSettingsQuery(`${item.label} ${item.section} ${item.productName ?? ""} ${item.aliases?.join(" ") ?? ""}`);
    const score = label === q ? 100 : alias.includes(q) ? 95 : label.startsWith(q) ? 80 : label.includes(q) ? 70 : words.every((word) => haystack.includes(word)) ? 50 : 0;
    return { item, score };
  }).filter((match) => match.score > 0).sort((a, b) => b.score - a.score);
  // Each section is one destination; its most specific matching field is shown.
  const seen = new Set<string>();
  return matches.filter(({ item }) => {
    const key = `${item.productId ?? "store"}:${item.section}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).map(({ item }) => item);
}

export function directSettingResult(items: SettingsDestination[], query: string): SettingsDestination | undefined {
  if (items.length === 1) return items[0];
  const q = normalizeSettingsQuery(query);
  const exact = items.filter((item) => !item.productId && (normalizeSettingsQuery(item.label) === q || item.aliases?.some((alias) => normalizeSettingsQuery(alias) === q)));
  return exact.length === 1 ? exact[0] : undefined;
}