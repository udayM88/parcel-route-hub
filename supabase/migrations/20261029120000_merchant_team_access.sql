-- Merchant team access and server-enforced role permissions.
-- Additive: existing business owners remain owners and keep full access.

CREATE TABLE public.merchant_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_account_id uuid NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
  user_id uuid,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 100),
  email text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('admin', 'operations', 'finance', 'support', 'developer', 'viewer')),
  permissions text[] NOT NULL DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'active', 'suspended')),
  invited_by uuid,
  invited_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz,
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX merchant_team_members_business_email_uidx
  ON public.merchant_team_members (business_account_id, lower(email));
CREATE UNIQUE INDEX merchant_team_members_user_uidx
  ON public.merchant_team_members (user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX merchant_team_members_business_idx
  ON public.merchant_team_members (business_account_id, status, created_at DESC);

GRANT SELECT ON public.merchant_team_members TO authenticated;
GRANT ALL ON public.merchant_team_members TO service_role;
ALTER TABLE public.merchant_team_members ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER merchant_team_members_updated_at
BEFORE UPDATE ON public.merchant_team_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Resolve both legacy account owners and active invited team members.
CREATE OR REPLACE FUNCTION public.get_business_account_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT account_id
  FROM (
    SELECT ba.id AS account_id, 0 AS priority
    FROM public.business_accounts ba
    WHERE ba.user_id = _user_id
      AND ba.is_active = true
      AND ba.status = 'approved'
    UNION ALL
    SELECT mtm.business_account_id AS account_id, 1 AS priority
    FROM public.merchant_team_members mtm
    JOIN public.business_accounts ba ON ba.id = mtm.business_account_id
    WHERE mtm.user_id = _user_id
      AND mtm.status IN ('invited', 'active')
      AND ba.is_active = true
      AND ba.status = 'approved'
  ) access_rows
  ORDER BY priority
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_business_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.get_business_account_id(_user_id) IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.merchant_role_permissions(_role text)
RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT CASE _role
    WHEN 'admin' THEN ARRAY[
      'team:manage', 'orders:read', 'orders:write', 'wallet:read', 'wallet:manage',
      'integrations:read', 'integrations:write', 'settings:read', 'settings:write',
      'support:read', 'support:write', 'reports:read'
    ]::text[]
    WHEN 'operations' THEN ARRAY[
      'orders:read', 'orders:write', 'wallet:read', 'integrations:read',
      'settings:read', 'support:read', 'support:write', 'reports:read'
    ]::text[]
    WHEN 'finance' THEN ARRAY[
      'orders:read', 'wallet:read', 'wallet:manage', 'reports:read'
    ]::text[]
    WHEN 'support' THEN ARRAY[
      'orders:read', 'integrations:read', 'support:read', 'support:write', 'reports:read'
    ]::text[]
    WHEN 'developer' THEN ARRAY[
      'orders:read', 'integrations:read', 'integrations:write', 'settings:read', 'reports:read'
    ]::text[]
    ELSE ARRAY['orders:read', 'wallet:read', 'integrations:read', 'settings:read', 'support:read', 'reports:read']::text[]
  END
$$;

CREATE OR REPLACE FUNCTION public.merchant_has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.business_accounts ba
      WHERE ba.user_id = _user_id AND ba.is_active = true AND ba.status = 'approved'
    )
    OR EXISTS (
      SELECT 1
      FROM public.merchant_team_members mtm
      JOIN public.business_accounts ba ON ba.id = mtm.business_account_id
      WHERE mtm.user_id = _user_id
        AND mtm.status IN ('invited', 'active')
        AND ba.is_active = true
        AND ba.status = 'approved'
        AND (
          _permission = ANY(public.merchant_role_permissions(mtm.role))
          OR _permission = ANY(mtm.permissions)
        )
    )
$$;

CREATE OR REPLACE FUNCTION public.merchant_current_access()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _owner public.business_accounts;
  _member public.merchant_team_members;
