import catalog from "./admin-settings-catalog.json";
import { PAYMENT_PROVIDERS } from "./payments/catalog";

export type SettingsDestination = { id: string; section: string; label: string; area?: string | undefined; productId?: string | undefined; productName?: string | undefined; providerId?: string | undefined; aliases?: string[] | undefined };
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
  const extras: Record<string, string[]> = {
    "Endereço e status": ["Loja ativa", "Loja inativa"],
    "Identidade e botões": ["Selo de loja verificada"],
    "Proteção do cliente": Array.from({ length: 6 }, (_, i) => `Texto do benefício ${i + 1}`),
    "Cronômetro da oferta (toda a loja)": ["Horas", "Minutos"],
    "Popup / Notificações flutuantes": ["Fonte das notificações", "Posição", "Ordem", "Primeira notificação após", "Tempo visível", "Intervalo entre notificações", "Animação", "Cor do selo", "Nome", "Localização", "Título", "Texto secundário"],
    "Cupom / aviso promocional": ["Ativar chip de cupom", "Ativar barra inferior", "Exibir cronômetro", "Mostrar botão X", "Mostrar seta", "Cor de fundo", "Cor do texto", "Cor de destaque", "Cor da borda"],
    "Descrição": ["Texto alternativo", "Legenda", "Link da imagem", "Link do vídeo", "Tamanho do espaçamento"],
    "Oferta de saída do checkout": ["Subtítulo/selo", "Título", "Texto do contador", "Texto do botão principal", "Texto de recusa", "Ícone/imagem", "Valor do desconto"],
    "Pop-up de saída da página do produto": ["Título", "Texto do contador", "Texto do botão principal", "Texto de recusa", "Valor do desconto"],
    "PIX pendente / Recuperação de pagamento": ["Mostrar aviso de pagamento pendente", "Permitir copiar PIX pelo aviso", "Permitir recuperar PIX pelo chat", "Mostrar indicador de mensagem"],
    "Preço e estoque": ["Texto manual da faixa Economize", "Negrito", "Pulsação"],
    "Variações do produto": ["Etiqueta de esgotado", "Nome do atributo", "Nome da opção", "Preço da combinação", "Estoque da combinação", "Selo promocional da combinação"],
    "Recuperação de PIX pendente via WhatsApp": ["Token PlugSend", "Token de acesso", "Token da instância", "Client-Token", "API key", "Primeiro lembrete", "Enviar após minutos", "URL do servidor", "ENVIAR TESTE", "Testar conexão", "Salvar"],
  };
  const sections = catalog.flatMap((group) => {
    const labels = [...new Set([group.section, ...group.labels, ...(extras[group.section] ?? [])])].filter((label) => normalizeSettingsQuery(label).length > 1);
    const rows = (product?: { id: string; title: string }) => labels.map((label, index) => ({
      id: `${product?.id ?? "store"}:${group.section}:${index}`, section: group.section, label,
      area: "area" in group ? group.area : undefined, productId: product?.id, productName: product?.title,
      aliases: index === 0 ? aliases[group.section] ?? [] : [],
    }));
    return group.scope === "product" ? products.flatMap(rows) : rows();
  });
  const providers = PAYMENT_PROVIDERS.filter((provider) => provider.supportsPix).flatMap((provider) => [provider.name, ...provider.fields.map((field) => field.label)].map((label, index) => ({
    id: `gateway:${provider.id}:${index}`, section: "Checkout e Pagamentos", area: "payments", providerId: provider.id,
    label: index === 0 ? provider.name : `${provider.name} — ${label}`, aliases: [label, provider.id],
  })));
  return [...sections, ...providers];
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
    const key = `${item.productId ?? "store"}:${item.section}:${item.providerId ?? ""}`;
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