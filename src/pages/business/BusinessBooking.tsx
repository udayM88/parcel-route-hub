import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Boxes, Loader2, Plus, Trash2, Truck, CheckCircle2, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBusinessAuth } from "@/contexts/useBusinessAuth";
import PageSeo from "@/components/PageSeo";
import PaymentModal from "@/components/PaymentModal";
import PincodeSwapButton from "@/components/booking/PincodeSwapButton";
import AddressAutocomplete from "@/components/booking/AddressAutocomplete";
import DisclaimerStep from "@/components/booking/DisclaimerStep";
import { CURRENT_ENV } from "@/config/environment";
import { computeBusinessBreakdown, computeChargeableKg } from "@/lib/pricing";

const DIRECT_PARTNERS = [
  { code: "shadowfax", name: "Shadowfax", fn: "shadowfax-serviceability" },
  { code: "delhivery", name: "Delhivery", fn: "delhivery-serviceability" },
  { code: "urbanebolt", name: "UrbaneBolt", fn: "urbanebolt-serviceability" },
  { code: "xpressbees", name: "XpressBees", fn: "xpressbees-serviceability" },
  { code: "shree_maruti", name: "Shree Maruti Courier", fn: "shree-maruti-serviceability" },
];

type Box = { weightG: string; length: string; width: string; height: string };
type Party = {
  name: string; phone: string; address: string; city: string; state: string; pincode: string;
};
type Quote = {
  partnerId: string;
  partnerCode: string;
  partnerName: string;
  serviceCode: string;
  serviceName: string;
  deliveryTime: string;
  boxRates: number[];
  totalPrice: number;
};

const emptyParty: Party = { name: "", phone: "", address: "", city: "", state: "", pincode: "" };
const emptyBox: Box = { weightG: "", length: "", width: "", height: "" };

const STEPS = ["Shipment", "Courier", "Addresses", "Pay"];

