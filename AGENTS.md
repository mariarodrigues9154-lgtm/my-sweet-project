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

- Product headers resolve display overrides against store checkout flags in StoreHeader; identity and content stay in existing JSON; why: reuse pages.
- Creator verification uses the existing flag and optional style in creator_videos JSON, with one badge for both layouts; why: preserve legacy appearance without tables.
- The public store hub is `/loja`; product profile “Visitar” links always use this internal route.
- Large media (videos) upload browser-direct via signed upload URLs (createMediaUpload/finalizeMediaUpload) to the private product-images bucket; why: server-fn base64 limits.
- Product settings use sections; economy_banner has shared resolver/schema, bold ranges and safe text renderer; store flags use checkout; why: isolation without HTML.
- Video-title fields use shared videosTitleSchema on save; CreatorVideos scopes color to its title SVG; why: preserve icon settings without coloring sibling text or changing videos.
- `store_payment_gateways` holds server-only store/provider credentials; `store_payment_settings` selects one PIX provider plus enabled flag/legacy snapshot. Locked RPCs save/activate; old transactions use original provider. Why: safe switching.
- O modelo de checkout é salvo em `store_settings.checkout.checkout_model`; `/pagamento` permanece o Checkout 1 e `/pagamento-2` é apenas uma segunda interface sobre as mesmas funções de pedido e PIX.
- Meta Pixel por loja em `store_meta_settings` (token CAPI só no servidor); navegador via `src/lib/meta-pixel.ts`; Purchase server-side em `sendPurchaseForOrder` com trava `orders.meta_purchase_sent_at`; motivo: sem compras duplicadas.
- Store favicon (`store_settings.favicon_url`) is applied client-side by `useStoreFavicon` inside StoreLogo/StoreHeader; why: every store page and checkout already renders them, so no per-route head wiring.
- Review CSV import parses in the browser and appends into `products.reviews`; external image URLs are copied into storage by `importReviewImages`; why: no separate review table.
- PIX recovery outside checkout uses `orders.access_token` remembered in the browser (`src/lib/pix-orders.ts`) and `getPixOrders`, which only reads the saved charge and reconfirms status; why: customers keep their PIX without login and no duplicate charge is ever created.
- Shipping is a single free modality defined in `src/lib/shipping.ts` read by every page and createOrder; why: one consistent rule.
- Checkouts reopen a PIX only when the URL carries ?pedido=<number> matching the browser's last order (set after PIX creation); plain checkout visits always start a new purchase; why: an old PIX must never hijack Comprar agora.
- New PIX charges get a 15-minute store-side window saved in orders.pix_expiration_date (Wappi only accepts whole days); why: real, persisted countdown that survives refresh.
- Product Q&A AI: per-product toggles/texts in products.sections (qa_*), per-store AI facts and support contacts in store_settings.ai_support (never in public selects); context built server-side from product_id + its store_id; why: no cross-store leakage and no secrets in the client.
- PIX recovery toggles per store live in store_settings.checkout.pix_recovery, resolved by resolvePixRecovery and enforced server-side in getPixOrders; why: OFF hides UI without touching orders.
- Product photos are resized on demand via `/api/public/media/<path>?w=` (widths in `IMG_WIDTHS`, WebP) using `sizedImage`/`imageSrcSet` from `src/lib/media-url.ts`; why: originals untouched, phones download small files.
- WhatsApp: server-only secrets, cron auth, UNIQUE(order_id, step), service-only atomic global dispatch gate; stop after one attempt including failed retries. Skip paid, superseded or recently messaged customers (phone/CPF/email, 24h). Full phones require auth/role checks. Tests use vitest.config.ts without RPC transforms. Why: private, paced recovery.
- PlugSend tests use isolated RPC/helper, saved store token, exact text and safe result DTOs; last-test UI is session-local; why: preserve orders/secrets.
- Payment methods live in checkout JSON; card totals/installments are server-validated. confirmCardOrder shares gateway confirmation across callbacks/3DS/polling using original transaction/method; admin uses saved method. switchOrderToPix reuses the order; why: no false payment or duplicate charge.
- Protection settings/texts live in checkout.customer_protection with shared validation/rendering; original uses untouched product protection; why: isolate stores and preserve products.
- Read nested `AGENTS.md` before edits.
- Admin search uses a label catalog, section anchors and ProductEditor; it opens editors, never toggles business settings. Sync conditional labels with the catalog.
- UTMify por loja em `store_utmify_settings` (token só no servidor); `syncUtmifyOrder` envia waiting_payment ao criar PIX e paid via `sendPurchaseForOrder`, com trava `orders.utmify_sent_status`; UTMs do navegador (`src/lib/utm-tracking.ts`) em `orders.tracking_params`; logs guardam só status/tempos, sem payloads; motivo: um envio por status, sem duplicar.
- Coupon chip/bar settings live per product in products.sections.coupon_promo; emphasis comes only from explicit highlight_text/secondary_text (legacy bar_text stays as secondary text); a product's own countdown duration gives one persisted deadline for all its timers (`useStoreCountdown`), else store checkout.offer_countdown; why: independent products, synced timers, backward-compatible content.
- Magnus Frete: settings per store + order_shipments UNIQUE(order_id); sent only from sendPurchaseForOrder; network errors become "incerto", never auto-retried; why: API not idempotent.
- PIX final-screen display toggles/texts live in store_settings.checkout.pix_page (resolvePixPage); optional payment proofs go to private storage payment-proofs/<order_id> and never change order status; why: per-store UI without touching payment logic.
- Variant promos use variant_combos.promo_badge via optionPromoBadge, image cards only; sold_out/sold_out_text use variants.options, shared schema and variantPricing (UI/server); why: per-product isolation without overwriting prices/stock.
