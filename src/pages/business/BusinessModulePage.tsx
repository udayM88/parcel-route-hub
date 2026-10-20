import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Building2, Calculator, Database, Info, Loader2, Mail, MapPin, Phone, Search, ShieldCheck, Truck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import PageSeo from "@/components/PageSeo";
import { useBusinessAuth } from "@/contexts/useBusinessAuth";
import { supabase } from "@/integrations/supabase/client";
import { moduleMeta } from "@/components/business/console/merchant-navigation";
import { CURRENT_ENV } from "@/config/environment";
import { computeBusinessBreakdown, computeChargeableKg } from "@/lib/pricing";
import { filterEnabledPartners } from "@/lib/partnerSettings";
import { isBusinessDemoSession } from "@/lib/business-demo";
import BusinessSupportPanel from "@/pages/business/BusinessSupportPanel";
import BusinessFinanceReport from "@/pages/business/BusinessFinanceReport";
import BusinessAnalyticsPanel from "@/pages/business/BusinessAnalyticsPanel";
import BusinessAddressesPanel from "@/pages/business/BusinessAddressesPanel";

type TrackingResult = {
  id: string;
  tracking_id: string | null;
  prayog_awb: string | null;
  status: string | null;
  courier_name: string | null;
  receiver_city: string | null;
  receiver_pincode: string | null;
  created_at: string;
};

type RateQuote = { partner: string; service: string; delivery: string; amount: number };
type ServiceabilityResponse = {
  is_serviceable?: boolean;
  partner?: {
    partner_name?: string;
    services?: Array<{
      service_name?: string;
      delivery_label?: string;
      tat_days?: number;
      rate?: { price?: { amount?: number } };
    }>;
  };
};

const RATE_PARTNERS = [
  { code: "shadowfax", fn: "shadowfax-serviceability" },
  { code: "delhivery", fn: "delhivery-serviceability" },
  { code: "urbanebolt", fn: "urbanebolt-serviceability" },
  { code: "xpressbees", fn: "xpressbees-serviceability" },
  { code: "shree_maruti", fn: "shree-maruti-serviceability" },
];

