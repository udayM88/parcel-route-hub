import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Package, Plus, Truck,
  Search, Loader2, FileDown, Navigation, LifeBuoy, Mail, Phone,
  Ban, Copy, FileText, AlertTriangle, MessageCircle,
  ArrowRight, CircleCheckBig, WalletCards, ArrowUp,
} from "lucide-react";
import { openCrispChat } from "@/components/CrispChat";
import { useBusinessAuth } from "@/contexts/useBusinessAuth";
import { useToast } from "@/hooks/use-toast";
import PageSeo from "@/components/PageSeo";
import { bucketOfStatus, STATUS_BUCKETS, type StatusBucket } from "@/lib/booking-status";
import { extractGst } from "@/lib/pricing";
import { useCancelOrder, isCancellable } from "@/hooks/useCancelOrder";
import CancelOrderDialog from "@/components/booking/CancelOrderDialog";
import {
  resolvePartnerKey, trackingFunctionFor, labelFunctionFor, trackingBody, labelBody,
} from "@/lib/partner-functions";
import { isFreshLabelUrl } from "@/lib/label-url";
import viasetuLogisticsHero from "@/assets/merchant-console/viasetu-logistics-hero.png";
import { isBusinessDemoSession } from "@/lib/business-demo";




type BusinessBooking = {
  id: string;
  created_at: string;
  sender_name: string | null;
  sender_phone: string | null;
  sender_address: string | null;
  sender_city: string | null;
  sender_pincode: string | null;
  receiver_name: string | null;
  receiver_phone: string | null;
  receiver_address: string | null;
  receiver_city: string | null;
  receiver_pincode: string | null;
  sender_state: string | null;
  receiver_state: string | null;
  courier_name: string | null;
  courier_price: number | null;
  delivery_time: string | null;
  box_count: number | null;
  status: string | null;
  tracking_id: string | null;
  goods_type: string | null;
  partner_id: string | null;
  prayog_order_id: string | null;
  booking_source: string | null;
  prayog_awb: string | null;
  payment_status: string | null;
  payment_id: string | null;
  refund_id: string | null;
  shipment_value: number | null;
};

type BookingBox = {
  id: string;
  box_index: number;
  weight_kg: number | null;
  chargeable_weight_kg: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  tracking_id: string | null;
  label_url: string | null;
  status: string | null;

};

type TrackingEvent = {
  status: string;
  event?: string;
  location?: string;
  statusTimestamp?: number;
  createdAt?: string;
};

type FilterKey = "all" | StatusBucket;

const bucketLabel = (b: StatusBucket) =>
  STATUS_BUCKETS.find((s) => s.key === b)?.label || b;

const BusinessDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { business } = useBusinessAuth();
  const { toast } = useToast();
  const isDemo = isBusinessDemoSession();
  const [bookings, setBookings] = useState<BusinessBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<BusinessBooking | null>(null);
  const [boxes, setBoxes] = useState<BookingBox[]>([]);
  const [boxesLoading, setBoxesLoading] = useState(false);
  const [trackingBox, setTrackingBox] = useState<string | null>(null);
  const [trackingEvents, setTrackingEvents] = useState<Record<string, TrackingEvent[]>>({});
  const [trackingLoading, setTrackingLoading] = useState<string | null>(null);
  const [labelLoading, setLabelLoading] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBlocked, setCancelBlocked] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    const requestedSearch = searchParams.get("search");
    if (requestedSearch) setSearch(requestedSearch);
  }, [searchParams]);

  const BOOKING_COLUMNS =
    "id,created_at,sender_name,sender_phone,sender_address,sender_city,sender_state,sender_pincode,receiver_name,receiver_phone,receiver_address,receiver_city,receiver_state,receiver_pincode,courier_name,courier_price,delivery_time,box_count,status,tracking_id,goods_type,partner_id,prayog_order_id,booking_source,prayog_awb,payment_status,payment_id,refund_id,shipment_value";

  useEffect(() => {
    const load = async () => {
      if (!business) return;
      if (isDemo) {
        setBookings([]);
        setWalletBalance(5000);
        setLoading(false);
        return;
      }
      setLoading(true);
      const [ordersResult, walletResult] = await Promise.all([
        supabase
          .from("bookings")
          .select(BOOKING_COLUMNS)
          .eq("business_account_id", business.id)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("business_wallets")
          .select("balance")
          .eq("business_account_id", business.id)
          .maybeSingle(),
      ]);
      if (ordersResult.error || walletResult.error) {
        toast({
          title: "Could not refresh merchant overview",
          description: ordersResult.error?.message || walletResult.error?.message,
          variant: "destructive",
        });
      }
      setBookings((ordersResult.data ?? []) as BusinessBooking[]);
      setWalletBalance(Number(walletResult.data?.balance ?? 0));
      setLoading(false);
    };
    load();
  }, [business, isDemo, toast]);

  // Live updates for this business's bookings.
  useEffect(() => {
    if (!business || isDemo) return;
    const channel = supabase
      .channel("business-bookings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `business_account_id=eq.${business.id}` },
        (payload) => {
          const row = payload.new as BusinessBooking;
          if (!row?.id) return;
          setBookings((prev) => {
            const idx = prev.findIndex((b) => b.id === row.id);
            if (idx === -1) return [row, ...prev];
            const next = [...prev];
            next[idx] = { ...next[idx], ...row };
            return next;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [business, isDemo]);

  const counts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const b of bookings) {
      const k = bucketOfStatus(b.status);
      acc[k] = (acc[k] || 0) + 1;
    }
    return acc;
  }, [bookings]);

  const stats = useMemo(() => {
    const totalBoxes = bookings.reduce((sum, b) => sum + (b.box_count || 1), 0);
    const totalSpend = bookings.reduce((sum, b) => sum + Number(b.courier_price || 0), 0);
    const inTransit = (counts.in_transit || 0) + (counts.picked_up || 0);
    return {
      shipments: bookings.length,
      totalBoxes,
      totalSpend,
      inTransit,
      outForDelivery: counts.out_for_delivery || 0,
      delivered: counts.delivered || 0,
      cancelled: (counts.cancelled || 0) + (counts.rto || 0),
    };
  }, [bookings, counts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (filter !== "all") {
        const bucket = bucketOfStatus(b.status);
        if (filter === "in_transit" && !(bucket === "in_transit" || bucket === "picked_up")) return false;
        if (filter === "cancelled" && !(bucket === "cancelled" || bucket === "rto")) return false;
        if (filter !== "in_transit" && filter !== "cancelled" && bucket !== filter) return false;
      }
      if (!q) return true;
      return [b.tracking_id, b.receiver_name, b.receiver_city, b.receiver_pincode, b.courier_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [bookings, filter, search]);

  const openDetail = async (b: BusinessBooking) => {
    setSelected(b);
    setBoxes([]);
    setCancelBlocked(null);
    if (isDemo) return;
    setBoxesLoading(true);
    const { data } = await supabase
      .from("booking_boxes")
      .select("id,box_index,weight_kg,chargeable_weight_kg,length_cm,width_cm,height_cm,tracking_id,label_url,status")
      .eq("booking_id", b.id)
      .order("box_index", { ascending: true });
    setBoxes((data ?? []) as BookingBox[]);
    setBoxesLoading(false);
  };

  const refreshSelected = async (bookingId: string) => {
    if (isDemo) return;
    const { data } = await supabase
      .from("bookings")
      .select(BOOKING_COLUMNS)
      .eq("id", bookingId)
      .maybeSingle();
    if (!data) return;
    const row = data as unknown as BusinessBooking;
    setSelected((prev) => (prev && prev.id === row.id ? row : prev));
    setBookings((prev) => prev.map((b) => (b.id === row.id ? { ...b, ...row } : b)));
  };

  const { cancelOrder, cancelling } = useCancelOrder();

  const handleCancel = async (reason: Parameters<typeof cancelOrder>[0]["reason"], _waive?: boolean) => {
    if (!selected) return;
    if (isDemo) {
      toast({ title: "Sample mode", description: "No courier cancellation was sent." });
      setCancelOpen(false);
      return;
    }
    setCancelBlocked(null);
    const awbs = boxes.map((bx) => bx.tracking_id).filter(Boolean) as string[];
    const fallbackAwb = selected.tracking_id || selected.prayog_awb || null;
    const targets = awbs.length ? awbs : [fallbackAwb];

    let allOk = true;
    for (const awb of targets) {
      const ok = await cancelOrder({
        orderId: selected.prayog_order_id || selected.id,
        bookingSource: selected.booking_source || "",
        bookingId: selected.id,
        reason,
        awb,
      });
      if (!ok) allOk = false;
    }

    if (allOk) {
      setCancelOpen(false);
      await refreshSelected(selected.id);
    } else {
      setCancelBlocked(
        "We couldn't cancel every box with the courier. Please email support@viasetu.com with your shipment reference and our team will take it forward.",
      );
    }
  };


  const partnerKey = (b: BusinessBooking | null) =>
    b ? resolvePartnerKey(b.partner_id, b.courier_name) : null;

  const handleTrack = async (bx: BookingBox) => {
    const awb = bx.tracking_id;
    const key = partnerKey(selected);
    if (!awb || !key) {
      toast({ title: "Tracking unavailable", description: "AWB is not generated yet for this box.", variant: "destructive" });
      return;
    }
    if (trackingBox === bx.id) {
      setTrackingBox(null);
      return;
    }
    setTrackingBox(bx.id);
    if (trackingEvents[bx.id]) return;
    if (isDemo) {
      setTrackingEvents((current) => ({ ...current, [bx.id]: [{ status: "in_transit", event: "Sample parcel is in transit", location: "Pune", createdAt: new Date().toISOString() }] }));
      return;
    }
    setTrackingLoading(bx.id);
    try {
      const { data, error } = await supabase.functions.invoke(trackingFunctionFor(key), {
        body: trackingBody(key, awb, selected?.prayog_order_id),
      });
      if (error) throw error;
      const statuses: TrackingEvent[] = Array.isArray(data?.statuses) ? data.statuses : [];
      setTrackingEvents((prev) => ({ ...prev, [bx.id]: statuses }));
      if (statuses.length === 0) {
        toast({ title: "No tracking updates yet", description: "The courier has not scanned this shipment yet." });
      }
    } catch (e) {
      toast({
        title: "Tracking failed",
        description: e instanceof Error ? e.message : "Could not fetch tracking updates.",
        variant: "destructive",
      });
    } finally {
      setTrackingLoading(null);
    }
  };

  const handleLabel = async (bx: BookingBox) => {
    if (isDemo) {
      toast({ title: "Sample mode", description: "No courier label request was sent." });
      return;
    }
    if (isFreshLabelUrl(bx.label_url)) {
      window.open(bx.label_url as string, "_blank", "noopener");
      return;
    }

    const awb = bx.tracking_id;
    const key = partnerKey(selected);
    if (!awb || !key) {
      toast({ title: "Label unavailable", description: "AWB is not generated yet for this box.", variant: "destructive" });
      return;
    }
    setLabelLoading(bx.id);
    try {
      const { data, error } = await supabase.functions.invoke(labelFunctionFor(key), { body: labelBody(awb) });
      if (error) throw error;
      const url = data?.label_url || data?.labelUrl || data?.url;
      if (!url) throw new Error(data?.error || "Label could not be retrieved.");
      setBoxes((prev) => prev.map((x) => (x.id === bx.id ? { ...x, label_url: url } : x)));
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast({
        title: "Label unavailable",
        description: e instanceof Error ? e.message : "Could not fetch the shipping label.",
        variant: "destructive",
      });
    } finally {
      setLabelLoading(null);
    }
  };

  const handleRepeat = () => {
    if (!selected) return;
    navigate("/viasetuforbusinesses/book", {
      state: {
        repeat: {
          pickupPincode: selected.sender_pincode || "",
          deliveryPincode: selected.receiver_pincode || "",
          sender: {
            name: selected.sender_name || "",
            phone: selected.sender_phone || "",
            address: selected.sender_address || "",
            city: selected.sender_city || "",
            state: selected.sender_state || "",
            pincode: selected.sender_pincode || "",
          },
          receiver: {
            name: selected.receiver_name || "",
            phone: selected.receiver_phone || "",
            address: selected.receiver_address || "",
            city: selected.receiver_city || "",
            state: selected.receiver_state || "",
            pincode: selected.receiver_pincode || "",
          },
          goodsType: selected.goods_type || "Package",
          shipmentValue: selected.shipment_value ? String(selected.shipment_value) : "",
          boxes: (boxes.length ? boxes : []).map((bx) => ({
            weightG: bx.weight_kg ? String(Math.round(Number(bx.weight_kg) * 1000)) : "",
            length: bx.length_cm ? String(bx.length_cm) : "",
            width: bx.width_cm ? String(bx.width_cm) : "",
            height: bx.height_cm ? String(bx.height_cm) : "",
          })),
        },
      },
    });
  };

  const handleInvoice = () => {
    if (!selected) return;
    const total = Math.round(Number(selected.courier_price || 0));
    const gst = Math.round(extractGst(total));
    const net = total - gst;
    const rows = (boxes.length ? boxes : []).map(
      (bx) => `<tr><td>Box ${bx.box_index}</td><td>${bx.tracking_id || "—"}</td><td>${
        bx.chargeable_weight_kg || bx.weight_kg || "—"
      } kg</td></tr>`,
    ).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
<title>Invoice ${selected.tracking_id || selected.id}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; background:#f5f5f5; padding:24px; color:#111; }
  .wrap { max-width:800px; margin:0 auto; background:#fff; padding:36px; border-radius:8px; }
  h1 { font-size:28px; margin:0 0 4px; }
  .muted { color:#666; font-size:13px; }
  .row { display:flex; justify-content:space-between; gap:24px; margin-bottom:24px; }
  table { width:100%; border-collapse:collapse; margin:16px 0; font-size:14px; }
  th,td { text-align:left; padding:8px; border-bottom:1px solid #eee; }
  .totals td { border:none; }
  .totals { width:280px; margin-left:auto; }
  .total-row td { font-weight:700; border-top:2px solid #111; }
  @media print { body { background:#fff; padding:0; } .wrap { border-radius:0; } }
</style></head><body><div class="wrap">
  <div class="row">
    <div><h1>ViaSetu</h1><p class="muted">India's Consumer Courier Aggregator<br/>support@viasetu.com</p></div>
    <div style="text-align:right"><h1>INVOICE</h1>
      <p class="muted">Shipment: ${selected.tracking_id || selected.id}<br/>
      Date: ${new Date(selected.created_at).toLocaleDateString()}<br/>
      Courier: ${selected.courier_name || "—"}</p></div>
  </div>
  <div class="row">
    <div><strong>Billed to</strong><p class="muted">${business?.company_name || ""}<br/>${business?.email || ""}</p></div>
    <div><strong>Pickup</strong><p class="muted">${selected.sender_name || ""}<br/>${selected.sender_address || ""}, ${selected.sender_city || ""} ${selected.sender_pincode || ""}</p></div>
    <div><strong>Delivery</strong><p class="muted">${selected.receiver_name || ""}<br/>${selected.receiver_address || ""}, ${selected.receiver_city || ""} ${selected.receiver_pincode || ""}</p></div>
  </div>
  <table><thead><tr><th>Item</th><th>AWB</th><th>Chargeable weight</th></tr></thead>
  <tbody>${rows || `<tr><td>Shipment</td><td>${selected.tracking_id || "—"}</td><td>—</td></tr>`}</tbody></table>
  <table class="totals">
    <tr><td>Shipping charges</td><td style="text-align:right">₹${net}</td></tr>
    <tr><td>GST (18%)</td><td style="text-align:right">₹${gst}</td></tr>
    <tr class="total-row"><td>Total</td><td style="text-align:right">₹${total}</td></tr>
  </table>
  <p class="muted">ViaSetu acts as a facilitator between the customer and the courier partner. This invoice is generated electronically and does not require a signature.</p>
</div></body></html>`;

    const w = window.open("", "_blank");
    if (!w) {
      toast({ title: "Popup blocked", description: "Allow popups to download the invoice.", variant: "destructive" });
      return;
    }
    w.document.write(html);
    w.document.close();
  };

  const setupSteps = useMemo(() => {
    const approved = business?.status === "approved" && business.is_active;
    const hasPickupAddress = Boolean(business?.address && business?.pincode);
    const hasWalletFunds = walletBalance > 0;
    return [
      { label: "Business KYC", detail: approved ? "Verified" : "Pending verification", complete: approved },
      { label: "Pickup address", detail: hasPickupAddress ? `${business?.city || "Address"} · ${business?.pincode}` : "Address required", complete: hasPickupAddress },
      { label: "Shipping access", detail: approved ? "Enabled" : "Approval required", complete: approved },
      { label: "Prepaid wallet", detail: hasWalletFunds ? `₹${walletBalance.toLocaleString("en-IN")} available` : "Funding required", complete: hasWalletFunds },
    ];
  }, [business, walletBalance]);
  const completedSetupSteps = setupSteps.filter((item) => item.complete).length;
  const setupProgress = Math.round((completedSetupSteps / setupSteps.length) * 100);

  const recentEvents = useMemo(() => {
    if (isDemo) {
      return [
        ["VS-DEMO-1042", "Sample Online Store", "Ready for dispatch", "Today, 10:28 AM"],
        ["VS-DEMO-1041", "Manual order", "In transit", "Today, 09:16 AM"],
        ["VS-DEMO-1040", "Sample Online Store", "Delivered", "Yesterday, 06:44 PM"],
      ];
    }

    return bookings.slice(0, 3).map((booking) => [
      booking.tracking_id || booking.id.slice(0, 12),
      booking.booking_source || booking.courier_name || "Merchant console",
      bucketLabel(bucketOfStatus(booking.status)),
      new Date(booking.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }),
    ]);
  }, [bookings, isDemo]);

  const selectedBreakdown = useMemo(() => {
    if (!selected) return null;
    const total = Math.round(Number(selected.courier_price || 0));
    const gst = extractGst(total);
    return { total, gst, net: Math.round(total - gst) };
  }, [selected]);

  return (
    <div className="min-h-screen bg-transparent">
      <PageSeo
        title="Business Dashboard | ViaSetu for Businesses"
        description="Track your business shipments, boxes and spend on ViaSetu."
        path="/viasetuforbusinesses/dashboard"
      />
      <main className="space-y-[18px]">
        <section className="flex min-w-0 flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
          <div className="min-w-0">
            <h1 className="text-[2rem] font-extrabold leading-[1.2] tracking-[-0.025em] text-foreground">
              Good afternoon, {business?.company_name || "Sample Merchant"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Here is a safe preview of your shipping operations workspace.</p>
          </div>
          <Button className="h-9 shrink-0 px-4" onClick={() => navigate("/viasetuforbusinesses/create-order")}>
            <Plus className="mr-1 size-5" /> {isDemo ? "Create sample order" : "Create order"}
          </Button>
        </section>
        <Card className="merchant-hero-card merchant-bordered-card overflow-hidden border-cyan-200/60">
          <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
            <div
              className="merchant-hero-visual relative flex min-h-[310px] items-center overflow-hidden bg-[#071217] p-[22px] text-white md:min-h-[324px] md:p-7"
              style={{
                backgroundImage: `linear-gradient(90deg, rgba(4, 14, 19, .98) 0%, rgba(4, 14, 19, .88) 45%, rgba(4, 14, 19, .12) 100%), url(${viasetuLogisticsHero})`,
                backgroundPosition: "center right",
                backgroundSize: "cover",
              }}
            >
              <div className="merchant-hero-copy relative z-10 max-w-[570px]">
                <Badge className="border-cyan-300/20 bg-cyan-300/15 text-cyan-100 shadow-none backdrop-blur-md hover:bg-cyan-300/15">ViaSetu Merchant Console</Badge>
                <h2 className="mt-[18px] max-w-[520px] text-[1.45rem] font-extrabold leading-[1.25] tracking-[-0.025em] md:text-[1.7rem]">Every shipment. One clear route.</h2>
                <p className="mt-2 max-w-[530px] text-sm leading-[1.55] text-slate-300">Create orders, connect your store and follow every delivery from one simple workspace.</p>
                <Button variant="secondary" className="mt-[22px] h-11 bg-white px-[18px] text-[#087f8d] hover:bg-cyan-50 hover:text-[#076c78]" onClick={() => navigate("/viasetuforbusinesses/integrations")}>Explore integrations <ArrowRight className="ml-1 size-5" /></Button>
              </div>
            </div>
            <div className="merchant-setup-panel flex flex-col justify-center p-[22px] md:p-[21px] lg:justify-start lg:pt-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[1.05rem] font-extrabold leading-[1.4]">Merchant setup</h2>
                  <p className="mt-1 text-xs leading-[1.5] text-muted-foreground">{completedSetupSteps} of {setupSteps.length} steps completed</p>
                </div>
                <p className="text-xs font-extrabold text-primary">{setupProgress}%</p>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#dce4f1]" role="progressbar" aria-label="Merchant setup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={setupProgress}>
                <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${setupProgress}%` }} />
              </div>
              <div className="mt-3 divide-y divide-[#e2e8f2]">
                {setupSteps.map((step) => (
                  <div key={step.label} className="flex min-h-[47px] items-center gap-[11px] py-1">
                    <span className={`grid shrink-0 place-items-center ${step.complete ? "text-[#0a8f5b]" : "text-[#718096]"}`}>
                      {step.complete ? <CircleCheckBig className="size-5" /> : <WalletCards className="size-5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold leading-[1.5] text-foreground">{step.label}</p>
                      <p className="text-[11px] leading-[1.45] text-[#5b6b87]">{step.detail}</p>
                    </div>
                    {step.complete ? (
                      <span className="text-[11px] font-bold text-[#0a8f5b]">Complete</span>
                    ) : (
                      <Button size="sm" variant="outline" className="h-[30px] min-h-0 border border-cyan-200 bg-white px-3 text-[#087f8d] hover:bg-cyan-50 hover:text-[#076c78]" onClick={() => navigate("/viasetuforbusinesses/wallet")}>Add funds</Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <section className="grid gap-4 md:grid-cols-3">
          <button type="button" onClick={() => setFilter("all")} className="text-left">
            <Card className={`merchant-stat-card merchant-stat-cyan min-h-[126px] ${filter === "all" ? "ring-1 ring-cyan-500/35" : ""}`} style={{ animationDelay: "90ms" }}>
              <CardContent className="p-[18px]">
                <div className="flex items-start justify-between">
                  <div><p className="text-xs font-bold text-[#40516b]">{isDemo ? "Sample orders" : "Total orders"}</p><p className="mt-1 text-[1.7rem] font-extrabold leading-[1.2] tracking-[-0.03em] text-[#10213e]">{isDemo ? 24 : stats.shipments}</p></div>
                  <span className="grid size-[42px] place-items-center rounded-xl border border-white/80 bg-white/75 text-[#078b9b]"><Package className="size-[22px]" /></span>
                </div>
                <div className="mt-3 flex items-center gap-1"><ArrowUp className="size-3.5 text-[#078b9b]" /><span className="text-[11px] font-medium text-[#50617a]">{isDemo ? "+8 this week" : `${stats.totalBoxes} boxes booked`}</span></div>
              </CardContent>
            </Card>
          </button>

          <button type="button" onClick={() => setFilter("in_transit")} className="text-left">
            <Card className={`merchant-stat-card merchant-stat-slate min-h-[126px] ${filter === "in_transit" ? "ring-1 ring-slate-500/35" : ""}`} style={{ animationDelay: "145ms" }}>
              <CardContent className="p-[18px]">
                <div className="flex items-start justify-between">
                  <div><p className="text-xs font-bold text-[#40516b]">In transit</p><p className="mt-1 text-[1.7rem] font-extrabold leading-[1.2] tracking-[-0.03em] text-[#10213e]">{isDemo ? 8 : stats.inTransit}</p></div>
                  <span className="grid size-[42px] place-items-center rounded-xl border border-white/80 bg-white/75 text-[#243b4a]"><Truck className="size-[22px]" /></span>
                </div>
                <div className="mt-3 flex items-center gap-1"><ArrowUp className="size-3.5 text-[#243b4a]" /><span className="text-[11px] font-medium text-[#50617a]">{isDemo ? "2 due today" : `${stats.outForDelivery} out for delivery`}</span></div>
              </CardContent>
            </Card>
          </button>

          <button type="button" onClick={() => navigate("/viasetuforbusinesses/wallet")} className="text-left">
            <Card className="merchant-stat-card merchant-stat-amber min-h-[126px]" style={{ animationDelay: "200ms" }}>
              <CardContent className="p-[18px]">
                <div className="flex items-start justify-between">
                  <div><p className="text-xs font-bold text-[#40516b]">{isDemo ? "Demo wallet" : "Wallet balance"}</p><p className="mt-1 text-[1.7rem] font-extrabold leading-[1.2] tracking-[-0.03em] text-[#10213e]">₹{Math.round(walletBalance).toLocaleString("en-IN")}</p></div>
                  <span className="grid size-[42px] place-items-center rounded-xl border border-white/80 bg-white/75 text-[#a96511]"><WalletCards className="size-[22px]" /></span>
                </div>
                <div className="mt-3 flex items-center gap-1"><ArrowUp className="size-3.5 text-[#a96511]" /><span className="text-[11px] font-medium text-[#50617a]">{isDemo ? "Non-financial mock balance" : walletBalance > 0 ? "Available for merchant shipments" : "Add funds to create prepaid shipments"}</span></div>
              </CardContent>
            </Card>
          </button>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="merchant-bordered-card border-[#d9e3f2] bg-[linear-gradient(180deg,#fff_0%,#f7faff_100%)] shadow-[0_10px_28px_rgba(35,55,95,.055)]">
            <CardContent className="p-[23px]">
              <div className="flex items-center justify-between gap-3">
                <div><h2 className="text-base font-extrabold">Recent shipment activity</h2><p className="mt-1 text-xs text-muted-foreground">{isDemo ? "Sample events used for UI evaluation." : "Latest activity for this merchant account."}</p></div>
                <Button variant="ghost" size="sm" onClick={() => navigate("/viasetuforbusinesses/orders")}>View all</Button>
              </div>
              <div className="mt-4 divide-y divide-border">
                {recentEvents.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">No shipment activity yet.</div>
                ) : recentEvents.map(([id, source, status, time]) => (
                  <div key={id} className="grid items-center gap-2 py-3 sm:grid-cols-[145px_1fr_145px_150px]">
                    <span className="text-xs font-extrabold">{id}</span>
                    <span className="hidden text-xs text-muted-foreground sm:block">{source}</span>
                    <Badge variant="outline" className="w-fit bg-white/70 text-[10px]">{status}</Badge>
                    <span className="hidden text-[11px] text-muted-foreground sm:block">{time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="merchant-bordered-card border-[#d4e0fa] bg-[linear-gradient(155deg,#eefbfd_0%,#f8fcfd_100%)] shadow-[0_10px_28px_rgba(35,55,95,.06)]">
            <CardContent className="p-[23px]">
              <h2 className="text-base font-extrabold">Quick actions</h2>
              <div className="mt-4 space-y-2">
                {[
                  ["Create an order", "/viasetuforbusinesses/create-order"],
                  ["Calculate shipping rate", "/viasetuforbusinesses/module/rate-calculator"],
                  ["Track a shipment", "/viasetuforbusinesses/module/tracking"],
                  ["Connect a sales channel", "/viasetuforbusinesses/integrations"],
                ].map(([label, route], index) => (
                  <Button key={label} variant={index === 0 ? "default" : "outline"} className={`w-full justify-between ${index === 0 ? "" : "bg-white/70"}`} onClick={() => navigate(route)}>{label}<ArrowRight className="size-4" /></Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <Card className="merchant-bordered-card">
          <CardHeader className="gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle>Shipments</CardTitle>
                <CardDescription>All amounts shown are inclusive of GST.</CardDescription>
              </div>
              <div className="relative sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search AWB, receiver, pincode..."
                  className="pl-9"
                />
              </div>
            </div>
            {filter !== "all" && (
              <div>
                <Badge variant="secondary" className="gap-2">
                  {filter === "in_transit" ? "In Transit" : filter === "cancelled" ? "Cancelled / RTO" : bucketLabel(filter as StatusBucket)}
                  <button type="button" onClick={() => setFilter("all")} className="underline">clear</button>
                </Badge>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading...</p>
            ) : filtered.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No shipments found.</p>
            ) : (
              <div className="overflow-x-auto overscroll-x-contain">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>AWB</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Courier</TableHead>
                      <TableHead className="text-center">Boxes</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((b) => (
                      <TableRow key={b.id} className="cursor-pointer" onClick={() => openDetail(b)}>
                        <TableCell>{new Date(b.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="font-mono text-xs">{b.tracking_id || "—"}</TableCell>
                        <TableCell>{b.receiver_city || "—"} {b.receiver_pincode}</TableCell>
                        <TableCell>{b.courier_name || "—"}</TableCell>
                        <TableCell className="text-center">{b.box_count || 1}</TableCell>
                        <TableCell className="text-right">₹{Math.round(Number(b.courier_price || 0))}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{bucketLabel(bucketOfStatus(b.status))}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Shipment details</DialogTitle>
            <DialogDescription>
              {selected?.courier_name || "Courier"} · {selected?.delivery_time || "—"} ·{" "}
              {selected ? bucketLabel(bucketOfStatus(selected.status)) : ""}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="border rounded-lg p-3">
                  <p className="font-semibold mb-1">Pickup</p>
                  <p>{selected.sender_name}</p>
                  <p className="text-muted-foreground">{selected.sender_phone}</p>
                  <p className="text-muted-foreground">
                    {selected.sender_address}, {selected.sender_city} {selected.sender_pincode}
                  </p>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="font-semibold mb-1">Delivery</p>
                  <p>{selected.receiver_name}</p>
                  <p className="text-muted-foreground">{selected.receiver_phone}</p>
                  <p className="text-muted-foreground">
                    {selected.receiver_address}, {selected.receiver_city} {selected.receiver_pincode}
                  </p>
                </div>
              </div>

              <div className="border rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Goods type</p>
                  <p className="font-medium">{selected.goods_type || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Declared value</p>
                  <p className="font-medium">{selected.shipment_value ? `₹${selected.shipment_value}` : "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Courier service</p>
                  <p className="font-medium">{selected.courier_name || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Promised delivery</p>
                  <p className="font-medium">{selected.delivery_time || "—"}</p>
                </div>
              </div>

              {(() => {
                const ps = (selected.payment_status || "").toLowerCase();
                if (!ps) return null;
                const map: Record<string, { label: string; cls: string }> = {
                  paid: { label: "Payment received", cls: "border-l-green-500 bg-green-50" },
                  refunded: { label: "Refund completed", cls: "border-l-green-500 bg-green-50" },
                  refund_initiated: { label: "Refund initiated", cls: "border-l-yellow-500 bg-yellow-50" },
                  refund_failed: { label: "Refund failed — our team is on it", cls: "border-l-red-500 bg-red-50" },
                };
                const info = map[ps] || { label: `Payment: ${selected.payment_status}`, cls: "border-l-muted bg-muted/40" };
                return (
                  <div className={`border border-l-4 rounded-lg p-3 ${info.cls}`}>
                    <p className="font-medium text-xs">{info.label}</p>
                    {selected.refund_id && (
                      <p className="text-[11px] text-muted-foreground">Refund reference: {selected.refund_id}</p>
                    )}
                  </div>
                );
              })()}


              <div>
                <p className="font-semibold mb-2">Boxes ({selected.box_count || 1})</p>
                {boxesLoading ? (
                  <p className="text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading boxes...
                  </p>
                ) : boxes.length === 0 ? (
                  <p className="text-muted-foreground">No per-box details available.</p>
                ) : (
                  <div className="space-y-2">
                    {boxes.map((bx) => (
                      <div key={bx.id} className="border rounded-lg p-3 space-y-3">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <p className="font-medium">Box {bx.box_index}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {bx.tracking_id ? `AWB ${bx.tracking_id}` : "AWB pending"} ·{" "}
                              {bx.chargeable_weight_kg || bx.weight_kg || "—"} kg
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{bx.status || "created"}</Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!bx.tracking_id || trackingLoading === bx.id}
                              onClick={() => handleTrack(bx)}
                            >
                              {trackingLoading === bx.id ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <Navigation className="h-4 w-4 mr-1" />
                              )}
                              {trackingBox === bx.id ? "Hide" : "Track"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={(!bx.tracking_id && !bx.label_url) || labelLoading === bx.id}
                              onClick={() => handleLabel(bx)}
                            >
                              {labelLoading === bx.id ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <FileDown className="h-4 w-4 mr-1" />
                              )}
                              Label
                            </Button>
                          </div>
                        </div>

                        {trackingBox === bx.id && (
                          <div className="border-t pt-3">
                            {trackingLoading === bx.id ? (
                              <p className="text-xs text-muted-foreground flex items-center gap-2">
                                <Loader2 className="h-3 w-3 animate-spin" /> Fetching tracking updates...
                              </p>
                            ) : (trackingEvents[bx.id] || []).length === 0 ? (
                              <p className="text-xs text-muted-foreground">No tracking updates yet.</p>
                            ) : (
                              <ol className="space-y-3">
                                {(trackingEvents[bx.id] || []).map((ev, i) => (
                                  <li key={i} className="flex gap-3">
                                    <div className="flex flex-col items-center">
                                      <span className={`h-2 w-2 rounded-full mt-1.5 ${i === 0 ? "bg-primary" : "bg-muted-foreground/40"}`} />
                                      {i < (trackingEvents[bx.id] || []).length - 1 && (
                                        <span className="flex-1 w-px bg-border mt-1" />
                                      )}
                                    </div>
                                    <div className="min-w-0 pb-1">
                                      <p className="text-xs font-medium">{ev.status || ev.event}</p>
                                      {ev.event && ev.event !== ev.status && (
                                        <p className="text-xs text-muted-foreground">{ev.event}</p>
                                      )}
                                      <p className="text-[11px] text-muted-foreground">
                                        {[ev.location, ev.statusTimestamp ? new Date(ev.statusTimestamp).toLocaleString() : ev.createdAt ? new Date(ev.createdAt).toLocaleString() : ""]
                                          .filter(Boolean)
                                          .join(" · ")}
                                      </p>
                                    </div>
                                  </li>
                                ))}
                              </ol>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedBreakdown && (
                <div className="border rounded-lg p-3 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping charges</span>
                    <span>₹{selectedBreakdown.net}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GST (18%)</span>
                    <span>₹{selectedBreakdown.gst}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between font-bold">
                    <span>Total paid</span>
                    <span>₹{Math.round(Number(selected.courier_price || 0))}</span>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={handleInvoice}>
                  <FileText className="h-4 w-4 mr-1" /> Download invoice
                </Button>
                <Button size="sm" variant="outline" onClick={handleRepeat}>
                  <Copy className="h-4 w-4 mr-1" /> Repeat shipment
                </Button>
                {isCancellable(selected.status) && (
                  <Button size="sm" variant="destructive" onClick={() => setCancelOpen(true)} disabled={cancelling}>
                    <Ban className="h-4 w-4 mr-1" /> Cancel shipment
                  </Button>
                )}
              </div>

              {cancelBlocked && (
                <div className="border border-amber-300 bg-amber-50 rounded-lg p-3 flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-900">{cancelBlocked}</p>
                </div>
              )}


              <div className="border rounded-lg p-3 space-y-2">
                <p className="font-semibold flex items-center gap-2">
                  <LifeBuoy className="h-4 w-4" /> Need help with this shipment?
                </p>
                <p className="text-xs text-muted-foreground">
                  Quote reference {selected.tracking_id || selected.id.slice(0, 8)} when you contact us.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <a
                      href={`mailto:support@viasetu.com?subject=${encodeURIComponent(
                        `Support request - shipment ${selected.tracking_id || selected.id}`,
                      )}&body=${encodeURIComponent(
                        `Company: ${business?.company_name || ""}\nShipment ID: ${selected.id}\nAWB: ${selected.tracking_id || "pending"}\nCourier: ${selected.courier_name || ""}\n\nIssue:\n`,
                      )}`}
                    >
                      <Mail className="h-4 w-4 mr-1" /> Email support
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href="tel:+919406833147">
                      <Phone className="h-4 w-4 mr-1" /> +91 94068 33147
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" onClick={openCrispChat}>
                    <MessageCircle className="h-4 w-4 mr-1" /> Live chat
                  </Button>
                </div>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>

      <CancelOrderDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        onConfirm={handleCancel}
        cancelling={cancelling}
        bookingId={selected?.id}
      />
    </div>
  );

};

export default BusinessDashboard;
