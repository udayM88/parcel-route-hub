import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Building2, Package, IndianRupee, Boxes, LogOut, Plus, Truck, CheckCircle2,
  XCircle, Search, MapPin, Loader2, FileDown, Navigation, LifeBuoy, Mail, Phone,
  Ban, Copy, FileText, AlertTriangle,
} from "lucide-react";
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
  const { business } = useBusinessAuth();
  const { toast } = useToast();
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

  useEffect(() => {
    const load = async () => {
      if (!business) return;
      setLoading(true);
      const { data } = await supabase
        .from("bookings")
        .select(
          "id,created_at,sender_name,sender_phone,sender_address,sender_city,sender_pincode,receiver_name,receiver_phone,receiver_address,receiver_city,receiver_pincode,courier_name,courier_price,delivery_time,box_count,status,tracking_id,goods_type,partner_id,prayog_order_id",
        )
        .eq("business_account_id", business.id)
        .order("created_at", { ascending: false })
        .limit(500);
      setBookings((data ?? []) as BusinessBooking[]);
      setLoading(false);
    };
    load();
  }, [business]);

  // Live updates for this business's bookings.
  useEffect(() => {
    if (!business) return;
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
  }, [business]);

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
    setBoxesLoading(true);
    const { data } = await supabase
      .from("booking_boxes")
      .select("id,box_index,weight_kg,chargeable_weight_kg,tracking_id,label_url,status")
      .eq("booking_id", b.id)
      .order("box_index", { ascending: true });
    setBoxes((data ?? []) as BookingBox[]);
    setBoxesLoading(false);
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
    if (bx.label_url) {
      window.open(bx.label_url, "_blank", "noopener");
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/viasetuforbusinesses");
  };

  const tiles: { key: FilterKey; label: string; value: number | string; icon: typeof Package }[] = [
    { key: "all", label: "Total Shipments", value: stats.shipments, icon: Package },
    { key: "in_transit", label: "In Transit", value: stats.inTransit, icon: Truck },
    { key: "out_for_delivery", label: "Out for Delivery", value: stats.outForDelivery, icon: MapPin },
    { key: "delivered", label: "Delivered", value: stats.delivered, icon: CheckCircle2 },
    { key: "cancelled", label: "Cancelled / RTO", value: stats.cancelled, icon: XCircle },
  ];

  const selectedBreakdown = useMemo(() => {
    if (!selected) return null;
    const total = Math.round(Number(selected.courier_price || 0));
    const gst = extractGst(total);
    return { total, gst, net: Math.round(total - gst) };
  }, [selected]);

  return (
    <div className="min-h-screen bg-muted/30">
      <PageSeo
        title="Business Dashboard | ViaSetu for Businesses"
        description="Track your business shipments, boxes and spend on ViaSetu."
        path="/viasetuforbusinesses/dashboard"
      />
      <header className="bg-background border-b sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between p-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold truncate">{business?.company_name}</h1>
              <p className="text-xs text-muted-foreground truncate">ViaSetu for Businesses</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => navigate("/viasetuforbusinesses/book")}>
              <Plus className="h-4 w-4 mr-1" /> New Shipment
            </Button>
            <Button size="sm" variant="ghost" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {tiles.map((t) => {
            const Icon = t.icon;
            const active = filter === t.key;
            return (
              <button key={t.key} type="button" onClick={() => setFilter(t.key)} className="text-left">
                <Card className={`transition-colors h-full ${active ? "border-primary ring-1 ring-primary" : "hover:border-primary/40"}`}>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-xs sm:text-sm font-medium">{t.label}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  </CardHeader>
                  <CardContent><p className="text-2xl font-bold">{t.value}</p></CardContent>
                </Card>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Boxes Shipped</CardTitle>
              <Boxes className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{stats.totalBoxes}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">₹{Math.round(stats.totalSpend)}</p></CardContent>
          </Card>
        </div>

        <Card>
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
              <div className="overflow-x-auto">
                <Table>
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
                    <a href="tel:+919013999909">
                      <Phone className="h-4 w-4 mr-1" /> +91 90139 99909
                    </a>
                  </Button>
                </div>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BusinessDashboard;
