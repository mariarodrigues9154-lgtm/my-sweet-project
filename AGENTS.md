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

- Store identity lives in `store_settings`; product content/social proof stays in structured product JSON fields; why: one reusable layout for every product.
- The public store hub is `/loja`; product profile “Visitar” links always use this internal route.

- Large media (videos) upload browser-direct via signed upload URLs (createMediaUpload/finalizeMediaUpload) to the private product-images bucket; why: server-fn base64 limits.
- Per-product section texts/toggles live in products.sections; per-store checkout flags in store_settings.checkout; why: no page-specific tables.

- Cada loja tem seu próprio gateway de pagamento em `store_payment_settings`; credenciais só no servidor, cobrança PIX criada pelo gateway da loja dona do produto e status confirmado por webhook/consulta ao provedor; motivo: lojas independentes sem fallback entre elas.
- O modelo de checkout é salvo em `store_settings.checkout.checkout_model`; `/pagamento` permanece o Checkout 1 e `/pagamento-2` é apenas uma segunda interface sobre as mesmas funções de pedido e PIX.
- Meta Pixel por loja em `store_meta_settings` (token CAPI só no servidor); navegador via `src/lib/meta-pixel.ts`; Purchase server-side em `sendPurchaseForOrder` com trava `orders.meta_purchase_sent_at`; motivo: sem compras duplicadas.
- Store favicon (`store_settings.favicon_url`) is applied client-side by `useStoreFavicon` inside StoreLogo/StoreHeader; why: every store page and checkout already renders them, so no per-route head wiring.
- Review CSV import parses in the browser and appends into `products.reviews` (same editable list, saved with the product); external image URLs are copied into storage by `importReviewImages`; why: no separate review table.
- PIX recovery outside checkout uses `orders.access_token` remembered in the browser (`src/lib/pix-orders.ts`) and `getPixOrders`, which only reads the saved charge and reconfirms status; why: customers keep their PIX without login and no duplicate charge is ever created.
- Shipping is a single free modality defined in `src/lib/shipping.ts` read by every page and createOrder; why: one consistent rule.
- Checkouts reopen a PIX only when the URL carries ?pedido=<number> matching the browser's last order (set after PIX creation); plain checkout visits always start a new purchase; why: an old PIX must never hijack Comprar agora.
- New PIX charges get a 15-minute store-side window saved in orders.pix_expiration_date (Wappi only accepts whole days); why: real, persisted countdown that survives refresh.
- Product Q&A AI: per-product toggles/texts in products.sections (qa_*), per-store AI facts and support contacts in store_settings.ai_support (never in public selects); context built server-side from product_id + its store_id; why: no cross-store leakage and no secrets in the client.
- PIX recovery toggles per store live in store_settings.checkout.pix_recovery, resolved by resolvePixRecovery and enforced server-side in getPixOrders; why: OFF hides UI without touching orders.
- Product photos are resized on demand via `/api/public/media/<path>?w=` (allowed widths in `IMG_WIDTHS`, storage transform delivers WebP) and components use `sizedImage`/`imageSrcSet` from `src/lib/media-url.ts`; why: originals stay untouched while phones download small files.
- Recuperação de PIX via WhatsApp: config por loja em `store_whatsapp_settings` (segredos só no servidor), pg_cron por minuto chama /api/public/hooks/pix-whatsapp autenticado por token em `internal_job_tokens`, trava de duplicidade por UNIQUE(order_id, step) em `whatsapp_pix_reminders`; motivo: sem duplicatas nem lojas misturadas.
- Payment methods per store: store_settings.checkout.payment_methods. Card orders (method "card", no PIX discount) are charged by `payOrderWithCard` with server-side installments, card data in memory only; status only from the gateway. Order total includes the PIX discount (product_snapshot.pix_discount); card→PIX fallback converts the same order via `switchOrderToPix` then reuses createPixCharge; why: no browser prices, no duplicate orders or double charge.
- Subdirectories may have their own `AGENTS.md`; read it before changing files there.
- UTMify por loja em `store_utmify_settings` (token só no servidor); `syncUtmifyOrder` envia waiting_payment ao criar PIX e paid via `sendPurchaseForOrder`, com trava `orders.utmify_sent_status`; UTMs capturadas no navegador (`src/lib/utm-tracking.ts`) e salvas em `orders.tracking_params`; motivo: um envio por status, sem duplicar.
- Coupon chip/bar settings live per product in products.sections.coupon_promo; a product's own countdown duration gives one persisted deadline for all its timers (`useStoreCountdown`), else store checkout.offer_countdown; why: independent products, synced timers.
