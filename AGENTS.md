<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Product merchandising content stays in the existing structured JSON product fields so one reusable storefront layout serves every product.
- Store-wide identity and destination settings live in `store_settings`; product-specific social proof and content live on each product.
- The public store hub is `/loja`; product profile “Visitar” links always use this internal route.

- Large media (videos) upload browser-direct via signed upload URLs (createMediaUpload/finalizeMediaUpload) to the private product-images bucket; why: server-fn base64 limits.
- Per-product section titles live in products.sections jsonb; why: keeps layout reusable across products.
- Checkout appearance flags live inside each store's `checkout` JSON; why: each store controls its own verified badges without adding page-specific tables.

- Cada loja tem seu próprio gateway de pagamento em `store_payment_settings`; credenciais só no servidor, cobrança PIX criada pelo gateway da loja dona do produto e status confirmado por webhook/consulta ao provedor; motivo: lojas independentes sem fallback entre elas.
- O modelo de checkout é salvo em `store_settings.checkout.checkout_model`; `/pagamento` permanece o Checkout 1 e `/pagamento-2` é apenas uma segunda interface sobre as mesmas funções de pedido e PIX.
- Meta Pixel por loja em `store_meta_settings` (token CAPI só no servidor); eventos do navegador passam por `src/lib/meta-pixel.ts` (trackSingle no Pixel da loja) e Purchase é enviado server-side via `sendPurchaseForOrder` com trava `orders.meta_purchase_sent_at` e event_id `purchase_<pedido>`; motivo: PIX pago sem o cliente voltar à página e sem compras duplicadas.
- Store favicon (`store_settings.favicon_url`) is applied client-side by `useStoreFavicon` inside StoreLogo/StoreHeader; why: every store page and checkout already renders them, so no per-route head wiring.
- Review CSV import parses in the browser and appends into `products.reviews` (same editable list, saved with the product); external image URLs are copied into storage by `importReviewImages`; why: no separate review table.
- PIX recovery outside checkout uses `orders.access_token` remembered in the browser (`src/lib/pix-orders.ts`) and `getPixOrders`, which only reads the saved charge and reconfirms status; why: customers keep their PIX without login and no duplicate charge is ever created.
- Shipping is a single free modality defined in `src/lib/shipping.ts` (name, reference price, delivery window); product page, buy sheet, both checkouts and createOrder read it, ignoring per-product shipping options; why: one consistent rule and no charged freight.
- Checkouts reopen a PIX only when the URL carries ?pedido=<number> matching the browser's last order (set after PIX creation); plain checkout visits always start a new purchase; why: an old PIX must never hijack Comprar agora.
- New PIX charges get a 15-minute store-side window saved in orders.pix_expiration_date (Wappi only accepts whole days); why: real, persisted countdown that survives refresh.
- Product Q&A AI: per-product toggles/texts in products.sections (qa_*), per-store AI facts and support contacts in store_settings.ai_support (never in public selects); context built server-side from product_id + its store_id; why: no cross-store leakage and no secrets in the client.
- PIX recovery toggles per store live in store_settings.checkout.pix_recovery, resolved by resolvePixRecovery and enforced server-side in getPixOrders; why: OFF hides UI without touching orders.
- PinPay entra como mais um provider em src/lib/payments (mesma interface da Wappi); webhook /api/public/webhooks/pinpay sempre reconfirma em GET /transactions/{id}; motivo: postback da PinPay não é assinado.
- Blackcat entra como provider em src/lib/payments (X-API-Key, centavos); webhook /api/public/webhooks/blackcat reconfirma em GET /sales/{id}/status e a validade do PIX vem do expiresAt da Blackcat; motivo: postback não assinado e prazo real do gateway.
- Product photos are resized on demand via `/api/public/media/<path>?w=` (allowed widths in `IMG_WIDTHS`, storage transform delivers WebP) and components use `sizedImage`/`imageSrcSet` from `src/lib/media-url.ts`; why: originals stay untouched while phones download small files.
