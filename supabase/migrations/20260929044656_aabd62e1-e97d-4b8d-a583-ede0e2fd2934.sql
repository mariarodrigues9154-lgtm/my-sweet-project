CREATE TABLE public.store_meta_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE REFERENCES public.store_settings(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  pixel_id text,
  track_pending boolean NOT NULL DEFAULT true,
  capi_token text,
  test_event_code text,
  test_event_code_set_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_meta_settings TO authenticated;
GRANT ALL ON public.store_meta_settings TO service_role;
ALTER TABLE public.store_meta_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage meta settings" ON public.store_meta_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER touch_store_meta_settings BEFORE UPDATE ON public.store_meta_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.orders
  ADD COLUMN meta_purchase_sent_at timestamptz,
  ADD COLUMN meta_purchase_event_id text,
  ADD COLUMN meta_attribution jsonb NOT NULL DEFAULT '{}'::jsonb;