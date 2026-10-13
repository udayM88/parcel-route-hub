import { useState } from "react";
import { Wallet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Tx = { id: string; type: string; amount: number; balance_after: number; note: string | null; created_by_email: string | null; created_at: string };
type Key = { id: string; name: string; key_prefix: string; environment: string; last_used_at: string | null; revoked_at: string | null };
const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const AdminBusinessWalletDialog = ({ businessId, companyName }: { businessId: string; companyName: string }) => {
  const [open, setOpen] = useState(false);
  const [balance, setBalance] = useState(0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [keys, setKeys] = useState<Key[]>([]);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [w, t, k] = await Promise.all([
      supabase.from("business_wallets").select("balance").eq("business_account_id", businessId).maybeSingle(),
      supabase.from("wallet_transactions").select("id,type,amount,balance_after,note,created_by_email,created_at")
        .eq("business_account_id", businessId).order("created_at", { ascending: false }).limit(100),
      supabase.from("business_api_keys").select("id,name,key_prefix,environment,last_used_at,revoked_at")
        .eq("business_account_id", businessId).order("created_at", { ascending: false }),
    ]);
    setBalance(Number(w.data?.balance ?? 0));
    setTxs((t.data ?? []) as Tx[]);
    setKeys((k.data ?? []) as Key[]);
  };

  const adjust = async (sign: 1 | -1) => {
    const amt = Number(amount);
    if (!(amt > 0)) return toast.error("Enter an amount");
    if (reason.trim().length < 3) return toast.error("Reason is required");
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("business-wallet", {
      body: { action: "admin_adjust", business_account_id: businessId, amount: sign * amt, reason, request_id: crypto.randomUUID() },
    });
    setBusy(false);
    if (error || !data?.success) return toast.error(data?.error || error?.message || "Adjustment failed");
    toast.success(`Wallet ${sign > 0 ? "credited" : "debited"}`);
    setAmount(""); setReason(""); load();
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this API key?")) return;
    const { data, error } = await supabase.functions.invoke("business-api-keys", { body: { action: "revoke", id } });
    if (error || !data?.success) toast.error(data?.error || "Could not revoke");
    else { toast.success("Key revoked"); load(); }
  };

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => { setOpen(true); load(); }}>
        <Wallet className="h-3.5 w-3.5 mr-1" />Wallet
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{companyName} — Wallet & API</DialogTitle>
            <DialogDescription>Balance: <b>{inr(balance)}</b></DialogDescription>
          </DialogHeader>
          <div className="grid sm:grid-cols-[120px_1fr] gap-2 items-end">
            <div className="space-y-1"><Label>Amount (₹)</Label><Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="space-y-1"><Label>Reason</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Offline bank transfer UTR…" /></div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => adjust(1)}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Credit</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => adjust(-1)}>Debit</Button>
          </div>

          <h4 className="font-semibold mt-2">API keys</h4>
          {keys.length === 0 ? <p className="text-sm text-muted-foreground">None</p> : keys.map((k) => (
            <div key={k.id} className="flex items-center justify-between text-sm border rounded p-2 gap-2">
              <span className="min-w-0 truncate">{k.name} <span className="font-mono text-xs text-muted-foreground">{k.key_prefix}…</span> <Badge variant="outline">{k.environment}</Badge></span>
              {k.revoked_at ? <Badge variant="destructive">Revoked</Badge> : <Button size="sm" variant="ghost" onClick={() => revoke(k.id)}>Revoke</Button>}
            </div>
          ))}

          <h4 className="font-semibold mt-2">Transactions</h4>
          <div className="space-y-1">
            {txs.length === 0 ? <p className="text-sm text-muted-foreground">None</p> : txs.map((t) => (
              <div key={t.id} className="flex justify-between text-xs border-b py-1 gap-2">
                <span className="min-w-0 truncate">{new Date(t.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · {t.type} · {t.note}{t.created_by_email ? ` (${t.created_by_email})` : ""}</span>
                <span className={t.amount < 0 ? "text-destructive" : "text-primary"}>{t.amount > 0 ? "+" : ""}{inr(t.amount)} → {inr(t.balance_after)}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminBusinessWalletDialog;
