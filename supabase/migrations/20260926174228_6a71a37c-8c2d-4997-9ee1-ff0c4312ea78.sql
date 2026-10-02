ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS footer_logo_url text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sections jsonb NOT NULL DEFAULT '{}'::jsonb;