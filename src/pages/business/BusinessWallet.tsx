import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Loader2, Plus, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBusinessAuth } from "@/contexts/useBusinessAuth";
import { useToast } from "@/hooks/use-toast";
import { CURRENT_ENV } from "@/config/environment";
import PageSeo from "@/components/PageSeo";
import { isBusinessDemoSession } from "@/lib/business-demo";

type Tx = { id: string; type: string; amount: number; balance_after: number; note: string | null; booking_id: string | null; created_at: string };
type RazorpayResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RazorpayOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { email?: string; contact?: string };
  theme: { color: string };
  modal: { ondismiss: () => void };
  handler: (response: RazorpayResponse) => Promise<void>;
};


const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const TYPE_LABEL: Record<string, string> = { topup: "Top-up", charge: "Shipment", refund: "Refund", adjustment: "Adjustment" };

const DEMO_TRANSACTIONS: Tx[] = [
  { id: "demo-1", type: "topup", amount: 5000, balance_after: 5000, note: "Sample wallet funding", booking_id: null, created_at: "2026-10-20T08:45:00.000Z" },
  { id: "demo-2", type: "charge", amount: -186, balance_after: 4814, note: "Sample shipment VS-DEMO-1040", booking_id: "demo-order-1040", created_at: "2026-10-20T09:16:00.000Z" },
  { id: "demo-3", type: "refund", amount: 186, balance_after: 5000, note: "Sample cancelled shipment refund", booking_id: "demo-order-1039", created_at: "2026-10-19T13:22:00.000Z" },
];

const loadRazorpay = () =>
  new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

const BusinessWallet = () => {
  const { business } = useBusinessAuth();
  const { toast } = useToast();
  const isDemo = isBusinessDemoSession();
  const [balance, setBalance] = useState(0);
  const [threshold, setThreshold] = useState(500);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("1000");
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    if (!business) return;
    if (isDemo) {
      setBalance(5000);
      setThreshold(500);
      setTxs(DEMO_TRANSACTIONS);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [w, t] = await Promise.all([
      supabase.from("business_wallets").select("balance,low_balance_threshold").eq("business_account_id", business.id).maybeSingle(),
      supabase.from("wallet_transactions").select("id,type,amount,balance_after,note,booking_id,created_at")
        .eq("business_account_id", business.id).order("created_at", { ascending: false }).limit(200),
    ]);
    if (w.error || t.error) {
      toast({ title: "Could not load wallet", description: w.error?.message || t.error?.message, variant: "destructive" });
    }
    setBalance(Number(w.data?.balance ?? 0));
    setThreshold(Number(w.data?.low_balance_threshold ?? 500));
    setTxs((t.data ?? []) as Tx[]);
    setLoading(false);
  }, [business, isDemo, toast]);

  useEffect(() => { load(); }, [load]);

  const topUp = async () => {
    if (isDemo) {
      toast({ title: "Sample mode", description: "Wallet funding is disabled in the local sample account. No payment was started." });
      return;
    }
    const amt = Math.round(Number(amount));
    if (!(amt >= 100)) { toast({ title: "Minimum top-up is ₹100", variant: "destructive" }); return; }
    setPaying(true);
    try {
      if (!(await loadRazorpay())) throw new Error("Could not load payment window");
      const { data, error } = await supabase.functions.invoke("business-wallet", {
        body: { action: "create_topup", amount: amt }, headers: { "x-environment": CURRENT_ENV },
      });
      if (error || !data?.order_id) throw new Error(data?.error || error?.message || "Could not start payment");
      if (!window.Razorpay) throw new Error("Payment window is unavailable");
      const rz = new window.Razorpay({
        key: data.key_id, order_id: data.order_id, amount: amt * 100, currency: "INR",
        name: "ViaSetu", description: "Wallet top-up",
        prefill: { email: business?.email, contact: business?.phone },
        theme: { color: "#06b6d4" },
        modal: { ondismiss: () => setPaying(false) },
        handler: async (resp: RazorpayResponse) => {
          const { data: v, error: ve } = await supabase.functions.invoke("business-wallet", {
            body: { action: "verify_topup", ...resp }, headers: { "x-environment": CURRENT_ENV },
          });
          setPaying(false);
          if (ve || !v?.success) {
            toast({ title: "Payment received, wallet not updated yet", description: v?.error || "Contact support with your payment ID.", variant: "destructive" });
          } else {
            toast({ title: `${inr(v.credited)} added to wallet` });
          }
          load();
        },
      });
      rz.open();
    } catch (error: unknown) {
      setPaying(false);
      toast({ title: "Top-up failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      <PageSeo title="Wallet | ViaSetu for Businesses" description="Prepaid wallet balance and history." path="/viasetuforbusinesses/wallet" />
      <main className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2"><h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Prepaid wallet</h1>{isDemo ? <Badge variant="secondary">Sample data</Badge> : null}</div>
            <p className="mt-1 text-sm text-muted-foreground">Fund merchant shipments and review every auditable balance movement.</p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="merchant-surface merchant-bordered-card overflow-hidden">
            <CardHeader className="pb-2"><CardDescription className="flex items-center gap-2"><Wallet className="h-4 w-4" />Available balance</CardDescription></CardHeader>
            <CardContent>
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <p className="text-4xl font-bold">{inr(balance)}</p>}
              {!loading && balance < threshold && (
                <p className="mt-2 text-sm text-destructive flex items-center gap-1"><AlertTriangle className="h-4 w-4" />Low balance — API shipments stop when the wallet can't cover the price.</p>
              )}
            </CardContent>
          </Card>
          <Card className="merchant-surface merchant-bordered-card">
            <CardHeader className="pb-2"><CardTitle className="text-base">Add money</CardTitle><CardDescription>Pay by UPI, card or netbanking. Credited instantly.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {[1000, 5000, 10000, 25000].map((v) => (
                  <Button key={v} type="button" size="sm" variant={amount === String(v) ? "default" : "outline"} onClick={() => setAmount(String(v))}>{inr(v)}</Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input type="number" min={100} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Top-up amount" />
                <Button onClick={topUp} disabled={paying}>{paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}{isDemo ? "Preview" : "Add funds"}</Button>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="size-3.5 text-primary" />Balance changes are completed only by the verified server-side payment flow.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="merchant-bordered-card">
          <CardHeader><CardTitle className="text-base">Transactions</CardTitle><CardDescription>{isDemo ? "Local sample entries; no financial records were created." : "Latest wallet credits, shipment charges, refunds and adjustments."}</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto">
            {txs.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No transactions yet.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Details</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                <TableBody>
                  {txs.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap text-xs">{new Date(t.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</TableCell>
                      <TableCell><Badge variant="outline" className="gap-1.5">{t.amount >= 0 ? <ArrowDownLeft className="size-3" /> : <ArrowUpRight className="size-3" />}{TYPE_LABEL[t.type] || t.type}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">{t.note}</TableCell>
                      <TableCell className={`text-right font-medium ${t.amount < 0 ? "text-destructive" : "text-primary"}`}>{t.amount > 0 ? "+" : ""}{inr(t.amount)}</TableCell>
                      <TableCell className="text-right">{inr(t.balance_after)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default BusinessWallet;
