import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, Loader2, PackageOpen, Plus, RefreshCw, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PageSeo from "@/components/PageSeo";
import { useBusinessAuth } from "@/contexts/useBusinessAuth";
import { supabase } from "@/integrations/supabase/client";
import { isBusinessDemoSession } from "@/lib/business-demo";

type MerchantOrder = {
  id: string;
  created_at: string;
  tracking_id: string | null;
  prayog_awb: string | null;
  sender_name: string;
  sender_city: string;
  sender_pincode: string;
  receiver_name: string;
  receiver_city: string;
  receiver_pincode: string;
  courier_name: string;
  courier_price: number;
  status: string | null;
  payment_status: string | null;
  booking_source: string | null;
  service_code: string | null;
};

const DEMO_ORDERS: MerchantOrder[] = [
  { id: "VS-DEMO-1042", created_at: "2026-10-20T09:16:00.000Z", tracking_id: "DLV-DEMO-92841", prayog_awb: null, sender_name: "Sample Warehouse", sender_city: "Pune", sender_pincode: "411001", receiver_name: "Aarav Sharma", receiver_city: "Bengaluru", receiver_pincode: "560001", courier_name: "Delhivery", courier_price: 186, status: "in_transit", payment_status: "paid", booking_source: "woocommerce", service_code: "surface" },
  { id: "VS-DEMO-1041", created_at: "2026-10-19T15:08:00.000Z", tracking_id: "XPB-DEMO-47120", prayog_awb: null, sender_name: "Sample Warehouse", sender_city: "Pune", sender_pincode: "411001", receiver_name: "Meera Patel", receiver_city: "Ahmedabad", receiver_pincode: "380015", courier_name: "XpressBees", courier_price: 142, status: "delivered", payment_status: "paid", booking_source: "api", service_code: "standard" },
  { id: "VS-DEMO-1040", created_at: "2026-10-18T11:42:00.000Z", tracking_id: "SFX-DEMO-66104", prayog_awb: null, sender_name: "Sample Warehouse", sender_city: "Pune", sender_pincode: "411001", receiver_name: "Kabir Singh", receiver_city: "Delhi", receiver_pincode: "110048", courier_name: "Shadowfax", courier_price: 176, status: "ready_for_dispatch", payment_status: "paid", booking_source: "web", service_code: "express" },
  { id: "VS-DEMO-1039", created_at: "2026-10-17T07:30:00.000Z", tracking_id: null, prayog_awb: null, sender_name: "Sample Warehouse", sender_city: "Pune", sender_pincode: "411001", receiver_name: "Ananya Rao", receiver_city: "Hyderabad", receiver_pincode: "500081", courier_name: "Delhivery", courier_price: 128, status: "cancelled", payment_status: "refunded", booking_source: "csv", service_code: "surface" },
];

