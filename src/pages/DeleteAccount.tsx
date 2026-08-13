import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldAlert, ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { clearAuthSession } from "@/lib/auth";
import PageSeo from "@/components/PageSeo";
import Logo from "@/components/Logo";

type Step = "phone" | "otp" | "done";

const DeleteAccount = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const sendOtp = async () => {
    if (!/^\d{10}$/.test(phone)) {
      toast({ title: "Enter a valid 10-digit mobile number", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("fast2sms-send-otp", { body: { phone } });
    setLoading(false);
    if (error || data?.error) {
      toast({ title: "Could not send OTP", description: data?.error || error?.message, variant: "destructive" });
      return;
    }
    setStep("otp");
    toast({ title: "OTP sent", description: `We sent a code to +91 ${phone}` });
  };

  const confirmDelete = async () => {
    if (!/^\d{5}$/.test(otp)) {
      toast({ title: "Enter the 5-digit OTP", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("delete-account", { body: { phone, otp } });
    setLoading(false);
    if (error || data?.error) {
      toast({
        title: "Account deletion failed",
        description: data?.error || error?.message || "Please try again or contact support.",
        variant: "destructive",
      });
      return;
    }
    clearAuthSession();
    setStep("done");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-8">
      <PageSeo
        title="Delete Your ViaSetu Account"
        description="Request permanent deletion of your ViaSetu account and personal data. Verify your mobile number with an OTP to confirm deletion."
        path="/delete-account"
      />

      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <Logo size="md" />
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Home
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Delete your ViaSetu account
            </CardTitle>
            <CardDescription>
              Verify your registered mobile number to permanently delete your ViaSetu account.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {step !== "done" && (
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm space-y-2">
                <p className="font-medium">What gets deleted</p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                  <li>Your profile (name, email, KYC details, preferences)</li>
                  <li>All saved pickup and delivery addresses</li>
                  <li>Personal details on your past shipments (names, phone numbers, addresses are redacted)</li>
                </ul>
                <p className="font-medium pt-2">What we must keep</p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                  <li>Anonymised invoice and payment records, retained for tax and legal compliance</li>
                </ul>
                <p className="text-muted-foreground pt-2">
                  Accounts with shipments still in transit cannot be deleted until those shipments are delivered or cancelled.
                  This action is permanent and cannot be undone.
                </p>
              </div>
            )}

            {step === "phone" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Registered mobile number</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">+91</span>
                    <Input
                      id="phone"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="10-digit mobile number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    />
                  </div>
                </div>
                <Button className="w-full" onClick={sendOtp} disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Send verification code
                </Button>
              </div>
            )}

            {step === "otp" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp">Enter the OTP sent to +91 {phone}</Label>
                  <Input
                    id="otp"
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="5-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  />
                </div>
                <Button variant="destructive" className="w-full" onClick={confirmDelete} disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Permanently delete my account
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setStep("phone")} disabled={loading}>
                  Change number
                </Button>
              </div>
            )}

            {step === "done" && (
              <div className="space-y-4 text-center py-4">
                <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
                <h2 className="text-lg font-semibold">Your account has been deleted</h2>
                <p className="text-sm text-muted-foreground">
                  Your profile, saved addresses and personal shipment details have been removed. Anonymised
                  invoice records are retained only as required by law.
                </p>
                <Button className="w-full" onClick={() => navigate("/")}>Back to home</Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Need help? Email <a className="underline" href="mailto:support@viasetu.com">support@viasetu.com</a>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DeleteAccount;
