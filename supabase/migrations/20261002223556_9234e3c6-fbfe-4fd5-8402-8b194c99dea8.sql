CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.grant_first_user_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created_grant_role AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_first_user_admin();

REVOKE ALL ON FUNCTION public.grant_first_user_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.store_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '[NOME DA MINHA LOJA]',
  logo_url text, tagline text, support_email text, whatsapp text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  visit_url text, avatar_url text, cover_url text, banner_url text, banner_link text,
  verified boolean NOT NULL DEFAULT true,
  sold_count integer NOT NULL DEFAULT 0 CHECK (sold_count >= 0),
  show_follow boolean NOT NULL DEFAULT true,
  show_message boolean NOT NULL DEFAULT true,
  indicators jsonb NOT NULL DEFAULT '[{"value":"","label":"Avaliação"},{"value":"","label":"Vendidos"},{"value":"","label":"Envio"}]'::jsonb,
  featured_product_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  footer_text text,
  policies jsonb NOT NULL DEFAULT '{"privacy":"","refund":"","terms":"","shipping":""}'::jsonb,
  footer_logo_url text,
  slug text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  checkout jsonb NOT NULL DEFAULT '{}'::jsonb,
  show_visit boolean NOT NULL DEFAULT true,
  visit_clickable boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX store_settings_slug_key ON public.store_settings (slug);
CREATE UNIQUE INDEX store_settings_one_default ON public.store_settings (is_default) WHERE is_default;
GRANT SELECT ON public.store_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_settings TO authenticated;
GRANT ALL ON public.store_settings TO service_role;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "active stores are public" ON public.store_settings FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "admins manage store settings" ON public.store_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER touch_store_settings BEFORE UPDATE ON public.store_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  name text NOT NULL, title text NOT NULL, subtitle text,
  price numeric(10,2) NOT NULL, previous_price numeric(10,2) NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  rating numeric(2,1) NOT NULL DEFAULT 5.0,
  reviews_count integer NOT NULL DEFAULT 0,
  sold_count integer NOT NULL DEFAULT 0,
  offer jsonb NOT NULL DEFAULT '{}'::jsonb,
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  variants jsonb NOT NULL DEFAULT '[]'::jsonb,
  shipping jsonb NOT NULL DEFAULT '{}'::jsonb,
  warranty text,
  protection jsonb NOT NULL DEFAULT '{}'::jsonb,
  specs jsonb NOT NULL DEFAULT '[]'::jsonb,
  description jsonb NOT NULL DEFAULT '[]'::jsonb,
  creator_videos jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviews jsonb NOT NULL DEFAULT '[]'::jsonb,
  terms text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sections jsonb NOT NULL DEFAULT '{}'::jsonb,
  store_id uuid REFERENCES public.store_settings(id) ON DELETE RESTRICT,
  variant_combos jsonb NOT NULL DEFAULT '[]'::jsonb,
  display jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT products_price_positive CHECK (price > 0),
  CONSTRAINT products_previous_price_gte CHECK (previous_price >= price),
  CONSTRAINT products_stock_nonneg CHECK (stock >= 0),
  CONSTRAINT products_rating_range CHECK (rating >= 0 AND rating <= 5),
  CONSTRAINT products_counts_nonneg CHECK (reviews_count >= 0 AND sold_count >= 0),
  CONSTRAINT products_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT products_name_len CHECK (char_length(btrim(name)) >= 2 AND char_length(btrim(title)) >= 2),
  CONSTRAINT products_json_shapes CHECK (
    jsonb_typeof(media)='array' AND jsonb_typeof(variants)='array' AND jsonb_typeof(specs)='array'
    AND jsonb_typeof(description)='array' AND jsonb_typeof(creator_videos)='array' AND jsonb_typeof(reviews)='array'
    AND jsonb_typeof(offer)='object' AND jsonb_typeof(shipping)='object' AND jsonb_typeof(protection)='object'
    AND jsonb_typeof(sections)='object'
    AND jsonb_array_length(creator_videos) <= 7 AND jsonb_array_length(media) <= 20)
);
CREATE INDEX products_store_id_idx ON public.products (store_id);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "active products are public" ON public.products FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "admins read all products" ON public.products FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update products" ON public.products FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete products" ON public.products FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER touch_products BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  variant jsonb NOT NULL DEFAULT '{}'::jsonb,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL,
  subtotal numeric(10,2) NOT NULL,
  shipping_label text,
  shipping_price numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL,
  customer jsonb NOT NULL DEFAULT '{}'::jsonb,
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'aguardando_pagamento',
  payment jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  store_id uuid REFERENCES public.store_settings(id) ON DELETE RESTRICT,
  payment_provider text, payment_method text, transaction_id text, paid_at timestamptz,
  provider_status text, e2e text, pix_expiration_date timestamptz, total_amount_cents integer,
  meta_purchase_sent_at timestamptz, meta_purchase_event_id text,
  meta_attribution jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX orders_transaction_id_idx ON public.orders (transaction_id) WHERE transaction_id IS NOT NULL;
CREATE UNIQUE INDEX orders_provider_tx_unique ON public.orders (payment_provider, transaction_id) WHERE transaction_id IS NOT NULL;
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER touch_orders BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

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
  CONSTRAINT store_payment_provider_valid CHECK (provider = ANY (ARRAY['none','wappi','mercadopago','asaas'])),
  CONSTRAINT store_payment_environment_valid CHECK (environment IN ('sandbox', 'production')),
  CONSTRAINT store_payment_public_data_object CHECK (jsonb_typeof(public_data) = 'object'),
  CONSTRAINT store_payment_secret_data_object CHECK (jsonb_typeof(secret_data) = 'object'),
  CONSTRAINT store_payment_pix_config_object CHECK (jsonb_typeof(pix_config) = 'object')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_payment_settings TO authenticated;
GRANT ALL ON public.store_payment_settings TO service_role;
ALTER TABLE public.store_payment_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage store payment settings" ON public.store_payment_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER touch_store_payment_settings BEFORE UPDATE ON public.store_payment_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.order_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.store_settings(id),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  reason text,
  status text NOT NULL DEFAULT 'solicitado' CHECK (status IN ('solicitado','processando','concluido','falhou','manual')),
  provider text, provider_refund_id text, provider_status text, error text, requested_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.order_refunds TO authenticated;
GRANT ALL ON public.order_refunds TO service_role;
ALTER TABLE public.order_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read refunds" ON public.order_refunds FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX order_refunds_order_idx ON public.order_refunds(order_id);
CREATE TRIGGER touch_order_refunds BEFORE UPDATE ON public.order_refunds FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.store_meta_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE REFERENCES public.store_settings(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  pixel_id text,
  track_pending boolean NOT NULL DEFAULT true,
  capi_token text, test_event_code text, test_event_code_set_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_meta_settings TO authenticated;
GRANT ALL ON public.store_meta_settings TO service_role;
ALTER TABLE public.store_meta_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage meta settings" ON public.store_meta_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER touch_store_meta_settings BEFORE UPDATE ON public.store_meta_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.meta_event_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.store_settings(id) ON DELETE CASCADE,
  event_name text NOT NULL, event_id text, order_number text,
  source text NOT NULL DEFAULT 'servidor',
  ok boolean NOT NULL, http_status integer, error text,
  test_mode boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meta_event_logs_store_idx ON public.meta_event_logs(store_id, created_at DESC);
GRANT SELECT ON public.meta_event_logs TO authenticated;
GRANT ALL ON public.meta_event_logs TO service_role;
ALTER TABLE public.meta_event_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read meta logs" ON public.meta_event_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));