-- Allow Supabase-authenticated users to manage only their own saved addresses.
-- The existing service-role policy remains unchanged for legacy/Prayog flows.

CREATE POLICY "Authenticated users read own saved addresses"
ON public.saved_addresses
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid())::text);

CREATE POLICY "Authenticated users create own saved addresses"
ON public.saved_addresses
FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid())::text);

CREATE POLICY "Authenticated users update own saved addresses"
ON public.saved_addresses
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid())::text)
WITH CHECK (user_id = (SELECT auth.uid())::text);

CREATE POLICY "Authenticated users delete own saved addresses"
ON public.saved_addresses
FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid())::text);
