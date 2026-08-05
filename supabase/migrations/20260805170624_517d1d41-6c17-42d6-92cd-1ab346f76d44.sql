CREATE POLICY "Business users can view own bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  business_account_id IS NOT NULL
  AND business_account_id = public.get_business_account_id(auth.uid())
);