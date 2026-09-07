import { useEffect, useRef } from "react";
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton, useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { isClerkEnabled } from "@/integrations/clerk/ClerkAuthProvider";
import { deriveUserId, getAuthSession, setAuthSession } from "@/lib/auth";

/**
 * Optional Clerk sign-in / sign-up controls shown alongside the existing
 * phone + OTP login. Renders nothing when Clerk is not configured, so the
 * current login flow is never impacted.
 */
const ClerkSessionSync = () => {
  const { isSignedIn, user } = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  const handled = useRef(false);

  useEffect(() => {
    if (!isSignedIn || !user || handled.current) return;
    if (getAuthSession()) return;

    const phoneRaw = user.primaryPhoneNumber?.phoneNumber || user.phoneNumbers?.[0]?.phoneNumber || "";
    const digits = phoneRaw.replace(/\D/g, "").slice(-10);

    if (digits.length !== 10) {
      toast({
        title: "One more step",
        description: "Add your 10-digit mobile number below and verify with OTP to finish signing in.",
      });
      return;
    }

    handled.current = true;
    const name = user.fullName || user.firstName || "there";
    deriveUserId(digits).then((userId) => {
      setAuthSession({
        phone: `+91${digits}`,
        user_id: userId,
        customer_id: userId,
        userName: name,
        full_name: name,
        authenticated_at: new Date().toISOString(),
      });
      toast({ title: "Welcome to ViaSetu!", description: `Signed in as ${name}` });
      navigate("/");
    });
  }, [isSignedIn, user, navigate, toast]);

  return null;
};

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
        <ClerkSessionSync />
      </SignedIn>
    </div>
  );
};

export default ClerkAuthButtons;
