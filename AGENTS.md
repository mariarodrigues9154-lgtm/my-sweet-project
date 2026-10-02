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
