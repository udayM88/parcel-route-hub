import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CheckCircle2, IndianRupee, Loader2, Package, RefreshCw, Truck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBusinessAuth } from "@/contexts/useBusinessAuth";
import { supabase } from "@/integrations/supabase/client";
import { isBusinessDemoSession } from "@/lib/business-demo";

type AnalyticsOrder = {
  id: string;
  created_at: string;
  status: string | null;
  courier_name: string;
  courier_price: number;
  receiver_city: string;
};

const DEMO_ORDERS: AnalyticsOrder[] = [
  { id: "1", created_at: "2026-10-20T09:00:00Z", status: "in_transit", courier_name: "Delhivery", courier_price: 186, receiver_city: "Bengaluru" },
  { id: "2", created_at: "2026-10-19T09:00:00Z", status: "delivered", courier_name: "XpressBees", courier_price: 142, receiver_city: "Ahmedabad" },
  { id: "3", created_at: "2026-10-18T09:00:00Z", status: "ready_for_dispatch", courier_name: "Shadowfax", courier_price: 176, receiver_city: "Delhi" },
  { id: "4", created_at: "2026-10-17T09:00:00Z", status: "cancelled", courier_name: "Delhivery", courier_price: 128, receiver_city: "Hyderabad" },
  { id: "5", created_at: "2026-09-22T09:00:00Z", status: "delivered", courier_name: "Delhivery", courier_price: 155, receiver_city: "Mumbai" },
  { id: "6", created_at: "2026-09-16T09:00:00Z", status: "delivered", courier_name: "XpressBees", courier_price: 149, receiver_city: "Chennai" },
  { id: "7", created_at: "2026-08-11T09:00:00Z", status: "delivered", courier_name: "Shadowfax", courier_price: 171, receiver_city: "Jaipur" },
  { id: "8", created_at: "2026-08-04T09:00:00Z", status: "in_transit", courier_name: "Delhivery", courier_price: 162, receiver_city: "Kolkata" },
];

const inr = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
const readable = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function BusinessAnalyticsPanel() {
  const { business } = useBusinessAuth();
  const isDemo = isBusinessDemoSession();
  const [orders, setOrders] = useState<AnalyticsOrder[]>(isDemo ? DEMO_ORDERS : []);
  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (isDemo || !business) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: queryError } = await supabase
        .from("bookings")
        .select("id,created_at,status,courier_name,courier_price,receiver_city")
        .eq("business_account_id", business.id)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (queryError) throw queryError;
      setOrders((data as AnalyticsOrder[]) || []);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Analytics could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [business, isDemo]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeStatuses = new Set(["created", "confirmed", "ready_for_dispatch", "picked_up", "in_transit", "out_for_delivery"]);
  const delivered = orders.filter((order) => order.status === "delivered").length;
  const active = orders.filter((order) => activeStatuses.has(order.status || "created")).length;
  const spend = orders.reduce((sum, order) => sum + Number(order.courier_price || 0), 0);

  const statusDistribution = useMemo(() => {
    const totals = new Map<string, number>();
    orders.forEach((order) => totals.set(order.status || "created", (totals.get(order.status || "created") || 0) + 1));
    return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  }, [orders]);

  const courierDistribution = useMemo(() => {
    const totals = new Map<string, number>();
    orders.forEach((order) => totals.set(order.courier_name || "Unassigned", (totals.get(order.courier_name || "Unassigned") || 0) + 1));
    return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [orders]);

  const monthly = useMemo(() => {
    const totals = new Map<string, number>();
    orders.forEach((order) => {
      const date = new Date(order.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      totals.set(key, (totals.get(key) || 0) + 1);
    });
    return Array.from(totals.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  }, [orders]);

  const maxStatus = Math.max(1, ...statusDistribution.map(([, value]) => value));
  const maxCourier = Math.max(1, ...courierDistribution.map(([, value]) => value));
  const maxMonth = Math.max(1, ...monthly.map(([, value]) => value));

  return (
    <div className="space-y-4">
      {isDemo ? <Alert className="border-amber-200 bg-amber-50/80 text-amber-950"><BarChart3 /><AlertTitle>Sample performance report</AlertTitle><AlertDescription>Charts use local illustrative shipments and do not represent a real merchant account.</AlertDescription></Alert> : null}
      {error ? <Alert variant="destructive"><BarChart3 /><AlertTitle>Could not load analytics</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}

      <div className="flex justify-end"><Button variant="outline" onClick={() => void load()} disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}Refresh report</Button></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total orders", orders.length, Package, "bg-blue-50 text-blue-700"],
          ["Active shipments", active, Truck, "bg-amber-50 text-amber-700"],
          ["Delivered", delivered, CheckCircle2, "bg-emerald-50 text-emerald-700"],
          ["Shipment value", inr(spend), IndianRupee, "bg-violet-50 text-violet-700"],
        ].map(([label, value, StatIcon, tone]) => {
          const Icon = StatIcon as typeof Package;
          return <Card key={String(label)} className="merchant-bordered-card"><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm font-semibold text-muted-foreground">{String(label)}</p><p className="mt-1 text-2xl font-extrabold">{loading ? "—" : String(value)}</p></div><span className={`grid size-11 place-items-center rounded-xl ${String(tone)}`}><Icon className="size-5" /></span></CardContent></Card>;
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="merchant-bordered-card"><CardHeader><CardTitle>Order status distribution</CardTitle><CardDescription>Current shipment lifecycle across this merchant account.</CardDescription></CardHeader><CardContent className="space-y-4">{statusDistribution.length === 0 ? <p className="py-16 text-center text-sm text-muted-foreground">No order data available.</p> : statusDistribution.map(([name, value]) => <div key={name}><div className="mb-1.5 flex items-center justify-between text-sm"><span className="font-semibold">{readable(name)}</span><span className="text-muted-foreground">{value}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${(value / maxStatus) * 100}%` }} /></div></div>)}</CardContent></Card>
        <Card className="merchant-bordered-card"><CardHeader><CardTitle>Courier mix</CardTitle><CardDescription>Shipment volume handled by each courier partner.</CardDescription></CardHeader><CardContent className="space-y-4">{courierDistribution.length === 0 ? <p className="py-16 text-center text-sm text-muted-foreground">No courier data available.</p> : courierDistribution.map(([name, value], index) => <div key={name}><div className="mb-1.5 flex items-center justify-between text-sm"><span className="font-semibold">{name}</span><span className="text-muted-foreground">{value}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full transition-[width] duration-500 ${index % 2 === 0 ? "bg-cyan-600" : "bg-violet-500"}`} style={{ width: `${(value / maxCourier) * 100}%` }} /></div></div>)}</CardContent></Card>
      </div>

      <Card className="merchant-bordered-card"><CardHeader><CardTitle>Monthly shipment trend</CardTitle><CardDescription>Order volume for the latest months available.</CardDescription></CardHeader><CardContent><div className="flex min-h-60 items-end gap-4 rounded-xl border bg-muted/15 p-5">{monthly.length === 0 ? <p className="m-auto text-sm text-muted-foreground">No monthly data available.</p> : monthly.map(([month, value]) => <div key={month} className="flex min-w-0 flex-1 flex-col items-center gap-2"><span className="text-xs font-bold">{value}</span><div className="w-full max-w-24 rounded-t-lg bg-gradient-to-t from-cyan-700 to-cyan-400 transition-[height] duration-500" style={{ height: `${Math.max(18, (value / maxMonth) * 150)}px` }} /><span className="text-center text-[11px] text-muted-foreground">{new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })}</span></div>)}</div></CardContent></Card>
    </div>
  );
}
