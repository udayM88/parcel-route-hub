# Restore business login and publish the working version

## Confirmed diagnosis

- Supabase Auth is accepting the password for `uday@thesalesbridge.com` (recent `/token` requests return 200).
- The matching business account exists, is active, approved, email-confirmed, and linked to the same Auth user ID.
- The frontend already contains the intended post-login refresh logic.
- The live database currently exposes **no table grant for `authenticated` on `business_accounts`**. The login therefore succeeds, but the account lookup cannot read the approved business record, causing the app to sign out or redirect back to login.

## Implementation

1. **Restore database access for business accounts**
   - Add the missing authenticated read grant and retain service-role access.
   - Keep the existing ownership RLS rule so a business user can only read their own account; admins retain their existing managed access.

2. **Make the business session transition deterministic**
   - Keep one `BusinessAuthProvider` around the complete business route group instead of remounting it independently on login, dashboard, and booking routes.
   - After password authentication, load the approved account once and only then navigate to the dashboard.
   - Surface a specific account-access error instead of treating every lookup failure as “not registered.”

3. **Clear the publish-blocking security issue**
   - Remove the always-true admin read condition on `booking_progress`.
   - Remove unrestricted client write policies because progress writes already use the verified `track-booking-progress` service-role edge function.
   - Run the Supabase linter/security scan again.

4. **Verify and publish**
   - Sign in through the real business login flow and confirm the dashboard remains open after navigation and refresh.
   - Confirm the stored session can read only the linked approved business account.
   - Verify both the Lovable URL and `https://www.viasetu.com/viasetuforbusinesses` after publishing the frontend update.

## Technical details

- Database change: grants/policies only; no business data or credentials will be modified.
- Frontend change: business provider placement and explicit error handling in the existing React/Supabase flow.
- Backend database changes take effect immediately; the frontend route fix still requires a fresh publish/update.