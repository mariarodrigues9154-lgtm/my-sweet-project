CREATE TABLE public.store_utmify_settings (
  store_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  api_token text,
  utm_script_enabled boolean NOT NULL DEFAULT false,
  utm_script_src text,
  pixel_enabled boolean NOT NULL DEFAULT false,
  pixel_id text,
  pixel_script_src text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_utmify_settings TO authenticated;
GRANT ALL ON public.store_utmify_settings TO service_role;
ALTER TABLE public.store_utmify_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage utmify settings" ON public.store_utmify_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.utmify_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  order_number text,
  status text NOT NULL,
  ok boolean NOT NULL,
  http_status integer,
  error text,
  test_mode boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.utmify_logs TO authenticated;
GRANT ALL ON public.utmify_logs TO service_role;
ALTER TABLE public.utmify_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read utmify logs" ON public.utmify_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX utmify_logs_store_idx ON public.utmify_logs (store_id, created_at DESC);

ALTER TABLE public.orders
  ADD COLUMN tracking_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN utmify_sent_status text,
  ADD COLUMN utmify_sent_at timestamptz;