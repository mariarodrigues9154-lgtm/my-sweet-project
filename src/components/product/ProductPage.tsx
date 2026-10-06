import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";

import { trackViewContent, useMetaPageView } from "@/lib/meta-pixel";

import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreChat } from "@/components/store/StoreChat";
import { useOrderChatBadge } from "@/components/store/PendingPixLayer";
import { StoreFooter } from "@/components/store/StoreFooter";
import { FloatingPopup } from "@/components/store/FloatingPopup";
import { BuyBar } from "./BuyBar";
import { BuySheet } from "./BuySheet";
import { CreatorVideos } from "./CreatorVideos";
import { DeliveryCard } from "./DeliveryCard";
import { SpecsSection, TermsSection } from "./DetailsSection";
import { Gallery } from "./Gallery";
import { OfferBlock } from "./OfferBlock";
import { ProductHeadline } from "./ProductHeadline";
import { ReviewsSection } from "./ReviewsSection";
import { ProductQA } from "./ProductQA";
import { StoreProfile } from "./StoreProfile";
import type { Product, StoreSettings } from "@/lib/product-types";

export function ProductPage({ product, store }: { product: Product; store: StoreSettings }) {
  const [sheet, setSheet] = useState<{ open: boolean; mode: "buy" | "cart" }>({
    open: false,
    mode: "buy",
  });
  const [chatOpen, setChatOpen] = useState(false);
  const orderChat = useOrderChatBadge(store.id);
  const openChat = () => (orderChat.hasOrders ? orderChat.open() : setChatOpen(true));
  useMetaPageView(store.id || null, () => void trackViewContent(store.id, product));
  const router = useRouter();
  const checkoutPath = store.checkout?.checkout_model === "v2" ? "/pagamento-2" : "/pagamento";
  useEffect(() => {
    // Pré-carrega o código do checkout quando o navegador fica ocioso.
    const run = () => void router.preloadRoute({ to: checkoutPath }).catch(() => undefined);
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 4000 });
    else setTimeout(run, 2500);
  }, [router, checkoutPath]);

  return (
    <div className="min-h-screen bg-surface pb-24">
      <StoreHeader store={store} placement="product" />

      <main className="mx-auto max-w-[520px] bg-card">
        <Gallery media={product.media} title={product.name} />
        <OfferBlock product={product} />
        <ProductHeadline product={product} />
        <DeliveryCard product={product} />
        <div className="h-3 bg-card" />
        <CreatorVideos videos={product.creator_videos} sections={product.sections ?? {}} />
        <ReviewsSection product={product} />
        <StoreProfile store={store} product={product} onMessage={openChat} />
        <SpecsSection product={product} />
        {product.sections?.qa_enabled !== false && store.checkout?.ai_enabled !== false && <ProductQA key={product.id} product={product} storeId={store.id} />}
        <TermsSection terms={product.terms} config={store.checkout?.product_terms} />
        <StoreFooter store={store} />
      </main>

      <BuyBar
        product={product}
        store={store}
        onAddToCart={() => setSheet({ open: true, mode: "cart" })}
        onBuyNow={() => setSheet({ open: true, mode: "buy" })}
        onChat={openChat}
        chatBadge={orderChat.unread}
      />
      {!sheet.open && !chatOpen && <FloatingPopup store={store} product={product} />}
      <StoreChat store={store} open={chatOpen} onClose={() => setChatOpen(false)} />

      <BuySheet
        product={product}
        store={store}
        open={sheet.open}
        mode={sheet.mode}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
      />
    </div>
  );
}

export function EmptyStore({ store }: { store: StoreSettings }) {
  return (
    <div className="min-h-screen bg-surface">
      <StoreHeader store={store} placement="product" />
      <div className="mx-auto max-w-[520px] px-6 py-24 text-center">
        <h1 className="text-[20px] font-extrabold">Nenhum produto ativo</h1>
        <p className="mt-2 text-[13.5px] text-muted-foreground">
          Cadastre ou ative um produto na área administrativa para exibir esta página.
        </p>
      </div>
    </div>
  );
}
