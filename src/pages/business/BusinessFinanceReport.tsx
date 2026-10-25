import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, Loader2, ReceiptText, RefreshCw, Search, WalletCards } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBusinessAuth } from "@/contexts/useBusinessAuth";
import { supabase } from "@/integrations/supabase/client";
import { isBusinessDemoSession } from "@/lib/business-demo";

type FinanceMode = "transactions" | "recharge-management" | "billing-statements";

type WalletTransaction = {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  note: string | null;
  booking_id: string | null;
  payment_id: string | null;
  created_at: string;
};

const DEMO_TRANSACTIONS: WalletTransaction[] = [
  { id: "txn_demo_5001", type: "topup", amount: 5000, balance_after: 5000, note: "Sample wallet funding", booking_id: null, payment_id: "pay_demo_5001", created_at: "2026-10-20T08:45:00.000Z" },
  { id: "txn_demo_5002", type: "charge", amount: -186, balance_after: 4814, note: "Sample shipment charge", booking_id: "VS-DEMO-1040", payment_id: null, created_at: "2026-10-20T09:16:00.000Z" },
  { id: "txn_demo_5003", type: "refund", amount: 186, balance_after: 5000, note: "Sample cancellation refund", booking_id: "VS-DEMO-1039", payment_id: null, created_at: "2026-10-19T13:22:00.000Z" },
];

const inr = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
const formatDate = (value: string) => new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

const COPY: Record<FinanceMode, { title: string; description: string }> = {
  transactions: { title: "Transaction report", description: "A consolidated view of wallet credits, shipment charges and refunds." },
  "recharge-management": { title: "Recharge management", description: "Review successful wallet funding and refund credits." },
  "billing-statements": { title: "Billing statement", description: "Review the merchant wallet ledger and running balance." },
};

export default function BusinessFinanceReport({ mode }: { mode: FinanceMode }) {
  const { business } = useBusinessAuth();
  const isDemo = isBusinessDemoSession();
  const [transactions, setTransactions] = useState<WalletTransaction[]>(isDemo ? DEMO_TRANSACTIONS : []);
  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    if (isDemo || !business) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: queryError } = await supabase
        .from("wallet_transactions")
        .select("id,type,amount,balance_after,note,booking_id,payment_id,created_at")
        .eq("business_account_id", business.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (queryError) throw queryError;
      setTransactions((data as WalletTransaction[]) || []);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Transactions could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [business, isDemo]);

  useEffect(() => {
    void load();
  }, [load]);

  const modeTransactions = useMemo(() => mode === "recharge-management"
    ? transactions.filter((transaction) => transaction.type === "topup" || transaction.type === "refund")
    : transactions, [mode, transactions]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return modeTransactions;
    return modeTransactions.filter((transaction) => [transaction.id, transaction.type, transaction.note, transaction.booking_id, transaction.payment_id]
      .some((value) => value?.toLowerCase().includes(needle)));
  }, [modeTransactions, query]);

  const credit = modeTransactions.filter((transaction) => transaction.amount > 0).reduce((sum, transaction) => sum + transaction.amount, 0);
  const debit = Math.abs(modeTransactions.filter((transaction) => transaction.amount < 0).reduce((sum, transaction) => sum + transaction.amount, 0));
  const currentBalance = transactions[0]?.balance_after || 0;

  const exportCsv = () => {
    const escape = (value: string | number | null) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["Transaction ID", "Date", "Type", "Reference", "Note", "Amount", "Balance"],
      ...filtered.map((transaction) => [transaction.id, transaction.created_at, transaction.type, transaction.booking_id || transaction.payment_id, transaction.note, transaction.amount, transaction.balance_after]),
    ];
    const blob = new Blob([rows.map((row) => row.map(escape).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `viasetu-${mode}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {isDemo ? <Alert className="border-amber-200 bg-amber-50/80 text-amber-950"><WalletCards /><AlertTitle>Sample financial data</AlertTitle><AlertDescription>These amounts are non-financial demo records. Export creates a local CSV only.</AlertDescription></Alert> : null}
      {error ? <Alert variant="destructive"><ReceiptText /><AlertTitle>Could not load the ledger</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Credits", credit, ArrowDownLeft, "bg-emerald-50 text-emerald-700"],
          ["Debits", debit, ArrowUpRight, "bg-rose-50 text-rose-700"],
          ["Current balance", currentBalance, WalletCards, "bg-blue-50 text-blue-700"],
        ].map(([label, value, StatIcon, tone]) => {
          const Icon = StatIcon as typeof WalletCards;
          return <Card key={String(label)} className="merchant-bordered-card"><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm font-semibold text-muted-foreground">{String(label)}</p><p className="mt-1 text-2xl font-extrabold">{loading ? "—" : inr(Number(value))}</p></div><span className={`grid size-11 place-items-center rounded-xl ${String(tone)}`}><Icon className="size-5" /></span></CardContent></Card>;
        })}
      </div>

      <Card className="merchant-bordered-card overflow-hidden">
        <CardHeader className="border-b">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div><CardTitle>{COPY[mode].title}</CardTitle><CardDescription>{COPY[mode].description}</CardDescription></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9 sm:w-72" placeholder="Search ID, note or reference" aria-label="Search transactions" /></div>
              <Button variant="outline" onClick={() => void load()} disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}Refresh</Button>
              <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}><Download />Export CSV</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Reference</TableHead><TableHead>Note</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
              <TableBody>
                {!loading && filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="h-52 text-center text-muted-foreground">No matching transactions found.</TableCell></TableRow> : null}
                {filtered.map((transaction) => <TableRow key={transaction.id}><TableCell className="whitespace-nowrap text-sm">{formatDate(transaction.created_at)}</TableCell><TableCell><Badge variant="outline" className="capitalize">{transaction.type}</Badge></TableCell><TableCell className="font-mono text-xs">{transaction.booking_id || transaction.payment_id || transaction.id.slice(0, 12)}</TableCell><TableCell className="min-w-52 text-sm text-muted-foreground">{transaction.note || "—"}</TableCell><TableCell className={`text-right font-bold ${transaction.amount >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{transaction.amount > 0 ? "+" : ""}{inr(transaction.amount)}</TableCell><TableCell className="text-right font-semibold">{inr(transaction.balance_after)}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
