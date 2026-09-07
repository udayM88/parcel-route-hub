import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/clerk-react";

export const CLERK_PUBLISHABLE_KEY =
  (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined)?.trim() || "";

export const isClerkEnabled = CLERK_PUBLISHABLE_KEY.startsWith("pk_");

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
      {children}
    </ClerkProvider>
  );
};

export default ClerkAuthProvider;
