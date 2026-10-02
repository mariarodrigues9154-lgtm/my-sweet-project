REVOKE EXECUTE ON FUNCTION public.grant_first_user_admin() FROM PUBLIC, anon, authenticated;

CREATE TABLE public.meta_event_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.store_settings(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  event_id text,
  order_number text,
  source text NOT NULL DEFAULT 'servidor',
  ok boolean NOT NULL,
  http_status integer,
  error text,
  test_mode boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meta_event_logs_store_idx ON public.meta_event_logs(store_id, created_at DESC);
GRANT SELECT ON public.meta_event_logs TO authenticated;
GRANT ALL ON public.meta_event_logs TO service_role;
ALTER TABLE public.meta_event_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read meta logs" ON public.meta_event_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));