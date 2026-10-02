ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS provider_status text,
  ADD COLUMN IF NOT EXISTS e2e text,
  ADD COLUMN IF NOT EXISTS pix_expiration_date timestamptz,
  ADD COLUMN IF NOT EXISTS total_amount_cents integer;
CREATE UNIQUE INDEX IF NOT EXISTS orders_provider_tx_unique ON public.orders (payment_provider, transaction_id) WHERE transaction_id IS NOT NULL;