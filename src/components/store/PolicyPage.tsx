import type { StoreSettings } from "@/lib/product-types";
import { StoreFooter } from "./StoreFooter";
import { StoreHeader, StoreHomeLink } from "./StoreHeader";

export function PolicyPage({ store, title, content }: { store: StoreSettings; title: string; content: string }) {
  return <div className="min-h-screen bg-surface"><StoreHeader store={store} /><main className="mx-auto max-w-[520px] bg-card"><article className="min-h-[60vh] px-5 py-8"><StoreHomeLink store={store} className="text-[12px] font-bold text-primary">Voltar para a loja</StoreHomeLink><h1 className="mt-4 text-[22px] font-extrabold">{title}</h1>{content ? <p className="mt-5 whitespace-pre-wrap text-[13px] leading-6 text-muted-foreground">{content}</p> : <p className="mt-5 text-[13px] text-muted-foreground">Conteúdo ainda não informado pela loja.</p>}</article><StoreFooter store={store} /></main></div>;
}