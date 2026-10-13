import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Wallet, Plus, AlertTriangle } from "lucide-react";
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

type Tx = { id: string; type: string; amount: number; balance_after: number; note: string | null; booking_id: string | null; created_at: string };

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const TYPE_LABEL: Record<string, string> = { topup: "Top-up", charge: "Shipment", refund: "Refund", adjustment: "Adjustment" };

const loadRazorpay = () =>
  new Promise<boolean>((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

const BusinessWallet = () => {
  const navigate = useNavigate();
  const { business } = useBusinessAuth();
  const { toast } = useToast();
  const [balance, setBalance] = useState(0);
  const [threshold, setThreshold] = useState(500);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("1000");
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    if (!business) return;
    const [w, t] = await Promise.all([
      supabase.from("business_wallets").select("balance,low_balance_threshold").eq("business_account_id", business.id).maybeSingle(),
      supabase.from("wallet_transactions").select("id,type,amount,balance_after,note,booking_id,created_at")
        .eq("business_account_id", business.id).order("created_at", { ascending: false }).limit(200),
    ]);
    setBalance(Number(w.data?.balance ?? 0));
    setThreshold(Number(w.data?.low_balance_threshold ?? 500));
    setTxs((t.data ?? []) as Tx[]);
    setLoading(false);
  }, [business]);

  useEffect(() => { load(); }, [load]);

  const topUp = async () => {
    const amt = Math.round(Number(amount));
    if (!(amt >= 100)) { toast({ title: "Minimum top-up is ₹100", variant: "destructive" }); return; }
    setPaying(true);
    try {
      if (!(await loadRazorpay())) throw new Error("Could not load payment window");
      const { data, error } = await supabase.functions.invoke("business-wallet", {
        body: { action: "create_topup", amount: amt }, headers: { "x-environment": CURRENT_ENV },
      });
      if (error || !data?.order_id) throw new Error(data?.error || error?.message || "Could not start payment");
      const rz = new (window as any).Razorpay({
        key: data.key_id, order_id: data.order_id, amount: amt * 100, currency: "INR",
        name: "ViaSetu", description: "Wallet top-up",
        prefill: { email: business?.email, contact: business?.phone },
        theme: { color: "#06b6d4" },
        modal: { ondismiss: () => setPaying(false) },
        handler: async (resp: any) => {
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
    } catch (e: any) {
      setPaying(false);
      toast({ title: "Top-up failed", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <PageSeo title="Wallet | ViaSetu for Businesses" description="Prepaid wallet balance and history." path="/viasetuforbusinesses/wallet" />
      <header className="bg-background border-b">
        <div className="max-w-5xl mx-auto flex items-center gap-3 p-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/viasetuforbusinesses/dashboard")}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="font-bold">Wallet</h1>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-4 space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardDescription className="flex items-center gap-2"><Wallet className="h-4 w-4" />Available balance</CardDescription></CardHeader>
            <CardContent>
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <p className="text-4xl font-bold">{inr(balance)}</p>}
              {!loading && balance < threshold && (
                <p className="mt-2 text-sm text-destructive flex items-center gap-1"><AlertTriangle className="h-4 w-4" />Low balance — API shipments stop when the wallet can't cover the price.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Add money</CardTitle><CardDescription>Pay by UPI, card or netbanking. Credited instantly.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {[1000, 5000, 10000, 25000].map((v) => (
                  <Button key={v} type="button" size="sm" variant={amount === String(v) ? "default" : "outline"} onClick={() => setAmount(String(v))}>{inr(v)}</Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input type="number" min={100} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Top-up amount" />
                <Button onClick={topUp} disabled={paying}>{paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}Add</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Transactions</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            {txs.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No transactions yet.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Details</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                <TableBody>
                  {txs.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap text-xs">{new Date(t.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</TableCell>
                      <TableCell><Badge variant="outline">{TYPE_LABEL[t.type] || t.type}</Badge></TableCell>
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
