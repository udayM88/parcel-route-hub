import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import PageSeo from "@/components/PageSeo";

const emailSchema = z.string().email("Invalid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

const BusinessLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailCheck = emailSchema.safeParse(email.trim());
    if (!emailCheck.success) { toast.error(emailCheck.error.errors[0].message); return; }
    const passCheck = passwordSchema.safeParse(password);
    if (!passCheck.success) { toast.error(passCheck.error.errors[0].message); return; }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        toast.error(error.message.includes("Invalid login credentials")
          ? "Invalid email or password" : error.message);
        return;
      }
      if (!data.user) { toast.error("Authentication failed"); return; }

      const { data: account, error: accountError } = await supabase
        .from("business_accounts")
        .select("id,status,is_active")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (accountError || !account) {
        await supabase.auth.signOut();
        toast.error("This account is not registered as a ViaSetu business.");
        return;
      }
      if (!account.is_active || account.status !== "approved") {
        await supabase.auth.signOut();
        toast.error("Your business account is pending approval. Our team will contact you shortly.");
        return;
      }

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <PageSeo
        title="ViaSetu for Businesses — Business Login"
        description="Sign in to the ViaSetu business portal to ship multiple boxes at business rates."
        path="/viasetuforbusinesses"
      />
      <Button variant="ghost" className="absolute top-4 left-4" onClick={() => navigate("/")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Home
      </Button>

      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            {isResetMode ? "Reset Password" : "ViaSetu for Businesses"}
          </CardTitle>
          <CardDescription>
            {isResetMode
              ? "Enter your email to receive a password reset link"
              : "Sign in with the business account created by the ViaSetu team"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={isResetMode ? handleForgotPassword : handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="business-email">Work Email</Label>
              <Input id="business-email" type="email" placeholder="you@company.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {!isResetMode && (
              <div className="space-y-2">
                <Label htmlFor="business-password">Password</Label>
                <Input id="business-password" type="password" placeholder="Enter your password"
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
            <p className="text-xs text-center text-muted-foreground">
              Don't have a business account? Write to us and our team will verify your documents and
              create one for you.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default BusinessLogin;
