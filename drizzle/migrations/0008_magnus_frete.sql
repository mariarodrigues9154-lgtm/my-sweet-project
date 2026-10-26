CREATE TABLE public.store_magnus_settings (
  store_id uuid PRIMARY KEY REFERENCES public.store_settings(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  api_token text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_magnus_settings TO authenticated;
GRANT ALL ON public.store_magnus_settings TO service_role;
ALTER TABLE public.store_magnus_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage magnus settings" ON public.store_magnus_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.order_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.store_settings(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'magnus',
  send_status text NOT NULL DEFAULT 'enviando' CHECK (send_status IN ('enviando','enviado','falhou','incerto','manual')),
  tracking_code text,
  provider_order_id text,
  provider_shipment_id text,
  delivery_status text NOT NULL DEFAULT 'aguardando_postagem' CHECK (delivery_status IN ('aguardando_postagem','postado','em_transito','saiu_para_entrega','entregue','devolvido','problema')),
  http_status integer,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_shipments_store_idx ON public.order_shipments(store_id, created_at DESC);
GRANT SELECT ON public.order_shipments TO authenticated;
GRANT ALL ON public.order_shipments TO service_role;
ALTER TABLE public.order_shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read shipments" ON public.order_shipments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER touch_order_shipments BEFORE UPDATE ON public.order_shipments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();