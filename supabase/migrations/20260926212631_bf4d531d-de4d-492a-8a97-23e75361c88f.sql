ALTER TABLE public.store_settings
  ADD COLUMN slug text,
  ADD COLUMN active boolean NOT NULL DEFAULT true,
  ADD COLUMN is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN checkout jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.store_settings SET slug = 'principal' WHERE slug IS NULL;
UPDATE public.store_settings SET is_default = true
  WHERE id = (SELECT id FROM public.store_settings ORDER BY created_at LIMIT 1);

ALTER TABLE public.store_settings ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX store_settings_slug_key ON public.store_settings (slug);
CREATE UNIQUE INDEX store_settings_one_default ON public.store_settings (is_default) WHERE is_default;

ALTER TABLE public.products ADD COLUMN store_id uuid REFERENCES public.store_settings(id) ON DELETE RESTRICT;
UPDATE public.products SET store_id = (SELECT id FROM public.store_settings WHERE is_default LIMIT 1) WHERE store_id IS NULL;
CREATE INDEX products_store_id_idx ON public.products (store_id);

ALTER TABLE public.orders ADD COLUMN store_id uuid REFERENCES public.store_settings(id) ON DELETE RESTRICT;
UPDATE public.orders o SET store_id = p.store_id FROM public.products p WHERE o.product_id = p.id AND o.store_id IS NULL;

DROP POLICY IF EXISTS "store settings are public" ON public.store_settings;
CREATE POLICY "active stores are public" ON public.store_settings FOR SELECT TO anon, authenticated USING (active = true);