import { createFileRoute, notFound } from "@tanstack/react-router";

import { ProductPage } from "@/components/product/ProductPage";
import { getProductBySlug, getStoreSettings } from "@/lib/store.functions";

export const Route = createFileRoute("/produto/$slug")({
  loader: async ({ params }) => {
    const [product, store] = await Promise.all([
      getProductBySlug({ data: { slug: params.slug } }),
      getStoreSettings({ data: { productSlug: params.slug } }),
    ]);
    if (!product) throw notFound();
    return { product, store: store! };
  },
  staleTime: 30_000,
  head: ({ loaderData }) => {
    const first = loaderData?.product?.media?.find((m: { type?: string }) => m.type !== "video") as { url?: string } | undefined;
    const title = loaderData?.product?.title ?? "Produto";
    const description =
      loaderData?.product?.subtitle ??
      "Compra protegida, frete grátis e entrega para todo o Brasil.";
    return {
      meta: [
        { title: `${title} | Oferta` },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: first?.url ? [{ rel: "preload", as: "image", href: first.url, fetchPriority: "high" }] : [],
    };
  },
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <h1 className="text-[20px] font-extrabold">Produto não encontrado</h1>
        <p className="mt-2 text-[13.5px] text-muted-foreground">
          Este produto saiu do ar ou o endereço está incorreto.
        </p>
      </div>
    </div>
  ),
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <p className="text-[14px] text-muted-foreground">
        Não conseguimos carregar o produto agora. Atualize a página.
      </p>
    </div>
  ),
  component: ProductRoute,
});

function ProductRoute() {
  const { product, store } = Route.useLoaderData();
  return <ProductPage product={product} store={store} />;
}
