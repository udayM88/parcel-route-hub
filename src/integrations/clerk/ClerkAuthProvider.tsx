import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { ClerkProvider, useClerk, useUser } from "@clerk/clerk-react";
import { supabase } from "@/integrations/supabase/client";
import { clearAuthSession, deriveClerkUserId, getAuthSession, setAuthSession } from "@/lib/auth";

export const CLERK_PUBLISHABLE_KEY =
  (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined)?.trim() || "";

export const isClerkEnabled = CLERK_PUBLISHABLE_KEY.startsWith("pk_");

const ClerkConsumerSessionBridge = ({ children }: { children: ReactNode }) => {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const syncingUserId = useRef<string | null>(null);

  useEffect(() => {
    const handleViaSetuLogout = () => {
      if (isSignedIn) void signOut();
    };
    window.addEventListener('viasetu:logout', handleViaSetuLogout);
    return () => window.removeEventListener('viasetu:logout', handleViaSetuLogout);
  }, [isSignedIn, signOut]);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn || !user) {
      const session = getAuthSession();
      if (session?.auth_provider === 'clerk') clearAuthSession();
      syncingUserId.current = null;
      return;
    }

    const existing = getAuthSession();
    if (existing?.auth_provider === 'clerk' && existing.external_auth_id === user.id) return;
    // Never replace an active phone-OTP session just because Clerk also has a browser session.
    if (existing?.auth_provider !== 'clerk' && existing) return;
    if (syncingUserId.current === user.id) return;

    syncingUserId.current = user.id;
    void (async () => {
      const userId = await deriveClerkUserId(user.id);
      const email = user.primaryEmailAddress?.emailAddress || user.emailAddresses[0]?.emailAddress || '';
      const name = user.fullName || user.firstName || email.split('@')[0] || 'ViaSetu user';

      const { error } = await supabase.functions.invoke('update-profile', {
        body: {
          user_id: userId,
          full_name: name,
          email: email || null,
          phone: null,
        },
      });
      if (error) throw error;

      setAuthSession({
        user_id: userId,
        customer_id: userId,
        email,
        auth_provider: 'clerk',
        external_auth_id: user.id,
        userName: name,
        full_name: name,
        authenticated_at: new Date().toISOString(),
      });
      window.dispatchEvent(new CustomEvent('viasetu:auth-changed'));
      if (window.location.pathname === '/login') window.location.assign('/');
    })().catch((error: unknown) => {
      console.error('Could not initialize Clerk customer session', error);
      syncingUserId.current = null;
    });
  }, [isLoaded, isSignedIn, user]);

  return <>{children}</>;
};

/**
 * Wraps the app with Clerk ONLY when a publishable key is configured.
 * Without a key the app renders exactly as before — the existing phone/OTP,
 * business and admin logins are never affected.
 */
const ClerkAuthProvider = ({ children }: { children: ReactNode }) => {
  if (!isClerkEnabled) return <>{children}</>;

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      afterSignOutUrl="/login"
      appearance={{
        variables: {
          colorPrimary: "hsl(var(--primary))",
          borderRadius: "0.5rem",
        },
      }}
    >
      <ClerkConsumerSessionBridge>{children}</ClerkConsumerSessionBridge>
    </ClerkProvider>
  );
};

export default ClerkAuthProvider;
