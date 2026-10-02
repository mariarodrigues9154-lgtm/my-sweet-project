CREATE TABLE public.order_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.store_settings(id),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  reason text,
  status text NOT NULL DEFAULT 'solicitado' CHECK (status IN ('solicitado','processando','concluido','falhou','manual')),
  provider text,
  provider_refund_id text,
  provider_status text,
  error text,
  requested_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.order_refunds TO authenticated;
GRANT ALL ON public.order_refunds TO service_role;
ALTER TABLE public.order_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read refunds" ON public.order_refunds FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX order_refunds_order_idx ON public.order_refunds(order_id);
CREATE TRIGGER touch_order_refunds BEFORE UPDATE ON public.order_refunds FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();