BEGIN
  SELECT * INTO _owner
  FROM public.business_accounts
  WHERE user_id = auth.uid() AND is_active = true AND status = 'approved'
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'business_account_id', _owner.id,
      'role', 'owner',
      'permissions', jsonb_build_array('*'),
      'member_id', NULL,
      'name', _owner.contact_person,
      'email', _owner.email,
      'status', 'active'
    );
  END IF;

  SELECT mtm.* INTO _member
  FROM public.merchant_team_members mtm
  JOIN public.business_accounts ba ON ba.id = mtm.business_account_id
  WHERE mtm.user_id = auth.uid()
    AND mtm.status IN ('invited', 'active')
    AND ba.is_active = true
    AND ba.status = 'approved'
  LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'business_account_id', _member.business_account_id,
    'role', _member.role,
    'permissions', to_jsonb(
      ARRAY(SELECT DISTINCT value FROM unnest(public.merchant_role_permissions(_member.role) || _member.permissions) value)
    ),
    'member_id', _member.id,
    'name', _member.name,
    'email', _member.email,
    'status', _member.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_current_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merchant_current_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_business_account_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_business_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merchant_has_permission(uuid, text) TO authenticated, service_role;

CREATE POLICY "Merchant views permitted team members"
ON public.merchant_team_members FOR SELECT TO authenticated
USING (
  public.is_admin(auth.uid())
  OR user_id = auth.uid()
  OR (
    business_account_id = public.get_business_account_id(auth.uid())
    AND public.merchant_has_permission(auth.uid(), 'team:manage')
  )
);

CREATE POLICY "Team users can view their business account"
ON public.business_accounts FOR SELECT TO authenticated
USING (id = public.get_business_account_id(auth.uid()));

-- Restrictive policies preserve all existing owner/admin access while preventing
-- read-only team roles from mutating tenant data through direct REST calls.
CREATE POLICY "Merchant order readers" ON public.bookings AS RESTRICTIVE FOR SELECT TO authenticated
USING (business_account_id IS NULL OR public.is_admin(auth.uid()) OR public.merchant_has_permission(auth.uid(), 'orders:read'));
CREATE POLICY "Merchant booking box readers" ON public.booking_boxes AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR public.merchant_has_permission(auth.uid(), 'orders:read'));

CREATE POLICY "Merchant wallet readers" ON public.business_wallets AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR public.merchant_has_permission(auth.uid(), 'wallet:read'));
CREATE POLICY "Merchant wallet transaction readers" ON public.wallet_transactions AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR public.merchant_has_permission(auth.uid(), 'wallet:read'));
CREATE POLICY "Merchant API key readers" ON public.business_api_keys AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR public.merchant_has_permission(auth.uid(), 'integrations:read'));
CREATE POLICY "Merchant API activity readers" ON public.merchant_api_requests AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR public.merchant_has_permission(auth.uid(), 'integrations:read'));

CREATE POLICY "Merchant settings readers" ON public.merchant_console_settings AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR public.merchant_has_permission(auth.uid(), 'settings:read'));
CREATE POLICY "Merchant settings creators" ON public.merchant_console_settings AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()) OR public.merchant_has_permission(auth.uid(), 'settings:write'));
CREATE POLICY "Merchant settings editors" ON public.merchant_console_settings AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()) OR public.merchant_has_permission(auth.uid(), 'settings:write'))
WITH CHECK (public.is_admin(auth.uid()) OR public.merchant_has_permission(auth.uid(), 'settings:write'));
CREATE POLICY "Merchant settings removers" ON public.merchant_console_settings AS RESTRICTIVE FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()) OR public.merchant_has_permission(auth.uid(), 'settings:write'));

CREATE POLICY "Merchant import readers" ON public.merchant_bulk_imports AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR public.merchant_has_permission(auth.uid(), 'orders:read'));
CREATE POLICY "Merchant import creators" ON public.merchant_bulk_imports AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()) OR public.merchant_has_permission(auth.uid(), 'orders:write'));
CREATE POLICY "Merchant import editors" ON public.merchant_bulk_imports AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()) OR public.merchant_has_permission(auth.uid(), 'orders:write'))
WITH CHECK (public.is_admin(auth.uid()) OR public.merchant_has_permission(auth.uid(), 'orders:write'));
CREATE POLICY "Merchant import removers" ON public.merchant_bulk_imports AS RESTRICTIVE FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()) OR public.merchant_has_permission(auth.uid(), 'orders:write'));

