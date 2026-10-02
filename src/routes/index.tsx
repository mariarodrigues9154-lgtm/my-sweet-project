import { createFileRoute } from "@tanstack/react-router";

import { EmptyStore, ProductPage } from "@/components/product/ProductPage";
import { getFeaturedProduct, getStoreSettings } from "@/lib/store.functions";

export const Route = createFileRoute("/")({
  loader: async () => {
    const product = await getFeaturedProduct();
    const store = await getStoreSettings(product ? { data: { productSlug: product.slug } } : undefined);
    return { product, store: store! };
  },
  head: () => ({
    meta: [
      { title: "Oferta do dia | Loja oficial" },
      {
        name: "description",
        content:
          "Oferta relâmpago com frete grátis, compra protegida e entrega para todo o Brasil. Estoque limitado.",
      },
      { property: "og:title", content: "Oferta do dia | Loja oficial" },
      {
        property: "og:description",
        content: "Oferta relâmpago com frete grátis, compra protegida e entrega para todo o Brasil.",
      },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <p className="text-[14px] text-muted-foreground">
        Não conseguimos carregar a oferta agora. Atualize a página.
      </p>
    </div>
  ),
  component: Home,
});

function Home() {
  const { product, store } = Route.useLoaderData();
  if (!product) return <EmptyStore store={store} />;
  return <ProductPage product={product} store={store} />;
}