function RateCalculatorPanel() {
  const isDemo = isBusinessDemoSession();
  const [pickup, setPickup] = useState("");
  const [delivery, setDelivery] = useState("");
  const [weight, setWeight] = useState("");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [loading, setLoading] = useState(false);
  const [quotes, setQuotes] = useState<RateQuote[]>([]);
  const [message, setMessage] = useState("");

  const chargeableKg = computeChargeableKg(Number(weight) || 0, Number(length) || 0, Number(width) || 0, Number(height) || 0).chargeableKg;
  const valid = /^\d{6}$/.test(pickup) && /^\d{6}$/.test(delivery) && Number(weight) > 0;

  const calculate = async () => {
    if (!valid) return;
    setLoading(true);
    setQuotes([]);
    setMessage("");
    try {
      if (isDemo) {
        setQuotes([
          { partner: "Delhivery", service: "Surface", delivery: "3-5 days", amount: 128 },
          { partner: "XpressBees", service: "Standard", delivery: "2-4 days", amount: 142 },
          { partner: "Shadowfax", service: "Express", delivery: "1-3 days", amount: 176 },
        ]);
        return;
      }
      const activePartners = await filterEnabledPartners(RATE_PARTNERS);
      const settled = await Promise.allSettled(activePartners.map(async (partner) => {
        const { data, error } = await supabase.functions.invoke<ServiceabilityResponse>(partner.fn, {
          body: {
            pickup_pincode: pickup,
            delivery_pincode: delivery,
            weight_kg: chargeableKg,
            length_cm: Number(length) || 10,
            width_cm: Number(width) || 10,
            height_cm: Number(height) || 10,
          },
          headers: { "x-environment": CURRENT_ENV },
        });
        if (error || !data?.is_serviceable || !data.partner) return [];
        return (data.partner.services || []).map((service) => {
          const courierRate = Number(service.rate?.price?.amount || 0);
          return {
            partner: data.partner?.partner_name || partner.code,
            service: service.service_name || "Standard",
            delivery: service.delivery_label || (service.tat_days ? `${service.tat_days} days` : "ETA unavailable"),
            amount: computeBusinessBreakdown([courierRate]).total,
          };
        });
      }));
      const available = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []).filter((quote) => quote.amount > 0).sort((a, b) => a.amount - b.amount);
      setQuotes(available);
      if (!available.length) setMessage("No courier service is currently available for this route.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Could not calculate rates. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Card className="merchant-bordered-card">
        <CardHeader><CardTitle className="flex items-center gap-2"><Calculator className="size-5 text-primary" />Shipment details</CardTitle><CardDescription>Rates are estimates and are confirmed again when the order is booked.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Input value={pickup} onChange={(event) => setPickup(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Pickup pincode" inputMode="numeric" />
          <Input value={delivery} onChange={(event) => setDelivery(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Delivery pincode" inputMode="numeric" />
          <Input value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="Dead weight (kg)" type="number" min="0.01" step="0.01" />
          <div className="grid grid-cols-3 gap-2"><Input value={length} onChange={(event) => setLength(event.target.value)} placeholder="L cm" type="number" min="0" /><Input value={width} onChange={(event) => setWidth(event.target.value)} placeholder="W cm" type="number" min="0" /><Input value={height} onChange={(event) => setHeight(event.target.value)} placeholder="H cm" type="number" min="0" /></div>
          <div className="rounded-xl border bg-muted/40 p-3 text-sm sm:col-span-2"><span className="text-muted-foreground">Chargeable weight:</span> <strong>{chargeableKg.toFixed(2)} kg</strong></div>
        </CardContent>
        <CardFooter className="justify-end border-t pt-4"><Button onClick={calculate} disabled={!valid || loading}>{loading ? <Loader2 className="animate-spin" /> : <Calculator />}Calculate rates</Button></CardFooter>
      </Card>
      <Card className="merchant-surface merchant-bordered-card">
        <CardHeader><CardTitle>Available services</CardTitle><CardDescription>{isDemo ? "Safe sample quotes for UI evaluation." : "Merchant prices inclusive of GST."}</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {!quotes.length && !message ? <div className="grid min-h-52 place-items-center text-center text-sm text-muted-foreground"><div><Truck className="mx-auto mb-3 size-9 text-primary/60" />Fill the form to compare courier services.</div></div> : null}
          {message ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{message}</p> : null}
          {quotes.map((quote, index) => <div key={`${quote.partner}-${quote.service}`} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3"><div><p className="font-bold">{quote.partner}</p><p className="text-xs text-muted-foreground">{quote.service} · {quote.delivery}</p></div><div className="text-right"><p className="font-extrabold">₹{quote.amount.toLocaleString("en-IN")}</p>{index === 0 ? <Badge variant="secondary">Best price</Badge> : null}</div></div>)}
        </CardContent>
      </Card>
    </div>
  );
}

export default function BusinessModulePage() {
  const { module = "" } = useParams();
  const navigate = useNavigate();
  const { business } = useBusinessAuth();
  const isDemo = isBusinessDemoSession();
  const meta = moduleMeta[module] || { title: "Merchant Module", description: "This merchant workspace is being connected safely.", icon: Database };
  const Icon = meta.icon;
  const [tracking, setTracking] = useState("");
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingResult, setTrackingResult] = useState<TrackingResult | null | undefined>(undefined);

  const availableNow = useMemo(() => ["profile", "support"].includes(module), [module]);

  const findShipment = async () => {
    const value = tracking.trim();
    if (!value || !business) return;
    setTrackingLoading(true);
    if (isDemo) {
      setTrackingResult(value.toLowerCase().includes("missing") ? null : {
        id: "demo-tracking",
        tracking_id: value,
        prayog_awb: null,
        status: "in_transit",
        courier_name: "Delhivery",
        receiver_city: "Bengaluru",
        receiver_pincode: "560001",
        created_at: "2026-10-20T08:30:00.000Z",
      });
      setTrackingLoading(false);
      return;
    }
    const columns = "id,tracking_id,prayog_awb,status,courier_name,receiver_city,receiver_pincode,created_at";
    let result = await supabase.from("bookings").select(columns).eq("business_account_id", business.id).eq("tracking_id", value).maybeSingle();
    if (!result.data && !result.error) {
      result = await supabase.from("bookings").select(columns).eq("business_account_id", business.id).eq("prayog_awb", value).maybeSingle();
    }
    setTrackingResult((result.data as TrackingResult | null) ?? null);
    setTrackingLoading(false);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageSeo title={`${meta.title} | ViaSetu Merchant Console`} description={meta.description} path={`/viasetuforbusinesses/module/${module}`} />
      <div className="flex items-start gap-4">
        <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground"><Icon className="size-6" /></div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{meta.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{meta.description}</p>
        </div>
      </div>

      {module === "support" ? <BusinessSupportPanel /> : module === "addresses" ? <BusinessAddressesPanel /> : module === "analytics" ? <BusinessAnalyticsPanel /> : ["transactions", "recharge-management", "billing-statements"].includes(module) ? (
        <BusinessFinanceReport mode={module as "transactions" | "recharge-management" | "billing-statements"} />
      ) : module === "rate-calculator" ? <RateCalculatorPanel /> : module === "tracking" ? (
        <Card>
          <CardHeader>
            <CardTitle>Track your shipment</CardTitle>
            <CardDescription>Searches only shipments owned by this merchant account.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Input value={tracking} onChange={(event) => setTracking(event.target.value)} onKeyDown={(event) => event.key === "Enter" && findShipment()} placeholder="Enter AWB or tracking ID" aria-label="AWB or tracking ID" />
            <Button onClick={findShipment} disabled={!tracking.trim() || trackingLoading}>
              {trackingLoading ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Search data-icon="inline-start" />}
              Track shipment
            </Button>
          </CardContent>
          {trackingResult !== undefined ? (
            <CardFooter className="border-t pt-5">
              {trackingResult ? (
                <div className="grid w-full gap-3 sm:grid-cols-4">
                  <div><p className="text-xs text-muted-foreground">AWB</p><p className="mt-1 text-sm font-bold">{trackingResult.tracking_id || trackingResult.prayog_awb || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Courier</p><p className="mt-1 text-sm font-bold">{trackingResult.courier_name || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Destination</p><p className="mt-1 text-sm font-bold">{trackingResult.receiver_city || "—"} {trackingResult.receiver_pincode || ""}</p></div>
                  <div><p className="text-xs text-muted-foreground">Status</p><Badge variant="secondary" className="mt-1">{trackingResult.status || "Created"}</Badge></div>
                </div>
              ) : <p className="text-sm text-muted-foreground">No shipment was found for this merchant account.</p>}
            </CardFooter>
          ) : null}
        </Card>
      ) : module === "profile" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="merchant-bordered-card">
            <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="size-5 text-primary" />Business profile</CardTitle><CardDescription>Verified merchant identity attached to the current authenticated account.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {[
                ["Company", business?.company_name, Building2],
                ["Contact person", business?.contact_person, ShieldCheck],
                ["Email", business?.email, Mail],
                ["Phone", business?.phone, Phone],
                ["GST number", business?.gst_number || "Not provided", Database],
                ["PAN number", business?.pan_number || "Not provided", Database],
              ].map(([label, value, DetailIcon]) => {
                const RowIcon = DetailIcon as typeof Building2;
                return <div key={String(label)} className="flex items-start gap-3 rounded-xl border bg-card p-4"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-primary"><RowIcon className="size-4" /></span><div><p className="text-xs text-muted-foreground">{String(label)}</p><p className="mt-1 break-all text-sm font-bold">{String(value || "—")}</p></div></div>;
              })}
            </CardContent>
          </Card>
          <Card className="merchant-surface merchant-bordered-card">
            <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="size-5 text-primary" />Registered address</CardTitle></CardHeader>
            <CardContent><p className="text-sm font-semibold leading-6">{business?.address || "No address added"}</p><p className="mt-1 text-sm text-muted-foreground">{[business?.city, business?.state, business?.pincode].filter(Boolean).join(", ") || "Address details pending"}</p></CardContent>
            <CardFooter className="border-t pt-4"><Badge variant={business?.status === "approved" ? "default" : "secondary"}>{business?.status === "approved" ? "KYC approved" : business?.status || "Pending"}</Badge></CardFooter>
          </Card>
        </div>
      ) : (
        <>
          <Alert>
            <Info />
            <AlertTitle>{availableNow ? "Account data remains protected" : "UI ready; backend activation is gated"}</AlertTitle>
            <AlertDescription>
              {availableNow
                ? "This screen is inside the existing authenticated merchant scope and does not expose another merchant's data."
                : "The screen is available in the merchant console, but write actions stay disabled until its schema, RLS and server-side workflow are reviewed and migrated safely."}
            </AlertDescription>
          </Alert>
          <Card>
            <CardHeader>
              <CardTitle>Safe rollout status</CardTitle>
              <CardDescription>No production table, policy or Edge Function was changed to display this module.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {["Existing merchant login reused", "Business-scoped routes", "No mock records written"].map((label) => (
                <div key={label} className="rounded-xl border bg-muted/30 p-4 text-sm font-semibold">{label}</div>
              ))}
            </CardContent>
            <CardFooter className="justify-end border-t pt-4">
              <Button variant="outline" onClick={() => navigate("/viasetuforbusinesses/dashboard")}>Back to dashboard <ArrowRight data-icon="inline-end" /></Button>
            </CardFooter>
          </Card>
        </>
      )}
    </div>
  );
}
