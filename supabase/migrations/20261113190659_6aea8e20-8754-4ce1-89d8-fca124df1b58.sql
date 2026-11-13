DROP POLICY IF EXISTS "Public read access for courier scores" ON public.courier_scores;
CREATE POLICY "Admins can view courier scores" ON public.courier_scores FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
GRANT ALL ON public.courier_scores TO service_role;