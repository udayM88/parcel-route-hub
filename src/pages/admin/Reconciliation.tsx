import { useState } from "react";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { AlertTriangle, RefreshCw, Search, IndianRupee, CheckCircle2, XCircle, FileWarning, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, subDays } from "date-fns";
import { downloadCaWorkbook, type CaReportData } from "@/lib/ca-report";

type Category = "matched" | "orphan" | "failed" | "refunded";

interface ReconcileItem {
  payment_id: string;
  order_id: string | null;
  amount: number;
  amount_refunded: number;
  currency: string;
  method: string;
  contact: string | null;
  email: string | null;
  captured_at: string;
  category: Category;
  booking: {
    id: string;
    payment_id: string;
    payment_status: string;
    status: string;
    courier_name: string;
    courier_price: number;
    sender_name: string;
    receiver_name: string;
    created_at: string;
    refund_id: string | null;
    booking_source: string | null;
  } | null;
}

interface Summary {
  range: { from: string; to: string };
  total_payments: number;
  total_amount: number;
  orphan_count: number;
  orphan_amount: number;
  failed_count: number;
  failed_amount: number;
  matched_count: number;
  refunded_count: number;
  refunded_amount: number;
}

const Reconciliation = () => {
  const { toast } = useToast();
  const [from, setFrom] = useState(format(subDays(new Date(), 14), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ReconcileItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState<"all" | Category>("all");
  const [actioning, setActioning] = useState<string | null>(null);
  const [refundTarget, setRefundTarget] = useState<ReconcileItem | null>(null);
  const [reportMode, setReportMode] = useState<"month" | "custom">("month");
  const [reportMonth, setReportMonth] = useState(format(new Date(), "yyyy-MM"));
  const [reportFrom, setReportFrom] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"));
  const [reportTo, setReportTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [exporting, setExporting] = useState(false);

  const reportBoundaries = () => {
    if (reportMode === "month") {
      const [year, month] = reportMonth.split("-").map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      return {
        from: `${reportMonth}-01T00:00:00+05:30`,
        to: `${reportMonth}-${String(lastDay).padStart(2, "0")}T23:59:59+05:30`,
        label: reportMonth,
      };
    }
    return {
      from: `${reportFrom}T00:00:00+05:30`,
      to: `${reportTo}T23:59:59+05:30`,
      label: `${reportFrom}-to-${reportTo}`,
    };
  };

  const handleCaExport = async () => {
    const range = reportBoundaries();
    if (!range.from || !range.to || new Date(range.from) > new Date(range.to)) {
      toast({ title: "Invalid date range", description: "Choose a valid reporting period.", variant: "destructive" });
      return;
    }
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("razorpay-reconcile", {
        body: { action: "ca_report", from: range.from, to: range.to },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      const report = data as CaReportData;
      downloadCaWorkbook(report, range.label);
      toast({
        title: "CA report ready",
        description: `${report.payments.length} payments, ${report.refunds.length} credit notes, and ${report.exceptions.length} review items exported.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not generate the report.";
      toast({ title: "Report generation failed", description: message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("razorpay-reconcile", {
        body: { from, to: `${to}T23:59:59` },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setItems((data as any).items || []);
      setSummary((data as any).summary || null);
      toast({ title: "Loaded", description: `${(data as any).summary?.total_payments ?? 0} captured payments` });
    } catch (err: any) {
      toast({ title: "Failed to load", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useRealtimeTable(
    "bookings",
    () => { if (items.length > 0) fetchData(); },
    { channelName: "admin-reconciliation" }
  );



  const handleRefund = async (item: ReconcileItem) => {
    setActioning(item.payment_id);
    try {
      const { data, error } = await supabase.functions.invoke("razorpay-reconcile", {
        body: { action: "refund", payment_id: item.payment_id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({
        title: "Refund initiated",
        description: `Refund ID: ${(data as any).refund_id}`,
      });
      await fetchData();
    } catch (err: any) {
      toast({ title: "Refund failed", description: err.message, variant: "destructive" });
    } finally {
      setActioning(null);
      setRefundTarget(null);
    }
  };

  const handleMarkResolved = async (item: ReconcileItem) => {
    setActioning(item.payment_id);
    try {
      const { data, error } = await supabase.functions.invoke("razorpay-reconcile", {
        body: { action: "create_audit_row", payment_id: item.payment_id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Audit row created", description: "Marked as resolved." });
      await fetchData();
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    } finally {
      setActioning(null);
    }
  };

  const filtered = filter === "all" ? items : items.filter(i => i.category === filter);

  const categoryBadge = (c: Category) => {
    switch (c) {
      case "orphan":
        return <Badge variant="destructive">Orphan — no booking</Badge>;
      case "failed":
        return <Badge className="bg-orange-500 hover:bg-orange-600">Failed booking</Badge>;
      case "refunded":
        return <Badge variant="secondary">Refunded</Badge>;
      case "matched":
        return <Badge className="bg-green-600 hover:bg-green-700">Matched</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Payment Reconciliation</h2>
        <p className="text-muted-foreground">
          Compare captured Razorpay payments against booking records
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[160px]" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[160px]" />
            </div>
            <Button onClick={fetchData} disabled={loading}>
              {loading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Reconcile
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Billing & GST Report</CardTitle>
          <CardDescription>
            Download a CA-ready Excel workbook using actual payment and refund dates. Historical amounts are preserved as recorded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Period type</label>
                <div className="flex gap-2">
                  <Button size="sm" variant={reportMode === "month" ? "default" : "outline"} onClick={() => setReportMode("month")}>Month</Button>
                  <Button size="sm" variant={reportMode === "custom" ? "default" : "outline"} onClick={() => setReportMode("custom")}>Custom dates</Button>
                </div>
              </div>
              {reportMode === "month" ? (
                <div className="space-y-1">
                  <label htmlFor="ca-report-month" className="text-xs font-medium text-muted-foreground">Report month</label>
                  <Input id="ca-report-month" type="month" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} className="w-full sm:w-[190px]" />
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <label htmlFor="ca-report-from" className="text-xs font-medium text-muted-foreground">From</label>
                    <Input id="ca-report-from" type="date" value={reportFrom} onChange={(event) => setReportFrom(event.target.value)} className="w-full sm:w-[170px]" />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="ca-report-to" className="text-xs font-medium text-muted-foreground">To</label>
                    <Input id="ca-report-to" type="date" value={reportTo} onChange={(event) => setReportTo(event.target.value)} className="w-full sm:w-[170px]" />
                  </div>
                </>
              )}
            </div>
            <Button onClick={handleCaExport} disabled={exporting || (reportMode === "month" && !reportMonth)} className="w-full sm:w-auto">
              {exporting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              {exporting ? "Generating complete report…" : "Generate CA Excel Report"}
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Includes sales register, separate credit notes, GST summary, courier totals, order statuses, payment matching, and exceptions requiring review.
          </p>
        </CardContent>
      </Card>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <IndianRupee className="h-4 w-4" />
                Total Captured
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">₹{summary.total_amount.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{summary.total_payments} payments</p>
            </CardContent>
          </Card>
          <Card className="border-destructive/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Orphan Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive">
                ₹{summary.orphan_amount.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">{summary.orphan_count} unmatched</p>
            </CardContent>
          </Card>
          <Card className="border-orange-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileWarning className="h-4 w-4 text-orange-500" />
                Failed Bookings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-600">
                ₹{summary.failed_amount.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">{summary.failed_count} need refund</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Matched
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{summary.matched_count}</p>
              <p className="text-xs text-muted-foreground">
                {summary.refunded_count} refunded · ₹{summary.refunded_amount.toLocaleString()} returned
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {(["all", "orphan", "failed", "matched", "refunded"] as const).map(k => (
          <Button
            key={k}
            size="sm"
            variant={filter === k ? "default" : "outline"}
            onClick={() => setFilter(k)}
          >
            {k.charAt(0).toUpperCase() + k.slice(1)}
            {summary && k !== "all" && (
              <span className="ml-2 text-xs opacity-70">
                {k === "orphan" ? summary.orphan_count :
                 k === "failed" ? summary.failed_count :
                 k === "matched" ? summary.matched_count :
                 summary.refunded_count}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
          <CardDescription>
            {summary
              ? `Showing ${filtered.length} of ${summary.total_payments} captured payments`
              : "Run reconciliation to load payments"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {summary ? "No payments in this category" : "Click Reconcile to load data"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment ID</TableHead>
                    <TableHead>Captured</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Booking</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(item => (
                    <TableRow key={item.payment_id}>
                      <TableCell className="font-mono text-xs">{item.payment_id}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(item.captured_at), "dd MMM HH:mm")}
                      </TableCell>
                      <TableCell className="font-medium">
                        ₹{item.amount.toLocaleString()}
                        {item.amount_refunded > 0 && (
                          <div className="text-xs text-muted-foreground">
                            −₹{item.amount_refunded.toLocaleString()} refunded
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{item.method}</TableCell>
                      <TableCell className="text-sm">{item.contact || "—"}</TableCell>
                      <TableCell>{categoryBadge(item.category)}</TableCell>
                      <TableCell className="text-sm">
                        {item.booking ? (
                          <div>
                            <div className="font-medium">{item.booking.courier_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.booking.status} · {item.booking.payment_status}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">none</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {(item.category === "orphan" || item.category === "failed") &&
                            item.amount_refunded < item.amount && (
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={actioning === item.payment_id}
                                onClick={() => setRefundTarget(item)}
                              >
                                {actioning === item.payment_id ? (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : (
                                  <>
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Refund
                                  </>
                                )}
                              </Button>
                            )}
                          {item.category === "orphan" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actioning === item.payment_id}
                              onClick={() => handleMarkResolved(item)}
                            >
                              Mark Resolved
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!refundTarget} onOpenChange={(open) => !open && setRefundTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refund this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will issue a full refund of ₹{refundTarget?.amount.toLocaleString()} to the
              customer via Razorpay and mark the booking row as FAILED. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => refundTarget && handleRefund(refundTarget)}>
              Confirm Refund
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Reconciliation;