const inr = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
const label = (value: string | null) => (value || "created").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function BusinessOrders() {
  const navigate = useNavigate();
  const { business } = useBusinessAuth();
  const isDemo = isBusinessDemoSession();
  const [orders, setOrders] = useState<MerchantOrder[]>(isDemo ? DEMO_ORDERS : []);
  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

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
        .select("id,created_at,tracking_id,prayog_awb,sender_name,sender_city,sender_pincode,receiver_name,receiver_city,receiver_pincode,courier_name,courier_price,status,payment_status,booking_source,service_code")
        .eq("business_account_id", business.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (queryError) throw queryError;
      setOrders((data as MerchantOrder[]) || []);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Orders could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [business, isDemo]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusOptions = useMemo(() => Array.from(new Set(orders.map((order) => order.status || "created"))), [orders]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (status !== "all" && (order.status || "created") !== status) return false;
      if (!needle) return true;
      return [order.id, order.tracking_id, order.prayog_awb, order.receiver_name, order.receiver_city, order.receiver_pincode, order.courier_name]
        .some((value) => value?.toLowerCase().includes(needle));
    });
  }, [orders, query, status]);

  const exportCsv = () => {
    const escape = (value: string | number | null) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["Order ID", "Created At", "AWB", "Sender", "Receiver", "Destination", "Courier", "Service", "Amount", "Payment", "Status", "Source"],
      ...filtered.map((order) => [order.id, order.created_at, order.tracking_id || order.prayog_awb, order.sender_name, order.receiver_name, `${order.receiver_city} ${order.receiver_pincode}`, order.courier_name, order.service_code, order.courier_price, order.payment_status, order.status, order.booking_source]),
    ];
    const blob = new Blob([rows.map((row) => row.map(escape).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `viasetu-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageSeo title="Orders | ViaSetu Merchant Console" description="Review merchant shipments in one secure workspace." path="/viasetuforbusinesses/orders" />
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div><h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Orders</h1><p className="mt-1 text-sm text-muted-foreground">Search and review shipments owned by this merchant account.</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={exportCsv} disabled={!filtered.length}><Download />Export orders</Button><Button onClick={() => navigate("/viasetuforbusinesses/create-order")}><Plus />Create order</Button></div>
      </section>

      <Card className="merchant-bordered-card overflow-hidden">
        <CardHeader className="space-y-4 border-b pb-0">
          <div className="flex gap-6 text-sm font-bold"><button type="button" className="border-b-2 border-primary px-1 pb-4 text-primary">Ecom orders</button><button type="button" disabled className="px-1 pb-4 text-muted-foreground/60">Hyperlocal orders <Badge variant="outline" className="ml-2">Planned</Badge></button></div>
          <div className="flex flex-col justify-between gap-3 pb-4 lg:flex-row lg:items-center">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <div className="relative max-w-md flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Search order ID, AWB, receiver or pincode" aria-label="Search merchant orders" /></div>
              <Select value={status} onValueChange={setStatus}><SelectTrigger className="sm:w-52"><SelectValue placeholder="All statuses" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{statusOptions.map((option) => <SelectItem key={option} value={option}>{label(option)}</SelectItem>)}</SelectContent></Select>
            </div>
            <Button variant="outline" onClick={() => void load()} disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}Refresh</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error ? <div className="border-b border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div> : null}
          <div className="overflow-x-auto">
            <Table className="min-w-[1080px]">
              <TableHeader><TableRow><TableHead>Order & date</TableHead><TableHead>AWB</TableHead><TableHead>Sender</TableHead><TableHead>Receiver</TableHead><TableHead>Courier</TableHead><TableHead>Payment</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {!loading && filtered.length === 0 ? <TableRow><TableCell colSpan={9} className="h-80 text-center"><PackageOpen className="mx-auto mb-3 size-10 text-muted-foreground/50" /><p className="font-bold">No orders found</p><p className="mt-1 text-sm text-muted-foreground">Try another filter or create a shipment.</p></TableCell></TableRow> : null}
                {filtered.map((order) => <TableRow key={order.id}><TableCell><p className="font-bold">{order.id.slice(0, 14)}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="size-3" />{new Date(order.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p></TableCell><TableCell className="font-mono text-xs">{order.tracking_id || order.prayog_awb || "Pending"}</TableCell><TableCell><p className="text-sm font-semibold">{order.sender_name}</p><p className="text-xs text-muted-foreground">{order.sender_city} · {order.sender_pincode}</p></TableCell><TableCell><p className="text-sm font-semibold">{order.receiver_name}</p><p className="text-xs text-muted-foreground">{order.receiver_city} · {order.receiver_pincode}</p></TableCell><TableCell><p className="text-sm font-semibold">{order.courier_name}</p><p className="text-xs capitalize text-muted-foreground">{order.service_code || "Standard"}</p></TableCell><TableCell><Badge variant="outline" className="capitalize">{label(order.payment_status)}</Badge></TableCell><TableCell className="text-sm capitalize">{order.booking_source || "Web"}</TableCell><TableCell><Badge variant={order.status === "delivered" ? "default" : order.status === "cancelled" ? "destructive" : "secondary"}>{label(order.status)}</Badge></TableCell><TableCell className="text-right font-bold">{inr(Number(order.courier_price || 0))}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between border-t px-5 py-4 text-xs text-muted-foreground"><span>{filtered.length} of {orders.length} orders</span><span>{isDemo ? "Sample data only" : "Live merchant data"}</span></div>
        </CardContent>
      </Card>
    </div>
  );
}
