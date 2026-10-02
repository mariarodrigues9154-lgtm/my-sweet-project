import { createFileRoute } from "@tanstack/react-router";
import { StoreHub } from "@/components/store/StoreHub";
import { getStoreSettings, listActiveProducts } from "@/lib/store.functions";

export const Route = createFileRoute("/loja/")({
  loader: async () => { const store = await getStoreSettings(); const products = await listActiveProducts(store?.id ? { data: { storeId: store.id } } : undefined); return { store: store!, products }; },
  head: () => ({ meta: [{ title: "Página da loja | Loja oficial" }, { name: "description", content: "Conheça a loja, seus destaques e todos os produtos disponíveis." }, { property: "og:title", content: "Página da loja | Loja oficial" }, { property: "og:description", content: "Conheça a loja, seus destaques e todos os produtos disponíveis." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  errorComponent: () => <div className="grid min-h-screen place-items-center px-6 text-center text-sm">Não foi possível carregar a loja agora.</div>,
  component: StoreRoute,
});
function StoreRoute() { const { store, products } = Route.useLoaderData(); return <StoreHub store={store} products={products} />; }