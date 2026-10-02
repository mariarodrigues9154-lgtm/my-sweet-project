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
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.grant_first_user_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_grant_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_first_user_admin();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.store_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '[NOME DA MINHA LOJA]',
  logo_url text,
  tagline text,
  support_email text,
  whatsapp text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.store_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.store_settings TO authenticated;
GRANT ALL ON public.store_settings TO service_role;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "store settings are public" ON public.store_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage store settings" ON public.store_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER touch_store_settings BEFORE UPDATE ON public.store_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  name text NOT NULL,
  title text NOT NULL,
  subtitle text,
  price numeric(10,2) NOT NULL,
  previous_price numeric(10,2) NOT NULL,
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
  updated_at timestamptz NOT NULL DEFAULT now()
);
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
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER touch_orders BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.store_settings (name, tagline, support_email, whatsapp)
VALUES ('[NOME DA MINHA LOJA]', 'Produtos selecionados com entrega para todo o Brasil', 'contato@minhaloja.com.br', '(00) 00000-0000');

INSERT INTO public.products (
  slug, name, title, subtitle, price, previous_price, stock, rating, reviews_count, sold_count,
  offer, media, variants, shipping, warranty, protection, specs, description, creator_videos, reviews, terms, sort_order
) VALUES (
  'extratora-portatil',
  'Extratora Portátil 1200W',
  'Extratora Portátil Higienizadora de Sofá Estofados e Carro 1200W 4 Litros',
  'Higienização profunda em casa, sem contratar serviço',
  87.90,
  474.90,
  37,
  4.6,
  722,
  6065,
  $j${"badge":"OFERTA DE LANÇAMENTO","highlight":"Somente hoje","flash_label":"Oferta Relâmpago","countdown_seconds":507}$j$::jsonb,
  $j$[
    {"type":"image","url":"/__l5e/assets-v1/de5230e0-821e-460a-ae9e-822f5936199f/p1.jpg","alt":"Extratora portátil na sala"},
    {"type":"image","url":"/__l5e/assets-v1/c9877d34-3263-4e04-a017-50d3eb24ac1b/p2.jpg","alt":"Detalhe do reservatório e bico"},
    {"type":"image","url":"/__l5e/assets-v1/0c6fc949-d857-4c3f-bad5-ae09ebf56b91/p3.jpg","alt":"Higienizando sofá de tecido"},
    {"type":"image","url":"/__l5e/assets-v1/176abafd-66a6-4463-8f1d-8909613d746c/p4.jpg","alt":"Higienizando banco de carro"}
  ]$j$::jsonb,
  $j$[
    {"name":"cor","label":"Selecione uma cor","options":[
      {"label":"Azul Marinho","value":"azul-marinho"},
      {"label":"Preto","value":"preto"},
      {"label":"Cinza","value":"cinza"}
    ]},
    {"name":"voltagem","label":"Selecione a voltagem","options":[
      {"label":"110V","value":"110v"},
      {"label":"220V","value":"220v"}
    ]}
  ]$j$::jsonb,
  $j${"free":true,"fee":14.60,"min_days":4,"max_days":9,"options":[
    {"id":"gratis","label":"FRETE GRÁTIS","eta":"10 a 12 dias úteis","price":0},
    {"id":"expresso","label":"EXPRESSO","eta":"até 5 dias úteis","price":24.90},
    {"id":"sedex","label":"SEDEX","eta":"1 a 2 dias úteis","price":49.90}
  ]}$j$::jsonb,
  '12 meses de garantia direto com a loja',
  $j${"title":"Proteção da compra","subtitle":"Compra protegida do pedido à entrega","items":["Pagamento seguro","Suporte ao cliente","Política de devolução em 7 dias","Rastreamento do pedido"]}$j$::jsonb,
  $j$[
    {"label":"Potência","value":"1200W"},
    {"label":"Capacidade do reservatório","value":"4 litros"},
    {"label":"Pressão","value":"até 15 kPa"},
    {"label":"Comprimento da mangueira","value":"1,8 m"},
    {"label":"Dimensões","value":"38 x 24 x 30 cm"},
    {"label":"Peso","value":"4,2 kg"},
    {"label":"Itens inclusos","value":"Aparelho, bico triangular, escova, mangueira e manual"},
    {"label":"Garantia","value":"12 meses"}
  ]$j$::jsonb,
  $j$[
    {"type":"heading","text":"Limpeza profunda em minutos"},
    {"type":"paragraph","text":"A extratora injeta água com produto e aspira de volta a sujeira dissolvida, removendo manchas antigas de sofá, colchão, tapete, poltrona e bancos de carro sem molhar demais o tecido."},
    {"type":"list","items":["Remove manchas de café, refrigerante, pet e gordura","Reduz ácaros e odores impregnados","Seca rápido: o tecido fica úmido, não encharcado","Cabe em qualquer armário e pesa pouco"]},
    {"type":"image","url":"/__l5e/assets-v1/0c6fc949-d857-4c3f-bad5-ae09ebf56b91/p3.jpg","alt":"Antes e depois no sofá"},
    {"type":"heading","text":"Também no carro"},
    {"type":"paragraph","text":"Com a mangueira de 1,8 m você higieniza bancos, forro, porta-malas e carpete sem precisar levar o carro à estética automotiva."},
    {"type":"image","url":"/__l5e/assets-v1/176abafd-66a6-4463-8f1d-8909613d746c/p4.jpg","alt":"Banco de carro higienizado"}
  ]$j$::jsonb,
  $j$[
    {"handle":"@mari.emcasa","thumb":"/__l5e/assets-v1/46dd4018-212a-4a14-980e-3779430c2e20/v1.jpg","video":null},
    {"handle":"@carro.limpo.br","thumb":"/__l5e/assets-v1/99749c4c-c54b-4060-b4ec-63c08a0ed5ef/v2.jpg","video":null}
  ]$j$::jsonb,
  $j$[
    {"name":"Isabela N.","rating":5,"date":"Há 2 horas","confirmed":true,"text":"Chegou rápido e usei no mesmo dia no sofá da sala. A água que saiu do reservatório estava preta, inacreditável.","photos":["/__l5e/assets-v1/0c6fc949-d857-4c3f-bad5-ae09ebf56b91/p3.jpg"]},
    {"name":"Camila S.","rating":5,"date":"Há 5 horas","confirmed":true,"text":"Muito bem embalada, sem nenhum arranhão. Fácil de montar e o manual explica direitinho.","photos":[]},
    {"name":"Fernanda M.","rating":4,"date":"Há 1 dia","confirmed":true,"text":"Funciona muito bem, só achei o cabo um pouco curto. Uso com extensão e resolve.","photos":[]},
    {"name":"Juliana R.","rating":5,"date":"Há 2 dias","confirmed":true,"text":"Limpei os bancos do carro e ficou como novo. Economizei o valor de duas higienizações.","photos":["/__l5e/assets-v1/176abafd-66a6-4463-8f1d-8909613d746c/p4.jpg"]},
    {"name":"Patrícia L.","rating":5,"date":"Há 3 dias","confirmed":true,"text":"Tenho dois cachorros e o cheiro do sofá acabou. Já recomendei para a minha irmã.","photos":[]},
    {"name":"Ana Clara D.","rating":4,"date":"Há 4 dias","confirmed":true,"text":"Boa sucção e silenciosa para a potência. Vale o preço da promoção.","photos":[]}
  ]$j$::jsonb,
  'Preços e prazos válidos enquanto durarem os estoques. Prazo de entrega contado em dias úteis após a confirmação do pagamento. Trocas e devoluções em até 7 dias corridos após o recebimento, conforme o Código de Defesa do Consumidor.',
  1
);