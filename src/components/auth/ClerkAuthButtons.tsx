import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { isClerkEnabled } from "@/integrations/clerk/ClerkAuthProvider";

/**
 * Optional Clerk sign-in / sign-up controls shown alongside the existing
 * phone + OTP login. Renders nothing when Clerk is not configured, so the
 * current login flow is never impacted.
 */
const ClerkAuthButtons = () => {
  if (!isClerkEnabled) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-white/25" />
        <span className="text-xs uppercase tracking-wide text-white/60">or</span>
        <span className="h-px flex-1 bg-white/25" />
      </div>

      <SignedOut>
        <div className="flex flex-col sm:flex-row gap-2">
          <SignInButton mode="modal">
            <Button variant="secondary" className="w-full sm:flex-1">Sign in</Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button variant="outline" className="w-full sm:flex-1 bg-white/10 text-white border-white/30 hover:bg-white/20 hover:text-white">
              Sign up
            </Button>
          </SignUpButton>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="flex items-center justify-center gap-3 text-white/80 text-sm">
          <UserButton afterSignOutUrl="/login" />
          <span>You're signed in</span>
        </div>
      </SignedIn>
    </div>
  );
};

export default ClerkAuthButtons;
