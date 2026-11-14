REVOKE ALL ON FUNCTION public.b2b_pricing_audit() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.b2b_bind_quote() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.b2b_save_snapshot() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.b2b_pricing_audit() TO service_role;
GRANT EXECUTE ON FUNCTION public.b2b_bind_quote() TO service_role;
GRANT EXECUTE ON FUNCTION public.b2b_save_snapshot() TO service_role;