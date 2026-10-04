CREATE TABLE public.pix_recovery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.store_settings(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('notice_shown','code_copied','chat_opened','renewed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pix_recovery_events_store_idx ON public.pix_recovery_events(store_id, event_type);
CREATE INDEX pix_recovery_events_order_idx ON public.pix_recovery_events(order_id);
GRANT SELECT ON public.pix_recovery_events TO authenticated;
GRANT ALL ON public.pix_recovery_events TO service_role;
ALTER TABLE public.pix_recovery_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read pix recovery events" ON public.pix_recovery_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));