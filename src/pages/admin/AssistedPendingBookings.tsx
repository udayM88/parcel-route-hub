import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import ManualAwbDialog from "@/components/admin/ManualAwbDialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CURRENT_ENV } from "@/config/environment";
import {
  RefreshCw, Copy, ExternalLink, Loader2, KeyRound, CheckCircle2, Clock,
  Truck, Download, PackageCheck, PackagePlus,
} from "lucide-react";
import { resolvePartnerKey, trackingFunctionFor, trackingBody } from "@/lib/partner-functions";

interface TrackEvent {
  status: string;
  location?: string;
  statusTimestamp: number;
  category?: string;
  subcategory?: string;
}

interface PendingRow {
  id: string;
  created_at: string;
  sender_name: string | null;
  receiver_name: string | null;
  courier_name: string | null;
  courier_price: number | null;
  payment_link_id: string | null;
  payment_link_url: string | null;
  payment_link_status: string | null;
  status: string;
  created_by_admin_email: string | null;
  sender_city: string | null;
  receiver_city: string | null;
  prayog_awb: string | null;
  tracking_id: string | null;
  label_url: string | null;
  booking_source: string | null;
  partner_id: string | null;
  prayog_order_id: string | null;
}


const AssistedPendingBookings = () => {
  const { toast } = useToast();
  
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [confirmed, setConfirmed] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [labelBusyId, setLabelBusyId] = useState<string | null>(null);
  const [manualDialog, setManualDialog] = useState<{ booking: PendingRow } | null>(null);
  const [awbDialogRow, setAwbDialogRow] = useState<PendingRow | null>(null);
  const [manualPaymentId, setManualPaymentId] = useState("");
  const [submittingManual, setSubmittingManual] = useState(false);
  const [trackingBusyId, setTrackingBusyId] = useState<string | null>(null);
  const [tracking, setTracking] = useState<Record<string, TrackEvent[]>>({});

  const SELECT_COLS =
    "id, created_at, sender_name, receiver_name, courier_name, courier_price, payment_link_id, payment_link_url, payment_link_status, status, created_by_admin_email, sender_city, receiver_city, prayog_awb, tracking_id, label_url, booking_source, partner_id, prayog_order_id";


  const fetchRows = async () => {
    const [{ data: pendingData, error: pendErr }, { data: confirmedData, error: confErr }] =
      await Promise.all([
        supabase
          .from("bookings")
          .select(SELECT_COLS)
          .eq("is_admin_assisted", true)
          .eq("status", "PENDING_PAYMENT")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("bookings")
          .select(SELECT_COLS)
          .eq("is_admin_assisted", true)
          .not("prayog_awb", "is", null)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
    if (pendErr || confErr) {
      toast({
        title: "Failed to load",
        description: (pendErr || confErr)?.message,
        variant: "destructive",
      });
    } else {
      setPending((pendingData || []) as PendingRow[]);
      setConfirmed((confirmedData || []) as PendingRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
    const t = setInterval(fetchRows, 30_000);
    return () => clearInterval(t);
  }, []);

  const doFinalize = async (bookingId: string, manualPaymentId?: string) => {
    const { data, error } = await supabase.functions.invoke(
      "admin-finalize-assisted-booking",
      {
        body: { booking_id: bookingId, ...(manualPaymentId ? { manual_payment_id: manualPaymentId } : {}) },
        headers: { "x-environment": CURRENT_ENV },
      },
    );
    if (error) {
      toast({ title: "Refresh failed", description: error.message, variant: "destructive" });
      return null;
    }
    if (data?.paid && data?.booked) {
      toast({
        title: "Booking confirmed",
        description: data.awb_number
          ? `AWB ${data.awb_number}${data.already ? " (already booked)" : ""}`
          : "Courier booking created",
      });
    } else if (data?.paid && !data?.booked) {
      toast({
        title: "Payment received, but partner booking failed",
        description: data?.refund_id
          ? `Auto-refunded (${data.refund_id}). ${data?.error || ""}`
          : data?.error || "Please investigate.",
        variant: "destructive",
      });
    } else if (data?.paid === false) {
      toast({
        title: "Payment not received yet",
        description: `Link status: ${data.link_status || "unknown"}`,
      });
    } else if (data?.error) {
      toast({ title: "Error", description: data.error, variant: "destructive" });
    }
    return data;
  };

  const handleRefresh = async (row: PendingRow) => {
    setRefreshingId(row.id);
    try {
      await doFinalize(row.id);
      await fetchRows();
    } finally {
      setRefreshingId(null);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualDialog) return;
    const pid = manualPaymentId.trim();
    if (!pid.startsWith("pay_")) {
      toast({ title: "Invalid payment ID", description: "Must start with 'pay_'", variant: "destructive" });
      return;
    }
    setSubmittingManual(true);
    try {
      await doFinalize(manualDialog.booking.id, pid);
      await fetchRows();
      setManualDialog(null);
      setManualPaymentId("");
    } finally {
      setSubmittingManual(false);
    }
  };

  const handleTrack = async (row: PendingRow) => {
    const awb = row.prayog_awb || row.tracking_id;
    if (!awb) {
      toast({ title: "No AWB yet", variant: "destructive" });
      return;
    }
    if (tracking[row.id]) {
      setTracking((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      return;
    }
    const key = resolvePartnerKey(row.partner_id, `${row.booking_source || ""} ${row.courier_name || ""}`);
    if (!key) {
      toast({ title: "Tracking unavailable", description: "Unknown courier partner.", variant: "destructive" });
      return;
    }
    setTrackingBusyId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke(trackingFunctionFor(key), {
        body: trackingBody(key, awb, row.prayog_order_id),
        headers: { "x-environment": CURRENT_ENV },
      });
      if (error) throw error;
      const statuses = (data?.statuses || []) as TrackEvent[];
      if (!statuses.length) {
        toast({ title: "No tracking events yet", description: "The courier hasn't scanned this shipment." });
      }
      setTracking((prev) => ({ ...prev, [row.id]: statuses }));
    } catch (e: any) {
      toast({ title: "Tracking failed", description: e?.message || "Please try again", variant: "destructive" });
    } finally {
      setTrackingBusyId(null);
    }
  };


  const handleDownloadLabel = async (row: PendingRow) => {
    if (row.label_url) {
      window.open(row.label_url, "_blank");
      return;
    }
    // No cached label — fetch fresh via partner-specific label function using the AWB.
    const awb = row.prayog_awb || row.tracking_id;
    if (!awb) {
      toast({ title: "AWB not available yet", variant: "destructive" });
      return;
    }
    const source = (row.booking_source || "").toLowerCase();
    const fnMap: Record<string, string> = {
      delhivery_direct: "delhivery-label",
      shadowfax_direct: "shadowfax-label",
      xpressbees_direct: "xpressbees-label",
      urbanebolt_direct: "urbanebolt-label",
      shree_maruti_direct: "shree-maruti-label",
    };
    const fnName = fnMap[source];
    if (!fnName) {
      toast({
        title: "Label unavailable",
        description: `Cached label missing for source ${source || "unknown"}.`,
        variant: "destructive",
      });
      return;
    }
    setLabelBusyId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: { waybill: awb, awb, booking_id: row.id },
        headers: { "x-environment": CURRENT_ENV },
      });
      if (error) throw error;
      if (data?.success && data?.label_url) {
        window.open(data.label_url, "_blank");
        // Persist for next time
        await supabase.from("bookings").update({ label_url: data.label_url }).eq("id", row.id);
        await fetchRows();
      } else {
        toast({
          title: "Label unavailable",
          description: data?.error || "Could not retrieve label.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed", variant: "destructive" });
    } finally {
      setLabelBusyId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6 text-primary" /> Assisted Bookings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage admin-assisted bookings. Refresh Razorpay payments, then track shipments and
            download labels once booked.
          </p>
        </div>
        <Button variant="outline" onClick={fetchRows} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Reload
        </Button>
      </div>

      {/* Pending Payment */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-600" /> Pending Payment ({pending.length})
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : pending.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-600" />
              No pending assisted bookings.
            </CardContent>
          </Card>
        ) : (
          pending.map((row) => (
            <Card key={row.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="text-base">
                      {row.sender_name || "—"} → {row.receiver_name || "—"}
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs">
                      {row.sender_city || "?"} → {row.receiver_city || "?"} ·{" "}
                      {row.courier_name || "—"} · ₹{Number(row.courier_price || 0).toFixed(0)}
                      {" · "}
                      created {new Date(row.created_at).toLocaleString()}
                      {row.created_by_admin_email ? ` by ${row.created_by_admin_email}` : ""}
                    </CardDescription>
                  </div>
                  <div className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                    Link: {row.payment_link_status || "created"}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => handleRefresh(row)} disabled={refreshingId === row.id}>
                    {refreshingId === row.id ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking…</>
                    ) : (
                      <><RefreshCw className="h-4 w-4 mr-2" /> Refresh payment</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setManualDialog({ booking: row }); setManualPaymentId(""); }}
                  >
                    <KeyRound className="h-4 w-4 mr-2" /> Enter payment ID
                  </Button>
                  {!row.prayog_awb && !row.tracking_id && (
                    <Button size="sm" variant="outline" onClick={() => setAwbDialogRow(row)}>
                      <PackagePlus className="h-4 w-4 mr-2" /> Add AWB manually
                    </Button>
                  )}
                  {row.payment_link_url && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(row.payment_link_url!);
                          toast({ title: "Link copied" });
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" /> Copy link
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <a href={row.payment_link_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" /> Open link
                        </a>
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      {/* Confirmed / Booked */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <PackageCheck className="h-5 w-5 text-green-600" /> Booked Shipments ({confirmed.length})
        </h2>
        {loading ? null : confirmed.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              No confirmed assisted bookings yet.
            </CardContent>
          </Card>
        ) : (
          confirmed.map((row) => {
            const awb = row.prayog_awb || row.tracking_id || "";
            return (
              <Card key={row.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <CardTitle className="text-base">
                        {row.sender_name || "—"} → {row.receiver_name || "—"}
                      </CardTitle>
                      <CardDescription className="mt-1 text-xs">
                        {row.sender_city || "?"} → {row.receiver_city || "?"} ·{" "}
                        {row.courier_name || "—"} · ₹{Number(row.courier_price || 0).toFixed(0)}
                        {" · "}
                        AWB <span className="font-mono">{awb}</span>
                        {" · "}
                        {new Date(row.created_at).toLocaleString()}
                      </CardDescription>
                    </div>
                    <div className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-900 border border-green-200">
                      {row.status}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleTrack(row)}
                      disabled={!awb || trackingBusyId === row.id}
                    >
                      {trackingBusyId === row.id ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Tracking…</>
                      ) : (
                        <><Truck className="h-4 w-4 mr-2" /> {tracking[row.id] ? "Hide tracking" : "Track shipment"}</>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadLabel(row)}
                      disabled={labelBusyId === row.id}
                    >
                      {labelBusyId === row.id ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Fetching…</>
                      ) : (
                        <><Download className="h-4 w-4 mr-2" /> Download label</>
                      )}
                    </Button>
                    {awb && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(awb);
                          toast({ title: "AWB copied" });
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" /> Copy AWB
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setAwbDialogRow(row)}>
                      <PackagePlus className="h-4 w-4 mr-2" /> {awb ? "Update AWB / label" : "Add AWB manually"}
                    </Button>
                  </div>

                  {tracking[row.id] && (
                    <div className="mt-4 border-t pt-3">
                      {tracking[row.id].length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No scans yet for this AWB.
                        </p>
                      ) : (
                        <ol className="space-y-3">
                          {tracking[row.id].map((ev, i) => (
                            <li key={i} className="flex gap-3">
                              <div className="flex flex-col items-center">
                                <span
                                  className={`h-2.5 w-2.5 rounded-full mt-1 ${i === 0 ? "bg-primary" : "bg-muted-foreground/40"}`}
                                />
                                {i < tracking[row.id].length - 1 && (
                                  <span className="w-px flex-1 bg-border mt-1" />
                                )}
                              </div>
                              <div className="text-xs">
                                <p className="font-medium">{ev.status}</p>
                                <p className="text-muted-foreground">
                                  {[ev.location, ev.statusTimestamp ? new Date(ev.statusTimestamp).toLocaleString() : ""]
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

                </CardContent>
              </Card>
            );
          })
        )}
      </section>

      <Dialog open={!!manualDialog} onOpenChange={(o) => { if (!o) { setManualDialog(null); setManualPaymentId(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Razorpay payment ID</DialogTitle>
            <DialogDescription>
              Use this when the customer paid but the payment link didn't get flipped to <code>paid</code>.
              We'll fetch the payment from Razorpay and, if captured, place the courier order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pay-id">Payment ID</Label>
            <Input
              id="pay-id"
              placeholder="pay_XXXXXXXXXXXXXX"
              value={manualPaymentId}
              onChange={(e) => setManualPaymentId(e.target.value)}
              disabled={submittingManual}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualDialog(null)} disabled={submittingManual}>
              Cancel
            </Button>
            <Button onClick={handleManualSubmit} disabled={submittingManual || !manualPaymentId.trim()}>
              {submittingManual ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing…</>
              ) : (
                <>Confirm & book</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ManualAwbDialog
        open={!!awbDialogRow}
        onOpenChange={(open) => { if (!open) setAwbDialogRow(null); }}
        booking={awbDialogRow}
        onSuccess={() => { setAwbDialogRow(null); fetchRows(); }}
      />
    </div>
  );
};

export default AssistedPendingBookings;
