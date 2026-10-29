CREATE TABLE public.store_payment_gateways (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL REFERENCES public.store_settings(id) ON DELETE CASCADE,
 provider text NOT NULL,
 environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
 public_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(public_data)='object'),
 secret_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(secret_data)='object'),
 pix_config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(pix_config)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(store_id,provider),
 CHECK(provider IN ('wappi','freepay','pinpay','blackcat','invictuspay','codefy','umbrellapag','westpay','mercadopago','asaas'))
);
GRANT ALL ON public.store_payment_gateways TO service_role;
ALTER TABLE public.store_payment_gateways ENABLE ROW LEVEL SECURITY;
INSERT INTO public.store_payment_gateways(store_id,provider,environment,public_data,secret_data,pix_config,created_at,updated_at)
 SELECT store_id,provider,environment,public_data,secret_data,pix_config,created_at,updated_at FROM public.store_payment_settings WHERE provider <> 'none';
COMMENT ON TABLE public.store_payment_gateways IS 'Server-only independent credentials per store and provider. No browser access.';
COMMENT ON TABLE public.store_payment_settings IS 'Unique active-provider selector and independent payments enabled flag; credentials are a compatibility snapshot for previously published code.';
CREATE FUNCTION public.save_store_payment_gateway(p_store_id uuid,p_provider text,p_environment text,p_public_data jsonb,p_secret_data jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.store_payment_settings(store_id) VALUES(p_store_id) ON CONFLICT(store_id) DO NOTHING;
 PERFORM id FROM public.store_payment_settings WHERE store_id=p_store_id FOR UPDATE;
 INSERT INTO public.store_payment_gateways(store_id,provider,environment,public_data,secret_data) VALUES(p_store_id,p_provider,p_environment,p_public_data,p_secret_data)
 ON CONFLICT(store_id,provider) DO UPDATE SET environment=EXCLUDED.environment,public_data=EXCLUDED.public_data,secret_data=store_payment_gateways.secret_data || EXCLUDED.secret_data,updated_at=now();
 UPDATE public.store_payment_settings s SET environment=g.environment,public_data=g.public_data,secret_data=g.secret_data,pix_config=g.pix_config FROM public.store_payment_gateways g WHERE s.store_id=p_store_id AND g.store_id=s.store_id AND g.provider=p_provider AND s.provider=g.provider;
END;
$$;
REVOKE ALL ON FUNCTION public.save_store_payment_gateway(uuid,text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_store_payment_gateway(uuid,text,text,jsonb,jsonb) TO service_role;
CREATE FUNCTION public.activate_store_payment_gateway(p_store_id uuid,p_provider text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE g public.store_payment_gateways; required text[]; k text;
BEGIN
 PERFORM id FROM public.store_payment_settings WHERE store_id=p_store_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Loja sem configuração de pagamentos'; END IF;
 SELECT * INTO g FROM public.store_payment_gateways WHERE store_id=p_store_id AND provider=p_provider FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Gateway não cadastrado'; END IF;
 required := CASE p_provider WHEN 'westpay' THEN ARRAY['public_key','secret_key'] WHEN 'wappi' THEN ARRAY['public_key','secret_key'] WHEN 'freepay' THEN ARRAY['public_key','secret_key'] WHEN 'codefy' THEN ARRAY['public_key','secret_key'] WHEN 'pinpay' THEN ARRAY['secret_key'] WHEN 'mercadopago' THEN ARRAY['access_token'] ELSE ARRAY['api_key'] END;
 FOREACH k IN ARRAY required LOOP
 IF nullif(btrim(COALESCE(g.secret_data->>k,g.public_data->>k,'')),'') IS NULL THEN RAISE EXCEPTION 'Credenciais obrigatórias ausentes'; END IF;
 END LOOP;
 UPDATE public.store_payment_settings SET provider=g.provider,environment=g.environment,public_data=g.public_data,secret_data=g.secret_data,pix_config=g.pix_config WHERE store_id=p_store_id;
END;
$$;
REVOKE ALL ON FUNCTION public.activate_store_payment_gateway(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.activate_store_payment_gateway(uuid,text) TO service_role;