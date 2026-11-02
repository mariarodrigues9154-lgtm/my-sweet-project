CREATE TABLE public.whatsapp_recovery_dispatch_gate (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  next_attempt_at timestamptz NOT NULL
);
GRANT ALL ON public.whatsapp_recovery_dispatch_gate TO service_role;
ALTER TABLE public.whatsapp_recovery_dispatch_gate ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_only_dispatch_gate ON public.whatsapp_recovery_dispatch_gate FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE OR REPLACE FUNCTION public.claim_whatsapp_recovery_dispatch()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE claimed boolean;
BEGIN
  INSERT INTO public.whatsapp_recovery_dispatch_gate(id, next_attempt_at)
  VALUES (true, clock_timestamp() + interval '5 minutes')
  ON CONFLICT (id) DO UPDATE SET next_attempt_at = clock_timestamp() + interval '5 minutes'
  WHERE whatsapp_recovery_dispatch_gate.next_attempt_at <= clock_timestamp();
  claimed := FOUND;
  RETURN claimed;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_whatsapp_recovery_dispatch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_recovery_dispatch() TO service_role;