CREATE POLICY "Merchant webhook readers" ON public.merchant_webhook_subscriptions AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR public.merchant_has_permission(auth.uid(), 'integrations:read'));
CREATE POLICY "Merchant webhook creators" ON public.merchant_webhook_subscriptions AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.is_admin(auth.uid()) OR public.merchant_has_permission(auth.uid(), 'integrations:write'));
CREATE POLICY "Merchant webhook editors" ON public.merchant_webhook_subscriptions AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()) OR public.merchant_has_permission(auth.uid(), 'integrations:write'))
WITH CHECK (public.is_admin(auth.uid()) OR public.merchant_has_permission(auth.uid(), 'integrations:write'));
CREATE POLICY "Merchant webhook removers" ON public.merchant_webhook_subscriptions AS RESTRICTIVE FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()) OR public.merchant_has_permission(auth.uid(), 'integrations:write'));

CREATE POLICY "Merchant activity readers" ON public.merchant_console_activity_logs AS RESTRICTIVE FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR public.merchant_has_permission(auth.uid(), 'reports:read'));

-- Share merchant pickup addresses and support threads across authorised team
-- members while preserving all existing consumer-owned records.
ALTER TABLE public.saved_addresses
  ADD COLUMN IF NOT EXISTS business_account_id uuid REFERENCES public.business_accounts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS saved_addresses_business_idx ON public.saved_addresses (business_account_id, created_at DESC);

CREATE POLICY "Merchant team reads shared addresses" ON public.saved_addresses FOR SELECT TO authenticated
USING (
  business_account_id IS NOT NULL
  AND business_account_id = public.get_business_account_id(auth.uid())
  AND public.merchant_has_permission(auth.uid(), 'orders:read')
);
CREATE POLICY "Merchant team creates shared addresses" ON public.saved_addresses FOR INSERT TO authenticated
WITH CHECK (
  business_account_id IS NOT NULL
  AND business_account_id = public.get_business_account_id(auth.uid())
  AND public.merchant_has_permission(auth.uid(), 'orders:write')
);
CREATE POLICY "Merchant team updates shared addresses" ON public.saved_addresses FOR UPDATE TO authenticated
USING (
  business_account_id IS NOT NULL
  AND business_account_id = public.get_business_account_id(auth.uid())
  AND public.merchant_has_permission(auth.uid(), 'orders:write')
)
WITH CHECK (
  business_account_id IS NOT NULL
  AND business_account_id = public.get_business_account_id(auth.uid())
  AND public.merchant_has_permission(auth.uid(), 'orders:write')
);
CREATE POLICY "Merchant team removes shared addresses" ON public.saved_addresses FOR DELETE TO authenticated
USING (
  business_account_id IS NOT NULL
  AND business_account_id = public.get_business_account_id(auth.uid())
  AND public.merchant_has_permission(auth.uid(), 'orders:write')
);

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS business_account_id uuid REFERENCES public.business_accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS support_tickets_business_idx ON public.support_tickets (business_account_id, created_at DESC);

CREATE POLICY "Merchant team reads shared tickets" ON public.support_tickets FOR SELECT TO authenticated
USING (
  business_account_id IS NOT NULL
  AND business_account_id = public.get_business_account_id(auth.uid())
  AND public.merchant_has_permission(auth.uid(), 'support:read')
);
CREATE POLICY "Merchant team creates shared tickets" ON public.support_tickets FOR INSERT TO authenticated
WITH CHECK (
  business_account_id IS NOT NULL
  AND business_account_id = public.get_business_account_id(auth.uid())
  AND public.merchant_has_permission(auth.uid(), 'support:write')
);
CREATE POLICY "Merchant team updates shared tickets" ON public.support_tickets FOR UPDATE TO authenticated
USING (
  business_account_id IS NOT NULL
  AND business_account_id = public.get_business_account_id(auth.uid())
  AND public.merchant_has_permission(auth.uid(), 'support:write')
)
WITH CHECK (
  business_account_id IS NOT NULL
  AND business_account_id = public.get_business_account_id(auth.uid())
  AND public.merchant_has_permission(auth.uid(), 'support:write')
);

CREATE POLICY "Merchant team reads shared ticket messages" ON public.ticket_messages FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.support_tickets ticket
  WHERE ticket.id = ticket_messages.ticket_id
    AND ticket.business_account_id = public.get_business_account_id(auth.uid())
    AND public.merchant_has_permission(auth.uid(), 'support:read')
));
CREATE POLICY "Merchant team creates shared ticket messages" ON public.ticket_messages FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.support_tickets ticket
  WHERE ticket.id = ticket_messages.ticket_id
    AND ticket.business_account_id = public.get_business_account_id(auth.uid())
    AND public.merchant_has_permission(auth.uid(), 'support:write')
));
