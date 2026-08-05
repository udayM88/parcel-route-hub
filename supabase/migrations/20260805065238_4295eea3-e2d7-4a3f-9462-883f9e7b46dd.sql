GRANT SELECT ON public.business_accounts TO authenticated;
GRANT ALL ON public.business_accounts TO service_role;

DROP POLICY IF EXISTS "admins can read all progress" ON public.booking_progress;
DROP POLICY IF EXISTS "anyone can insert progress" ON public.booking_progress;
DROP POLICY IF EXISTS "anyone can update progress" ON public.booking_progress;

CREATE POLICY "admins can read all progress"
ON public.booking_progress
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()) OR public.is_operations(auth.uid()));

REVOKE INSERT, UPDATE, DELETE ON public.booking_progress FROM anon, authenticated;
GRANT SELECT ON public.booking_progress TO authenticated;
GRANT ALL ON public.booking_progress TO service_role;