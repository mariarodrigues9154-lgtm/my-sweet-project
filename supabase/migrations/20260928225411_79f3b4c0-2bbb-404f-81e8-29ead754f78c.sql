CREATE TABLE public.store_payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE REFERENCES public.store_settings(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'none',
  enabled boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  public_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  pix_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_payment_provider_valid CHECK (provider IN ('none', 'mercadopago', 'asaas')),
  CONSTRAINT store_payment_environment_valid CHECK (environment IN ('sandbox', 'production')),
  CONSTRAINT store_payment_public_data_object CHECK (jsonb_typeof(public_data) = 'object'),
  CONSTRAINT store_payment_secret_data_object CHECK (jsonb_typeof(secret_data) = 'object'),
  CONSTRAINT store_payment_pix_config_object CHECK (jsonb_typeof(pix_config) = 'object')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_payment_settings TO authenticated;
GRANT ALL ON public.store_payment_settings TO service_role;

ALTER TABLE public.store_payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage store payment settings" ON public.store_payment_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_store_payment_settings
  BEFORE UPDATE ON public.store_payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.store_payment_settings (store_id)
SELECT id FROM public.store_settings
ON CONFLICT (store_id) DO NOTHING;

ALTER TABLE public.orders
  ADD COLUMN payment_provider text,
  ADD COLUMN payment_method text,
  ADD COLUMN transaction_id text,
  ADD COLUMN paid_at timestamptz;

CREATE INDEX orders_transaction_id_idx ON public.orders (transaction_id) WHERE transaction_id IS NOT NULL;