const BusinessBooking = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { business } = useBusinessAuth();

  const [step, setStep] = useState(1);
  const [pickupPincode, setPickupPincode] = useState("");
  const [deliveryPincode, setDeliveryPincode] = useState("");
  const [sender, setSender] = useState<Party>({ ...emptyParty });
  const [receiver, setReceiver] = useState<Party>({ ...emptyParty });
  const [goodsType, setGoodsType] = useState("Package");
  const [shipmentValue, setShipmentValue] = useState("");
  const [boxes, setBoxes] = useState<Box[]>([{ ...emptyBox }]);

  const [fetching, setFetching] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selected, setSelected] = useState<Quote | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ bookingId: string; boxes: any[] } | null>(null);

  const chargeableKgs = useMemo(
    () =>
      boxes.map((b) => {
        const kg = (parseFloat(b.weightG) || 0) / 1000;
        return computeChargeableKg(kg, b.length, b.width, b.height).chargeableKg || kg;
      }),
    [boxes],
  );

  const updateBox = (i: number, field: keyof Box, value: string) =>
    setBoxes((prev) => prev.map((b, idx) => (idx === i ? { ...b, [field]: value } : b)));

  // Changing shipment inputs invalidates previously fetched rates.
  const resetQuotes = () => {
    setQuotes([]);
    setSelected(null);
  };

  const addressValid = (p: Party) =>
    p.name.trim() && /^\d{10}$/.test(p.phone.replace(/\D/g, "")) && p.address.trim() &&
    p.city.trim() && p.state.trim();

  const boxesValid = boxes.every((_, i) => chargeableKgs[i] > 0);
  const canQuote =
    /^\d{6}$/.test(pickupPincode) && /^\d{6}$/.test(deliveryPincode) && boxesValid;
  const canContinueAddresses = addressValid(sender) && addressValid(receiver);

  const breakdown = useMemo(
    () => computeBusinessBreakdown(selected?.boxRates ?? []),
    [selected],
  );

  const fetchQuotes = async () => {
    if (!canQuote) {
      toast({ title: "Complete shipment details", description: "Both pincodes and every box weight are required.", variant: "destructive" });
      return;
    }
    setFetching(true);
    resetQuotes();
    try {
      // Quote every box with every partner; only keep partner+service combos
      // that are serviceable for ALL boxes.
      const perBoxResults = await Promise.all(
        boxes.map(async (b, i) => {
          const payload = {
            pickup_pincode: pickupPincode,
            delivery_pincode: deliveryPincode,
            weight_kg: chargeableKgs[i],
            length_cm: parseFloat(b.length) || 10,
            width_cm: parseFloat(b.width) || 10,
            height_cm: parseFloat(b.height) || 10,
          };
          const settled = await Promise.allSettled(
            DIRECT_PARTNERS.map((p) =>
              supabase.functions
                .invoke(p.fn, { body: payload, headers: { "x-environment": CURRENT_ENV } })
                .then((res) => ({ res, meta: p })),
            ),
          );
          const map = new Map<string, { partner: any; service: any }>();
          settled.forEach((s, idx) => {
            const meta = DIRECT_PARTNERS[idx];
            if (s.status !== "fulfilled") return;
            const { data, error } = (s.value as any).res;
            if (error || !data?.is_serviceable || !data?.partner) return;
            (data.partner.services || []).forEach((svc: any) => {
              map.set(`${meta.code}::${svc.service_code}`, { partner: data.partner, service: svc });
            });
          });
          return map;
        }),
      );

      const first = perBoxResults[0];
      const combos: Quote[] = [];
      first.forEach((entry, key) => {
        const rates: number[] = [];
        for (const m of perBoxResults) {
          const hit = m.get(key);
          if (!hit) return;
          rates.push(Math.round(hit.service.rate?.price?.amount || 0));
        }
        combos.push({
          partnerId: entry.partner.partner_id,
          partnerCode: entry.partner.partner_code,
          partnerName: entry.partner.partner_name,
          serviceCode: entry.service.service_code,
          serviceName: entry.service.service_name || "Standard",
          deliveryTime:
            entry.service.delivery_label ||
            (entry.service.tat_days ? `${entry.service.tat_days} days` : "2-5 days"),
          boxRates: rates,
          totalPrice: computeBusinessBreakdown(rates).total,
        });
      });

      combos.sort((a, b) => a.totalPrice - b.totalPrice);
      setQuotes(combos);
      if (combos.length === 0) {
        toast({ title: "No courier available", description: "No partner serves all boxes on this route.", variant: "destructive" });
      } else {
        setStep(2);
      }
    } catch (e: any) {
      toast({ title: "Could not fetch rates", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setFetching(false);
    }
  };

  const handlePaymentSuccess = async (
    _method: string,
    details?: { razorpay_payment_id: string; razorpay_order_id: string },
  ) => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("business-create-shipment", {
        body: {
          sender_name: sender.name,
          sender_phone: sender.phone.replace(/\D/g, "").slice(-10),
          sender_address: sender.address,
          sender_city: sender.city,
          sender_state: sender.state,
          sender_pincode: pickupPincode,
          receiver_name: receiver.name,
          receiver_phone: receiver.phone.replace(/\D/g, "").slice(-10),
          receiver_address: receiver.address,
          receiver_city: receiver.city,
          receiver_state: receiver.state,
          receiver_pincode: deliveryPincode,
          goods_type: goodsType || "Package",
          shipment_value: shipmentValue ? Number(shipmentValue) : null,
          urgency: "standard",
          partner_id: selected.partnerId,
          service_code: selected.serviceCode,
          courier_name: selected.partnerName,
          delivery_time: selected.deliveryTime,
          payment_id: details?.razorpay_payment_id || null,
          boxes: boxes.map((b, i) => ({
            weight_kg: chargeableKgs[i],
            length_cm: parseFloat(b.length) || null,
            width_cm: parseFloat(b.width) || null,
            height_cm: parseFloat(b.height) || null,
            courier_rate: selected.boxRates[i],
          })),
        },
        headers: { "x-environment": CURRENT_ENV },
      });

      if (error || data?.error) throw new Error(error?.message || data?.error);

      setShowPayment(false);
      setResult({ bookingId: data.booking_id, boxes: data.boxes || [] });
      toast({
        title: "Shipment booked",
        description: `${data.booked_count} of ${boxes.length} boxes booked successfully.`,
      });
    } catch (e: any) {
      toast({ title: "Booking failed", description: e?.message || "Please contact support.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const partyFields = (label: string, p: Party, set: (p: Party) => void, pincode: string) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{label}</CardTitle>
        <CardDescription>Pincode {pincode}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Name</Label>
          <Input value={p.name} onChange={(e) => set({ ...p, name: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Phone (10 digits)</Label>
          <Input value={p.phone} maxLength={10} onChange={(e) => set({ ...p, phone: e.target.value.replace(/\D/g, "") })} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Address</Label>
          <Input value={p.address} onChange={(e) => set({ ...p, address: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>City</Label>
          <Input value={p.city} onChange={(e) => set({ ...p, city: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>State</Label>
          <Input value={p.state} onChange={(e) => set({ ...p, state: e.target.value })} />
        </div>
      </CardContent>
    </Card>
  );

  if (result) {
    return (
      <div className="min-h-screen bg-muted/30">
        <PageSeo title="Shipment Booked | ViaSetu for Businesses" description="Business shipment confirmation." path="/viasetuforbusinesses/book" />
        <main className="max-w-3xl mx-auto p-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" /> Shipment booked
              </CardTitle>
              <CardDescription>Print the labels for each box before pickup.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.boxes.map((b: any) => (
                <div key={b.box_index} className="flex items-center justify-between border rounded-lg p-3 gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">Box {b.box_index}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {b.success ? `AWB ${b.tracking_id}` : b.error || "Failed"}
                    </p>
                  </div>
                  {b.label_url ? (
                    <Button size="sm" variant="outline" asChild>
                      <a href={b.label_url} target="_blank" rel="noreferrer">Label</a>
                    </Button>
                  ) : (
                    <Badge variant={b.success ? "secondary" : "destructive"}>{b.success ? "Booked" : "Failed"}</Badge>
                  )}
                </div>
              ))}
              <Button className="w-full" onClick={() => navigate("/viasetuforbusinesses/dashboard")}>
                Back to dashboard
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <PageSeo
        title="New Business Shipment | ViaSetu for Businesses"
        description="Book multi-box business shipments with live courier rates, inclusive of GST."
        path="/viasetuforbusinesses/book"
      />
      <header className="bg-background border-b sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => (step > 1 ? setStep(step - 1) : navigate("/viasetuforbusinesses/dashboard"))}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-bold truncate">New Shipment</h1>
            <p className="text-xs text-muted-foreground truncate">{business?.company_name}</p>
          </div>
        </div>
        <div className="max-w-4xl mx-auto flex items-center gap-2 px-4 pb-3">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`h-7 w-7 shrink-0 rounded-full grid place-items-center text-xs font-semibold ${
                  step > i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              <span className={`text-xs truncate ${step === i + 1 ? "font-medium" : "text-muted-foreground"}`}>{s}</span>
            </div>
          ))}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4 pb-24">
        {step === 1 && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Route</CardTitle>
                <CardDescription>We check live partner serviceability and rates for these pincodes.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Pickup pincode</Label>
                  <Input
                    value={pickupPincode}
                    maxLength={6}
                    inputMode="numeric"
                    onChange={(e) => { setPickupPincode(e.target.value.replace(/\D/g, "")); resetQuotes(); }}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Delivery pincode</Label>
                  <Input
                    value={deliveryPincode}
                    maxLength={6}
                    inputMode="numeric"
                    onChange={(e) => { setDeliveryPincode(e.target.value.replace(/\D/g, "")); resetQuotes(); }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Boxes className="h-4 w-4" /> Boxes ({boxes.length})
                </CardTitle>
                <CardDescription>All boxes ship to the same delivery pincode. Each box gets its own AWB.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Goods type</Label>
                    <Input value={goodsType} onChange={(e) => setGoodsType(e.target.value)} placeholder="e.g. Apparel" />
                  </div>
                  <div className="space-y-1">
                    <Label>Shipment value (₹)</Label>
                    <Input value={shipmentValue} onChange={(e) => setShipmentValue(e.target.value.replace(/\D/g, ""))} />
                  </div>
                </div>
                <Separator />
                {boxes.map((b, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Box {i + 1}</p>
                      <div className="flex items-center gap-2">
                        {chargeableKgs[i] > 0 && (
                          <Badge variant="secondary">{chargeableKgs[i]} kg chargeable</Badge>
                        )}
                        {boxes.length > 1 && (
                          <Button size="icon" variant="ghost" onClick={() => { setBoxes((p) => p.filter((_, idx) => idx !== i)); resetQuotes(); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Weight (g)</Label>
                        <Input value={b.weightG} inputMode="numeric" onChange={(e) => { updateBox(i, "weightG", e.target.value.replace(/\D/g, "")); resetQuotes(); }} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">L (cm)</Label>
                        <Input value={b.length} inputMode="decimal" onChange={(e) => { updateBox(i, "length", e.target.value.replace(/[^\d.]/g, "")); resetQuotes(); }} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">W (cm)</Label>
                        <Input value={b.width} inputMode="decimal" onChange={(e) => { updateBox(i, "width", e.target.value.replace(/[^\d.]/g, "")); resetQuotes(); }} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">H (cm)</Label>
                        <Input value={b.height} inputMode="decimal" onChange={(e) => { updateBox(i, "height", e.target.value.replace(/[^\d.]/g, "")); resetQuotes(); }} />
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full" onClick={() => { setBoxes((p) => [...p, { ...emptyBox }]); resetQuotes(); }}>
                  <Plus className="h-4 w-4 mr-1" /> Add box
                </Button>
              </CardContent>
            </Card>

            <Button className="w-full" size="lg" disabled={!canQuote || fetching} onClick={fetchQuotes}>
              {fetching ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Fetching live rates...</> : "Get courier rates"}
            </Button>
          </>
        )}

        {step === 2 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-4 w-4" /> Available couriers
              </CardTitle>
              <CardDescription>
                {pickupPincode} → {deliveryPincode} · {boxes.length} box{boxes.length > 1 ? "es" : ""} · prices include GST
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {quotes.map((q) => {
                const active = selected?.partnerId === q.partnerId && selected?.serviceCode === q.serviceCode;
                return (
                  <button
                    key={`${q.partnerId}-${q.serviceCode}`}
                    onClick={() => setSelected(q)}
                    className={`w-full text-left border rounded-lg p-3 transition-colors ${active ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{q.partnerName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {q.serviceName} · {q.deliveryTime}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold">₹{q.totalPrice}</p>
                        <p className="text-[11px] text-muted-foreground">incl. GST</p>
                      </div>
                    </div>
                  </button>
                );
              })}
              <Button className="w-full mt-2" size="lg" disabled={!selected} onClick={() => setStep(3)}>
                Continue
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <>
            {partyFields("Pickup (Sender)", sender, setSender, pickupPincode)}
            {partyFields("Delivery (Receiver)", receiver, setReceiver, deliveryPincode)}
            <Button className="w-full" size="lg" disabled={!canContinueAddresses} onClick={() => setStep(4)}>
              Review & pay
            </Button>
          </>
        )}

        {step === 4 && selected && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Review</CardTitle>
              <CardDescription>
                {selected.partnerName} · {selected.serviceName} · {boxes.length} box{boxes.length > 1 ? "es" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Shipping charges</span><span>₹{breakdown.net}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">GST (18%)</span><span>₹{breakdown.gst}</span></div>
              <Separator className="my-2" />
              <div className="flex justify-between font-bold text-base"><span>Total payable</span><span>₹{breakdown.total}</span></div>
              <Button className="w-full mt-3" size="lg" disabled={submitting} onClick={() => setShowPayment(true)}>
                {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Booking...</> : `Pay ₹${breakdown.total} & book`}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      {selected && (
        <PaymentModal
          isOpen={showPayment}
          onClose={() => setShowPayment(false)}
          orderDetails={{
            courierId: selected.serviceCode,
            courierName: selected.partnerName,
            baseFare: breakdown.net,
            gstAmount: breakdown.gst,
            totalAmount: breakdown.total,
          }}
          customerDetails={{
            name: business?.contact_person,
            phone: business?.phone,
            email: business?.email,
          }}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};

export default BusinessBooking;
