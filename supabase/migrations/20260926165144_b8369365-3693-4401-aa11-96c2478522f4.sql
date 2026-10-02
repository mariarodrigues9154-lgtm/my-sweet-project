ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS banner_link text,
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sold_count integer NOT NULL DEFAULT 0 CHECK (sold_count >= 0),
  ADD COLUMN IF NOT EXISTS show_follow boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_message boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS indicators jsonb NOT NULL DEFAULT '[{"value":"","label":"Avaliação"},{"value":"","label":"Vendidos"},{"value":"","label":"Envio"}]'::jsonb,
  ADD COLUMN IF NOT EXISTS featured_product_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS footer_text text,
  ADD COLUMN IF NOT EXISTS policies jsonb NOT NULL DEFAULT '{"privacy":"","refund":"","terms":"","shipping":""}'::jsonb;

GRANT SELECT ON public.store_settings TO anon, authenticated;
GRANT ALL ON public.store_settings TO service_role;

UPDATE public.store_settings
SET visit_url = '/loja'
WHERE visit_url IS NULL OR btrim(visit_url) = '' OR visit_url = '/';