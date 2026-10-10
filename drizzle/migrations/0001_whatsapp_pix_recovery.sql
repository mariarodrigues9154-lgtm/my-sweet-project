CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE public.store_whatsapp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE REFERENCES public.store_settings(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  provider text NOT NULL DEFAULT 'meta',
  sender text,
  secret_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  public_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  message text NOT NULL DEFAULT '',
  delays integer[] NOT NULL DEFAULT '{15}',
  max_reminders integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_whatsapp_settings TO authenticated;
GRANT ALL ON public.store_whatsapp_settings TO service_role;
ALTER TABLE public.store_whatsapp_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage whatsapp settings" ON public.store_whatsapp_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.whatsapp_pix_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.store_settings(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  step integer NOT NULL,
  status text NOT NULL DEFAULT 'processando',
  detail text,
  phone_masked text,
  pix_status text,
  provider_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, step)
);
CREATE INDEX whatsapp_pix_reminders_store_idx ON public.whatsapp_pix_reminders(store_id, created_at DESC);
GRANT SELECT ON public.whatsapp_pix_reminders TO authenticated;
GRANT ALL ON public.whatsapp_pix_reminders TO service_role;
ALTER TABLE public.whatsapp_pix_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read whatsapp reminders" ON public.whatsapp_pix_reminders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.internal_job_tokens (
  name text PRIMARY KEY,
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex')
);
GRANT ALL ON public.internal_job_tokens TO service_role;
ALTER TABLE public.internal_job_tokens ENABLE ROW LEVEL SECURITY;
INSERT INTO public.internal_job_tokens(name) VALUES ('pix_whatsapp') ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS orders_pending_created_idx ON public.orders(created_at) WHERE status = 'aguardando_pagamento';