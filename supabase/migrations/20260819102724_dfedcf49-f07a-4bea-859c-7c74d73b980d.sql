ALTER TABLE public.business_accounts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_reason text,
  ADD COLUMN IF NOT EXISTS deletion_note text,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_by_email text;

-- Allow operations admins to manage the courier partner toggle setting only
DROP POLICY IF EXISTS "Operations can update courier partner settings" ON public.system_settings;
CREATE POLICY "Operations can update courier partner settings"
ON public.system_settings
FOR UPDATE
TO authenticated
USING (key = 'courier_partners' AND public.is_operations(auth.uid()))
WITH CHECK (key = 'courier_partners' AND public.is_operations(auth.uid()));