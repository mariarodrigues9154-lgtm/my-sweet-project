ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS favicon_url text,
  ADD COLUMN IF NOT EXISTS show_footer boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_support jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS access_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex');
CREATE UNIQUE INDEX IF NOT EXISTS orders_access_token_key ON public.orders(access_token);