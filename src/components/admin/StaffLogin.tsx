import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PasswordInput from "@/components/auth/PasswordInput";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const emailSchema = z.string().email("Invalid email address");

export type StaffRole = "super_admin" | "cms_editor" | "operations" | "support";

export interface StaffLoginConfig {
  title: string;
  description: string;
  allowedRoles: StaffRole[];
  defaultRedirect: string;
  resetPath: string;
  enforceViasetuDomain?: boolean;
}

const StaffLogin = ({ config }: { config: StaffLoginConfig }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: adminUser } = await supabase
        .from("admin_users")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("is_active", true)
        .single();
      if (adminUser && config.allowedRoles.includes(adminUser.role as StaffRole)) {
        navigate(config.defaultRedirect);
      }
    };
    check();
  }, [navigate, config]);

  const validateEmail = (value: string) => {
    const base = emailSchema.safeParse(value);
    if (!base.success) return base.error.errors[0].message;
    if (config.enforceViasetuDomain && !value.endsWith("@viasetu.com")) {
      return "Only @viasetu.com email addresses are allowed";
    }
    return null;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailErr = validateEmail(email);
    if (emailErr) { toast.error(emailErr); return; }
    const passwordValidation = passwordSchema.safeParse(password);
    if (!passwordValidation.success) {
      toast.error(passwordValidation.error.errors[0].message);
      return;
    }
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) {
        toast.error(authError.message.includes("Invalid login credentials")
          ? "Invalid email or password" : authError.message);
        return;
      }
      if (!authData.user) { toast.error("Authentication failed"); return; }

      const { data: adminUser, error: adminError } = await supabase
        .from("admin_users")
        .select("*")
        .eq("user_id", authData.user.id)
        .eq("is_active", true)
        .single();

      if (adminError || !adminUser) {
        await supabase.auth.signOut();
        toast.error("Access denied. This account does not have access.");
        return;
      }
      if (!config.allowedRoles.includes(adminUser.role as StaffRole)) {
        await supabase.auth.signOut();
        toast.error("Access denied. This login is not for your role.");
        return;
      }

      toast.success(`Welcome back!`);
      navigate(config.defaultRedirect);
    } catch (err) {
      console.error("Login error:", err);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailErr = validateEmail(email);
    if (emailErr) { toast.error(emailErr); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}${config.resetPath}`,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Password reset link sent to your email");
      setIsResetMode(false);
    } catch (err) {
      console.error("Password reset error:", err);
      toast.error("Failed to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <Button variant="ghost" className="absolute top-4 left-4" onClick={() => navigate("/")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Home
      </Button>

      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            {isResetMode ? "Reset Password" : config.title}
          </CardTitle>
          <CardDescription>
            {isResetMode ? "Enter your email to receive a password reset link" : config.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={isResetMode ? handleForgotPassword : handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {!isResetMode && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput id="password" autoComplete="current-password" placeholder="Enter your password"
                  value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait..." : isResetMode ? "Send Reset Link" : "Sign In"}
            </Button>
            <div className="text-center">
              <Button type="button" variant="link" className="text-sm"
                onClick={() => setIsResetMode(!isResetMode)}>
                {isResetMode ? "Back to Login" : "Forgot Password?"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffLogin;
