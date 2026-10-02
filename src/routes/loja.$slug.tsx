import { createFileRoute, notFound } from "@tanstack/react-router";
import { StoreHub } from "@/components/store/StoreHub";
import { getStoreSettings, listActiveProducts } from "@/lib/store.functions";

export const Route = createFileRoute("/loja/$slug")({
  loader: async ({ params }) => {
    const store = await getStoreSettings({ data: { slug: params.slug } });
    if (!store) throw notFound();
    const products = await listActiveProducts({ data: { storeId: store.id } });
    return { store, products };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.store.name ?? "Loja";
    const description = loaderData?.store.tagline || `Conheça a ${name} e todos os produtos disponíveis.`;
    return { meta: [{ title: `${name} | Loja oficial` }, { name: "description", content: description }, { property: "og:title", content: `${name} | Loja oficial` }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] };
  },
  notFoundComponent: () => <div className="grid min-h-screen place-items-center px-6 text-center text-sm">Loja não encontrada.</div>,
  errorComponent: () => <div className="grid min-h-screen place-items-center px-6 text-center text-sm">Não foi possível carregar a loja agora.</div>,
  component: StoreSlugRoute,
});
function StoreSlugRoute() { const { store, products } = Route.useLoaderData(); return <StoreHub store={store} products={products} />; }
