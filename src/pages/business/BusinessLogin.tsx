import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import PageSeo from "@/components/PageSeo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBusinessAuth } from "@/contexts/useBusinessAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  BUSINESS_DEMO_ENABLED,
  BUSINESS_DEMO_EMAIL,
  endBusinessDemoSession,
  isBusinessDemoCredentials,
  startBusinessDemoSession,
} from "@/lib/business-demo";
import loginBackground from "@/assets/merchant-console/merchant-login-background-v2.png";
import viasetuLogo from "@/assets/merchant-console/viasetu.png";

const emailSchema = z.string().email("Invalid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const rememberedEmailKey = "viasetu-business-remembered-email";

const getRememberedEmail = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(rememberedEmailKey) || "";
};

const BusinessLogin = () => {
  const navigate = useNavigate();
  const { refresh } = useBusinessAuth();
  const [email, setEmail] = useState(getRememberedEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(() => Boolean(getRememberedEmail()));

  const persistRememberedEmail = (value: string) => {
    if (rememberEmail) window.localStorage.setItem(rememberedEmailKey, value);
    else window.localStorage.removeItem(rememberedEmailKey);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const emailCheck = emailSchema.safeParse(normalizedEmail);
    if (!emailCheck.success) { toast.error(emailCheck.error.errors[0].message); return; }
    const passCheck = passwordSchema.safeParse(password);
    if (!passCheck.success) { toast.error(passCheck.error.errors[0].message); return; }

    setLoading(true);
    try {
      if (isBusinessDemoCredentials(normalizedEmail, password)) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
          if (signOutError) throw new Error("Could not isolate the sample session. Please try again.");
        }
        if (!startBusinessDemoSession()) throw new Error("Sample access is currently unavailable.");
        await refresh(false);
        persistRememberedEmail(normalizedEmail);
        toast.success("Sample merchant workspace opened");
        navigate("/viasetuforbusinesses/dashboard");
        return;
      }

      endBusinessDemoSession();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) {
        toast.error(error.message.includes("Invalid login credentials")
          ? "Invalid email or password" : error.message);
        return;
      }
      if (!data.user) { toast.error("Authentication failed"); return; }

      let account;
      try {
        account = await refresh(false);
      } catch (accountError) {
        console.error("Business account lookup error:", accountError);
        await supabase.auth.signOut({ scope: "local" });
        toast.error("We could not verify your business access. Please try again.");
        return;
      }
      if (!account) {
        await supabase.auth.signOut({ scope: "local" });
        toast.error("This account is not registered as a ViaSetu business.");
        return;
      }
      if (!account.is_active || account.status !== "approved") {
        await supabase.auth.signOut({ scope: "local" });
        toast.error("Your business account is pending approval. Our team will contact you shortly.");
        return;
      }

      persistRememberedEmail(normalizedEmail);
      toast.success("Welcome back!");
      navigate("/viasetuforbusinesses/dashboard");
    } catch (err) {
      console.error("Business login error:", err);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailCheck = emailSchema.safeParse(email.trim());
    if (!emailCheck.success) { toast.error(emailCheck.error.errors[0].message); return; }
    if (BUSINESS_DEMO_ENABLED && email.trim().toLowerCase() === BUSINESS_DEMO_EMAIL) {
      toast.error("The shared sample password cannot be reset.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/viasetuforbusinesses/reset-password`,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Password reset link sent to your email");
      setIsResetMode(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] overflow-x-clip bg-[#eef3f6] font-['Public_Sans_Variable','Public_Sans','Segoe_UI',sans-serif] text-[#102a43] lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden">
      <PageSeo
        title="ViaSetu Merchant Console | Business Login"
        description="Sign in securely to manage ViaSetu business orders, shipping, tracking and integrations."
        path="/viasetuforbusinesses"
      />

      <img
        src={loginBackground}
        alt=""
        aria-hidden="true"
        decoding="async"
        className="absolute inset-x-0 top-0 h-[540px] w-full object-cover object-[43%_center] lg:inset-0 lg:h-full lg:scale-[1.015] lg:object-center"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[540px] bg-[linear-gradient(180deg,rgba(5,25,42,0.14)_0%,rgba(5,25,42,0.3)_58%,rgba(5,25,42,0.72)_88%,transparent_100%)] lg:inset-0 lg:h-full lg:bg-[linear-gradient(90deg,rgba(5,25,42,0.58)_0%,rgba(5,25,42,0.26)_48%,rgba(5,25,42,0.08)_72%,transparent_100%)]" />
      <div className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(circle_at_72%_24%,rgba(32,201,215,0.12),transparent_27%)] lg:block" />

      <main className="relative z-10 mx-auto grid min-h-[100dvh] w-full max-w-[1720px] lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1.12fr)_minmax(420px,0.7fr)]">
        <section className="flex min-h-[430px] min-w-0 flex-col justify-between px-5 pb-16 pt-5 sm:px-8 sm:pt-8 lg:h-full lg:min-h-0 lg:px-10 lg:py-7 xl:px-16 xl:py-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="group flex h-11 items-center gap-2 rounded-full border border-white/25 bg-[#071b2c]/45 px-4 text-sm font-semibold text-white shadow-sm backdrop-blur-md transition hover:border-cyan-300/60 hover:bg-[#071b2c]/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20c9d7]"
            >
              <span aria-hidden="true" className="text-lg leading-none transition-transform group-hover:-translate-x-0.5">←</span>
              Back to home
            </button>
          </div>

          <div className="max-w-[650px] text-white lg:pb-2">
            <div className="mb-4 inline-flex items-center rounded-full border border-cyan-200/30 bg-[#071b2c]/48 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-100 backdrop-blur-md">
              Merchant Console
            </div>
            <h1 className="max-w-[620px] text-[2.55rem] font-extrabold leading-[0.98] tracking-[-0.045em] drop-shadow-sm sm:text-5xl lg:text-[3.55rem] xl:text-[4rem]">
              Your business,
              <span className="mt-1 block text-[#20c9d7]">delivered better.</span>
            </h1>
            <p className="mt-4 max-w-[540px] text-base font-medium leading-7 text-slate-100 sm:text-lg lg:text-xl lg:leading-8">
              One secure workspace for orders, shipping, tracking and integrations.
            </p>
            <div className="mt-5 hidden flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold text-white/90 sm:flex">
              {['Live tracking', 'Multi-carrier shipping', 'API ready'].map((item) => (
                <span key={item} className="flex items-center gap-2">
                  <span aria-hidden="true" className="size-2 rounded-full bg-[#20c9d7] shadow-[0_0_0_4px_rgba(32,201,215,0.14)]" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="relative -mt-8 flex min-w-0 items-center justify-center overflow-hidden rounded-t-[32px] bg-transparent px-4 pb-6 pt-5 sm:px-8 lg:mt-0 lg:h-full lg:min-h-0 lg:rounded-none lg:px-7 lg:py-4 xl:px-10">
          <div className="relative w-full max-w-[440px] rounded-[24px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(247,251,253,0.96)_100%)] p-5 shadow-[0_24px_64px_rgba(3,18,31,0.24)] backdrop-blur-xl sm:p-7 lg:p-5 xl:p-6">
            <div className="mb-4 text-center">
              <img
                src={viasetuLogo}
                alt="ViaSetu"
                className="mx-auto mb-3 h-8 w-auto object-contain sm:h-9"
              />
              <div aria-hidden="true" className="mx-auto mb-3 h-0.5 w-10 rounded-full bg-[linear-gradient(90deg,#20c9d7,#087f8d)]" />
              <h2 className="text-3xl font-extrabold tracking-[-0.035em] text-[#102a43] sm:text-[2rem] lg:text-[1.9rem]">
                {isResetMode ? "Reset your password" : "Welcome back"}
              </h2>
              <p className="mx-auto mt-1 max-w-[350px] text-sm leading-5 text-[#52606d]">
                {isResetMode
                  ? "Enter your work email and we will send you a secure reset link."
                  : "Sign in to continue to your merchant workspace."}
              </p>
            </div>

            <form onSubmit={isResetMode ? handleForgotPassword : handleLogin} className="space-y-3.5">
              <div className="space-y-2">
                <Label htmlFor="business-email" className="text-sm font-bold text-[#102a43]">Work email</Label>
                <div>
                  <Input
                    id="business-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 rounded-xl border-transparent bg-[#edf3f7] px-4 text-[15px] text-[#102a43] shadow-[inset_0_0_0_1px_rgba(159,178,194,0.14)] placeholder:text-[#8497a8] hover:bg-[#e9f1f5] focus-visible:border-[#45cbd4] focus-visible:bg-white focus-visible:ring-[#20c9d7]/25"
                    required
                  />
                </div>
              </div>

              {!isResetMode ? (
                <div className="space-y-2">
                  <Label htmlFor="business-password" className="text-sm font-bold text-[#102a43]">Password</Label>
                  <div className="relative">
                    <Input
                      id="business-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 rounded-xl border-transparent bg-[#edf3f7] pl-4 pr-11 text-[15px] text-[#102a43] shadow-[inset_0_0_0_1px_rgba(159,178,194,0.14)] placeholder:text-[#8497a8] hover:bg-[#e9f1f5] focus-visible:border-[#45cbd4] focus-visible:bg-white focus-visible:ring-[#20c9d7]/25"
                      required
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-[#62788a] transition hover:bg-[#eef3f6] hover:text-[#102a43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20c9d7]"
                    >
                      {showPassword ? <EyeOff className="size-[19px]" /> : <Eye className="size-[19px]" />}
                    </button>
                  </div>
                </div>
              ) : null}

              {!isResetMode ? (
                <div className="flex items-center justify-between gap-4">
                  <label htmlFor="remember-business-email" className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-[#415a70]">
                    <input
                      id="remember-business-email"
                      type="checkbox"
                      checked={rememberEmail}
                      onChange={(event) => setRememberEmail(event.target.checked)}
                      className="size-4 rounded border-[#9fb2c2] accent-[#0f8f95]"
                    />
                    Remember email
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsResetMode(true)}
                    className="text-sm font-bold text-[#087f8d] transition hover:text-[#056b76] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20c9d7]"
                  >
                    Forgot password?
                  </button>
                </div>
              ) : null}

              <Button
                type="submit"
                disabled={loading}
                className="group h-11 w-full rounded-xl border border-[#0b5166] bg-[linear-gradient(100deg,#102a43_0%,#0b5265_56%,#087f8d_100%)] text-[15px] font-extrabold text-white shadow-[0_12px_26px_rgba(9,75,94,0.23)] transition hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_16px_32px_rgba(9,75,94,0.28)]"
              >
                {loading ? "Please wait..." : isResetMode ? "Send reset link" : "Sign in securely"}
              </Button>

              {isResetMode ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 w-full rounded-xl font-bold text-[#52606d] hover:bg-[#eef3f6] hover:text-[#102a43]"
                  onClick={() => setIsResetMode(false)}
                >
                  ← Back to sign in
                </Button>
              ) : null}
            </form>

            <div className="my-4 h-px bg-[linear-gradient(90deg,transparent,#b9dfe6,transparent)]" />
            <div className="space-y-2 text-center text-[13px] text-[#52606d]">
              <p>
                New to ViaSetu?{" "}
                <button type="button" onClick={() => navigate("/contact")} className="font-bold text-[#087f8d] hover:underline">
                  Request merchant access
                </button>
              </p>
              <button type="button" onClick={() => navigate("/contact")} className="mx-auto font-semibold text-[#52606d] transition hover:text-[#087f8d]">
                Need help? Contact support
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default BusinessLogin;
