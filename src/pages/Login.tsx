import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Package, ArrowRight, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { deriveUserId, setAuthSession, isAuthenticated } from "@/lib/auth";
import PageBackground from "@/components/PageBackground";
import PageSeo from "@/components/PageSeo";

type Step = "details" | "otp";

const Login = () => {
  const [step, setStep] = useState<Step>("details");
  const [phoneNumber, setPhoneNumber] = useState('');
  const [userName, setUserName] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [softConfirm, setSoftConfirm] = useState<{
    existingName: string;
    enteredName: string;
    userId: string;
    phoneWithCountryCode: string;
  } | null>(null);
  const timerRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/");
    }
  }, [navigate]);

  useEffect(() => {
    if (resendIn <= 0) return;
    timerRef.current = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [resendIn]);

  const finalizeLogin = (
    userId: string,
    phoneWithCountryCode: string,
    nameToUse: string,
    isReturning: boolean,
  ) => {
    setAuthSession({
      phone: phoneWithCountryCode,
      user_id: userId,
      customer_id: userId,
      userName: nameToUse,
      full_name: nameToUse,
      authenticated_at: new Date().toISOString(),
    });
    toast({
      title: isReturning ? "Welcome back!" : "Welcome to ViaSetu!",
      description: isReturning
        ? `Good to see you again, ${nameToUse}`
        : `Nice to meet you, ${nameToUse}`,
    });
    navigate("/");
  };

  const handleSendOtp = async () => {
    if (phoneNumber.length !== 10) {
      toast({ title: "Invalid Phone Number", description: "Please enter a valid 10-digit phone number", variant: "destructive" });
      return;
    }
    if (userName.trim().length === 0) {
      toast({ title: "Name Required", description: "Please enter your name to continue", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fast2sms-send-otp', {
        body: { phone: phoneNumber },
      });
      if (error || !data?.success) {
        const msg = (data as any)?.error || error?.message || "Failed to send OTP. Please try again.";
        toast({ title: "Could not send OTP", description: msg, variant: "destructive" });
        return;
      }
      setStep("otp");
      setOtp('');
      setResendIn(30);
      toast({ title: "OTP sent", description: `We've sent a 5-digit code to +91${phoneNumber}.` });
    } catch (err: any) {
      toast({ title: "Could not send OTP", description: err?.message || "Network error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendIn > 0) return;
    await handleSendOtp();
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 5) {
      toast({ title: "Enter the 5-digit OTP", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data: verifyResp, error: verifyErr } = await supabase.functions.invoke('fast2sms-verify-otp', {
        body: { phone: phoneNumber, otp },
      });
      if (verifyErr || !verifyResp?.success) {
        const msg = (verifyResp as any)?.error || verifyErr?.message || "Invalid OTP";
        toast({ title: "Verification failed", description: msg, variant: "destructive" });
        return;
      }

      // OTP verified — proceed with existing profile flow (unchanged logic)
      const phoneWithCountryCode = `+91${phoneNumber}`;
      const userId = await deriveUserId(phoneNumber);
      const trimmedName = userName.trim();

      const { data: profileResp } = await supabase.functions.invoke('get-profile', {
        body: { user_id: userId },
      });
      const existingProfile = profileResp?.profile;
      const existingName = existingProfile?.full_name?.trim();

      if (existingName && existingName.toLowerCase() !== trimmedName.toLowerCase()) {
        setSoftConfirm({
          existingName,
          enteredName: trimmedName,
          userId,
          phoneWithCountryCode,
        });
        return;
      }

      await supabase.functions.invoke('update-profile', {
        body: {
          user_id: userId,
          full_name: trimmedName,
          phone: phoneWithCountryCode,
        },
      });

      finalizeLogin(userId, phoneWithCountryCode, trimmedName, Boolean(existingName));
    } catch (err: any) {
      toast({ title: "Login failed", description: err?.message || "Please try again", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleKeepExistingName = () => {
    if (!softConfirm) return;
    finalizeLogin(softConfirm.userId, softConfirm.phoneWithCountryCode, softConfirm.existingName, true);
    setSoftConfirm(null);
  };

  const handleUpdateName = async () => {
    if (!softConfirm) return;
    setLoading(true);
    try {
      await supabase.functions.invoke('update-profile', {
        body: {
          user_id: softConfirm.userId,
          full_name: softConfirm.enteredName,
          phone: softConfirm.phoneWithCountryCode,
        },
      });
      finalizeLogin(softConfirm.userId, softConfirm.phoneWithCountryCode, softConfirm.enteredName, true);
      setSoftConfirm(null);
    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message || "Could not update your name.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <PageSeo title="Login — ViaSetu Courier Aggregator" description="Log in to ViaSetu with your phone number to compare couriers, book pickups and track parcels across India." path="/login" noindex />
      <PageBackground variant="parcels" opacity={0.7} />

      <div className="w-full max-w-md mx-auto space-y-6 relative z-10">
        <div className="text-center">
          <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 shadow-2xl">
            <Package className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-white drop-shadow-lg">ViaSetu.</h1>
          <p className="text-white/70 mt-1">AI-Powered Multi-Courier Platform</p>
        </div>

        <Card className="border-white/20 shadow-2xl bg-white/10 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">
              {step === "details" ? "Sign in or sign up" : "Verify your number"}
            </CardTitle>
            <p className="text-sm text-white/70 mt-1">
              {step === "details"
                ? "Enter your phone and name to get started"
                : `Enter the 5-digit code sent to +91${phoneNumber}`}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === "details" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-white/90">Your Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your name"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-white/90">Mobile Number</Label>
                  <div className="flex">
                    <div className="flex items-center px-3 py-2 border border-r-0 rounded-l-md bg-white/20 text-white text-sm border-white/30">+91</div>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Enter 10-digit mobile number"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="rounded-l-none bg-white/20 border-white/30 text-white placeholder:text-white/50"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleSendOtp}
                  disabled={loading || phoneNumber.length !== 10 || userName.trim().length === 0}
                  className="w-full"
                >
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </>
            )}

            {step === "otp" && (
              <>
                <div className="space-y-2">
                  <Label className="text-white/90">Enter OTP</Label>
                  <div className="flex justify-center py-2">
                    <InputOTP
                      maxLength={5}
                      value={otp}
                      onChange={(v) => setOtp(v.replace(/\D/g, ''))}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} className="bg-white/20 border-white/30 text-white" />
                        <InputOTPSlot index={1} className="bg-white/20 border-white/30 text-white" />
                        <InputOTPSlot index={2} className="bg-white/20 border-white/30 text-white" />
                        <InputOTPSlot index={3} className="bg-white/20 border-white/30 text-white" />
                        <InputOTPSlot index={4} className="bg-white/20 border-white/30 text-white" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>

                <Button
                  onClick={handleVerifyOtp}
                  disabled={loading || otp.length !== 5}
                  className="w-full"
                >
                  {loading ? 'Verifying...' : 'Verify & Continue'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>

                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => { setStep("details"); setOtp(''); }}
                    className="text-white/80 hover:text-white inline-flex items-center gap-1"
                    disabled={loading}
                  >
                    <ArrowLeft className="h-3 w-3" /> Change number
                  </button>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendIn > 0 || loading}
                    className="text-white/80 hover:text-white disabled:opacity-50"
                  >
                    {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend OTP'}
                  </button>
                </div>
              </>
            )}

            <p className="text-xs text-white/60 text-center">
              By continuing, you agree to our Terms and Privacy Policy.
            </p>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!softConfirm} onOpenChange={(open) => { if (!open) setSoftConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Account already exists</AlertDialogTitle>
            <AlertDialogDescription>
              An account for this phone number is registered as{' '}
              <strong>{softConfirm?.existingName}</strong>. Would you like to continue
              as <strong>{softConfirm?.existingName}</strong> or update the name to{' '}
              <strong>{softConfirm?.enteredName}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSoftConfirm(null)} className="whitespace-normal break-words h-auto min-h-10 py-2">Cancel</AlertDialogCancel>
            <Button variant="outline" onClick={handleKeepExistingName} disabled={loading} className="whitespace-normal break-words h-auto min-h-10 py-2">
              Continue as {softConfirm?.existingName}
            </Button>
            <AlertDialogAction onClick={handleUpdateName} disabled={loading} className="whitespace-normal break-words h-auto min-h-10 py-2">
              Update to {softConfirm?.enteredName}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Login;
