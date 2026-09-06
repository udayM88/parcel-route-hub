import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Package, MapPin, Clock, Phone, CheckCircle, Truck, Calendar, Search, Ban, Info } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { CURRENT_ENV } from "@/config/environment";
import { supabase } from "@/integrations/supabase/client";
import { getAuthSession } from "@/lib/auth";
import TrackingSearchIllustration from "@/components/illustrations/TrackingSearchIllustration";
import PageBackground from "@/components/PageBackground";
import PageSeo from "@/components/PageSeo";
import { isCancellable } from "@/hooks/useCancelOrder";
import BottomNav from "@/components/BottomNav";

interface TrackingStatus {
  trackingId: string;
  status: string;
  location?: string;
  deliveryPartnerName: string;
  statusTimestamp: number;
  event: string;
  category: string;
  subcategory: string;
  createdAt: string;
}

interface LocationInfo {
  address: string;
  city: string;
  landmark: string;
  pincode: string;
  state: string;
}

interface TrackingData {
  orderInformation: {
    trackingId: string;
    cAwbNumber: string;
    orderId: string;
    sourceLocation: LocationInfo;
    destinationLocation: LocationInfo;
    senderDetails: {
      sender_mobile: string;
      sender_name: string;
    };
    receiverDetails: {
      receiver_mobile: string;
      receiver_name: string;
    };
    travelType: string;
    serviceType: string;
    bookingDate: string;
    type: string;
  };
  statuses: TrackingStatus[];
}

const Tracking = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { awbNumber: initialAwbNumber } = location.state || {};
  
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [awbInput, setAwbInput] = useState(initialAwbNumber || "");
  const [currentAwb, setCurrentAwb] = useState(initialAwbNumber || "");
  const [bookingMeta, setBookingMeta] = useState<{ id: string; booking_source: string; status: string; orderId: string; awb?: string | null } | null>(null);
  const [universalCandidates, setUniversalCandidates] = useState<Array<{ partner: string; label: string; data: TrackingData }>>([]);
  const [universalSource, setUniversalSource] = useState<string | null>(null);
  const [universalNoMatch, setUniversalNoMatch] = useState(false);


  useEffect(() => {
    if (initialAwbNumber) {
      setCurrentAwb(initialAwbNumber);
      fetchTrackingData(initialAwbNumber);
    }
  }, [initialAwbNumber]);

  const handleTrack = () => {
    if (!awbInput.trim()) {
      toast({
        title: "Error",
        description: "Please enter an AWB number",
        variant: "destructive",
      });
      return;
    }
    setCurrentAwb(awbInput.trim());
    fetchTrackingData(awbInput.trim());
  };

  const fetchTrackingData = async (awb: string) => {
    setLoading(true);
    setTrackingData(null);
    setUniversalCandidates([]);
    setUniversalSource(null);
    setUniversalNoMatch(false);

    try {
      // Lookup booking via authenticated edge function (no client-side RLS issues)
      const auth = getAuthSession();
      let bSource = '';
      let bookingRow: any = null;
      if (auth) {
        const { data: detail } = await supabase.functions.invoke('get-booking-detail', {
          body: { order_id: awb },
          headers: { 'x-prayog-auth': JSON.stringify(auth) },
        });
        bookingRow = detail?.order?._booking || null;
        bSource = bookingRow?.booking_source || '';
        if (bookingRow) {
          setBookingMeta({
            id: bookingRow.id,
            booking_source: bSource,
            status: bookingRow.status || '',
            orderId: bookingRow.prayog_order_id || awb,
            awb: bookingRow.awb || bookingRow.prayog_awb || bookingRow.tracking_id || null,
          });
        } else {
          setBookingMeta(null);
        }
      }

      const isShadowfax = bSource === 'shadowfax_direct';
      const isDelhiveryDirect = bSource === 'delhivery_direct';
      const isUrbanebolt = bSource === 'urbanebolt_direct';
      const isXpressbees = bSource === 'xpressbees_direct';
      const isShreeMaruti = bSource === 'shree_maruti_direct';

      let partnerData: TrackingData | null = null;

      if (isShadowfax) {
        const trackAwb = bookingRow?.prayog_awb || bookingRow?.tracking_id || awb;
        const { data: sfxData, error: sfxError } = await supabase.functions.invoke('shadowfax-tracking', {
          body: { client_request_id: trackAwb, awb: trackAwb, order_id: bookingRow?.prayog_order_id || awb },
          headers: { 'x-environment': CURRENT_ENV },
        });
        if (sfxError || !sfxData) throw new Error('Failed to fetch Shadowfax tracking');
        partnerData = sfxData;
      } else if (isDelhiveryDirect) {
        const trackAwb = bookingRow?.prayog_awb || bookingRow?.tracking_id || awb;
        const { data: dlvData, error: dlvError } = await supabase.functions.invoke('delhivery-tracking', {
          body: { waybill: trackAwb },
          headers: { 'x-environment': CURRENT_ENV },
        });
        if (dlvError || !dlvData || dlvData.error) throw new Error('Failed to fetch Delhivery tracking');
        partnerData = dlvData;
      } else if (isUrbanebolt) {
        const trackAwb = bookingRow?.prayog_awb || bookingRow?.tracking_id || awb;
        const { data: ubData, error: ubError } = await supabase.functions.invoke('urbanebolt-tracking', {
          body: { waybill: trackAwb },
          headers: { 'x-environment': CURRENT_ENV },
        });
        if (ubError || !ubData || ubData.error) throw new Error('Failed to fetch Urbanebolt tracking');
        partnerData = ubData;
      } else if (isXpressbees) {
        const trackAwb = bookingRow?.prayog_awb || bookingRow?.tracking_id || awb;
        const { data: xbData, error: xbError } = await supabase.functions.invoke('xpressbees-tracking', {
          body: { waybill: trackAwb },
          headers: { 'x-environment': CURRENT_ENV },
        });
        if (xbError || !xbData || xbData.error) throw new Error('Failed to fetch XpressBees tracking');
        partnerData = xbData;
      } else if (isShreeMaruti) {
        const trackAwb = bookingRow?.prayog_awb || bookingRow?.tracking_id || awb;
        const { data: smData, error: smError } = await supabase.functions.invoke('shree-maruti-tracking', {
          body: { waybill: trackAwb, order_id: bookingRow?.prayog_order_id || awb },
          headers: { 'x-environment': CURRENT_ENV },
        });
        if (smError || !smData || smData.error) throw new Error('Failed to fetch Shree Maruti tracking');
        partnerData = smData;
      } else {
        // Universal mode — no booking row in our DB. Fan out to all 5 partner
        // tracking APIs and surface whichever returns event data.
        const partners: Array<{ key: string; label: string; fn: string; body: Record<string, unknown> }> = [
          { key: 'delhivery',    label: 'Delhivery',    fn: 'delhivery-tracking',    body: { waybill: awb } },
          { key: 'urbanebolt',   label: 'Urbanebolt',   fn: 'urbanebolt-tracking',   body: { waybill: awb } },
          { key: 'shree_maruti', label: 'Shree Maruti', fn: 'shree-maruti-tracking', body: { waybill: awb, order_id: awb } },
          { key: 'xpressbees',   label: 'XpressBees',   fn: 'xpressbees-tracking',   body: { waybill: awb } },
          { key: 'shadowfax',    label: 'Shadowfax',    fn: 'shadowfax-tracking',    body: { client_request_id: awb, awb, order_id: awb } },
        ];
        const settled = await Promise.allSettled(
          partners.map((p) =>
            supabase.functions.invoke(p.fn, {
              body: p.body,
              headers: { 'x-environment': CURRENT_ENV },
            })
          )
        );
        const hits: Array<{ partner: string; label: string; data: TrackingData }> = [];
        settled.forEach((res, idx) => {
          if (res.status !== 'fulfilled') return;
          const d: any = (res.value as any)?.data;
          if (d && !d.error && Array.isArray(d.statuses) && d.statuses.length > 0) {
            hits.push({ partner: partners[idx].key, label: partners[idx].label, data: d as TrackingData });
          }
        });

        if (hits.length === 0) {
          setUniversalNoMatch(true);
          return;
        }
        if (hits.length === 1) {
          setUniversalSource(hits[0].label);
          setTrackingData(hits[0].data);
          return;
        }
        // >1 hits — let the user disambiguate.
        setUniversalCandidates(hits);
        return;
      }

      // If the booking is cancelled in our DB, prepend a CANCELLED status so
      // the UI reflects the cancellation regardless of what the partner
      // tracking API returns (some partners keep returning the last in-transit
      // event for a while after cancellation).
      if (partnerData && bookingRow) {
        const bookingStatus = String(bookingRow.status || '').toLowerCase();
        if (bookingStatus === 'cancelled' || bookingStatus === 'canceled') {
          const cancelTs = bookingRow.updated_at
            ? new Date(bookingRow.updated_at).getTime()
            : Date.now();
          const cancelEntry: TrackingStatus = {
            trackingId: awb,
            status: 'Cancelled',
            location: '',
            deliveryPartnerName: partnerData.statuses?.[0]?.deliveryPartnerName || '',
            statusTimestamp: cancelTs,
            event: bookingRow.refund_reason || 'Order Cancelled',
            category: 'CANCELLED',
            subcategory: bookingRow.refund_reason || 'Order Cancelled',
            createdAt: new Date(cancelTs).toISOString(),
          };
          // Drop any partner statuses with timestamps after the cancellation,
          // and ensure the cancellation entry is the latest.
          const filtered = (partnerData.statuses || []).filter(
            (s) => s.statusTimestamp <= cancelTs && s.category !== 'CANCELLED'
          );
          partnerData = {
            ...partnerData,
            statuses: [cancelEntry, ...filtered],
          };
        }
      }

      // Merge address/contact info from booking row — partner tracking APIs
      // typically return only event history, not sender/receiver details.
      if (partnerData && bookingRow) {
        const oi = (partnerData.orderInformation || {}) as any;
        const src = oi.sourceLocation || {};
        const dst = oi.destinationLocation || {};
        const snd = oi.senderDetails || {};
        const rcv = oi.receiverDetails || {};
        partnerData = {
          ...partnerData,
          orderInformation: {
            ...oi,
            sourceLocation: {
              address: src.address || bookingRow.sender_address || '',
              city: src.city || bookingRow.sender_city || '',
              landmark: src.landmark || '',
              pincode: src.pincode || bookingRow.sender_pincode || '',
              state: src.state || bookingRow.sender_state || '',
            },
            destinationLocation: {
              address: dst.address || bookingRow.receiver_address || '',
              city: dst.city || bookingRow.receiver_city || '',
              landmark: dst.landmark || '',
              pincode: dst.pincode || bookingRow.receiver_pincode || '',
              state: dst.state || bookingRow.receiver_state || '',
            },
            senderDetails: {
              sender_name: snd.sender_name || bookingRow.sender_name || '',
              sender_mobile: snd.sender_mobile || bookingRow.sender_phone || '',
            },
            receiverDetails: {
              receiver_name: rcv.receiver_name || bookingRow.receiver_name || '',
              receiver_mobile: rcv.receiver_mobile || bookingRow.receiver_phone || '',
            },
            bookingDate: oi.bookingDate || bookingRow.created_at || new Date().toISOString(),
          },
        };
      }
      setTrackingData(partnerData);
    } catch (error: any) {
      console.error("Error fetching tracking:", error);
      toast({
        title: "Error",
        description: "Failed to load tracking information. Please check the AWB number.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const categoryUpper = category?.toUpperCase() || '';
    switch (categoryUpper) {
      case 'DELIVERED':
        return 'bg-green-500';
      case 'OUT_FOR_DELIVERY':
        return 'bg-blue-500';
      case 'IN_TRANSIT':
      case 'INTRANSIT':
        return 'bg-indigo-500';
      case 'READY_FOR_DISPATCH':
        return 'bg-orange-500';
      case 'ORDER_CONFIRMED':
        return 'bg-primary';
      case 'CANCELLED':
      case 'RTO':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Show search form when no tracking data
  if (!trackingData) {
    return (
      <div className="min-h-screen relative pb-24 xl:pb-4">
        <PageBackground variant="logistics" opacity={0.75} />
        
        <header className="bg-white/10 backdrop-blur-xl border-b border-white/20 p-4 sticky top-0 z-50">
          <div className="flex items-center gap-3 max-w-4xl mx-auto">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="text-white hover:bg-white/10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-white">Track Order</h1>
          </div>
        </header>
        <BottomNav />
        
        <div className="p-4 max-w-4xl mx-auto space-y-6 relative z-10">
          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Search className="h-5 w-5 text-primary" />
                Track Your Shipment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TrackingSearchIllustration className="my-4" />
              <p className="text-sm text-white/70 text-center">
                Enter your AWB (Air Waybill) number to track your shipment in real-time
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter AWB Number"
                  value={awbInput}
                  onChange={(e) => setAwbInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
                  className="flex-1 bg-white/20 border-white/30 text-white placeholder:text-white/50"
                />
                <Button onClick={handleTrack} disabled={loading}>
                  {loading ? "Tracking..." : "Track"}
                </Button>
              </div>
              <div className="rounded-md border border-white/20 bg-white/5 p-2.5 flex gap-2">
                <Info className="h-4 w-4 text-white/70 shrink-0 mt-0.5" />
                <p className="text-xs text-white/70 leading-snug">
                  Track shipments from any of our partner networks — Delhivery, XpressBees, Shadowfax, Shree Maruti and Urbanebolt — even if you didn't book through ViaSetu.
                  <span className="block mt-1 text-white/50">Note: XpressBees and Shadowfax only return data for shipments on ViaSetu's account; 3rd-party AWBs from those carriers may not be found here.</span>
                </p>
              </div>
            </CardContent>
          </Card>

          {universalNoMatch && !loading && (
            <Card className="bg-white/10 backdrop-blur-xl border-amber-300/40">
              <CardContent className="p-6 text-center space-y-2">
                <Package className="h-10 w-10 mx-auto text-amber-300" />
                <h3 className="font-semibold text-white">AWB not found</h3>
                <p className="text-sm text-white/70">
                  We couldn't find <span className="font-mono text-white">{currentAwb}</span> on any of our partner networks (Delhivery, XpressBees, Shadowfax, Shree Maruti, Urbanebolt). Double-check the number, or contact the courier directly.
                </p>
              </CardContent>
            </Card>
          )}

          {universalCandidates.length > 1 && !loading && (
            <Card className="bg-white/10 backdrop-blur-xl border-white/20">
              <CardHeader>
                <CardTitle className="text-white text-base">Found on multiple networks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-white/70 mb-2">Which courier did you ship with?</p>
                {universalCandidates.map((c) => (
                  <Button
                    key={c.partner}
                    variant="outline"
                    className="w-full justify-start bg-white/10 border-white/30 text-white hover:bg-white/20"
                    onClick={() => {
                      setUniversalSource(c.label);
                      setTrackingData(c.data);
                      setUniversalCandidates([]);
                    }}
                  >
                    <Truck className="h-4 w-4 mr-2" />
                    {c.label}
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}

          {loading && (
            <div className="space-y-4">
              <Card className="bg-white/10 backdrop-blur-xl border-white/20">
                <CardHeader>
                  <Skeleton className="h-6 w-32 bg-white/20" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-8 w-full bg-white/20" />
                  <Skeleton className="h-4 w-24 bg-white/20" />
                </CardContent>
              </Card>
            </div>
          )}

          <Card className="bg-white/10 backdrop-blur-xl border-white/20">
            <CardContent className="p-6 text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-white/50" />
              <h3 className="font-semibold mb-2 text-white">Where to find your AWB number?</h3>
              <p className="text-sm text-white/70">
                You can find your AWB number in your order confirmation email or in your order history.
              </p>
              <Button variant="outline" onClick={() => navigate('/history')} className="mt-4 bg-white/10 border-white/30 text-white hover:bg-white/20">
                View Order History
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { orderInformation, statuses } = trackingData;
  const latestStatus = statuses?.[0];
  const sortedStatuses = [...(statuses || [])].sort((a, b) => b.statusTimestamp - a.statusTimestamp);

  return (
    <div className="min-h-screen relative pb-24 xl:pb-4">
      <PageSeo title="Track Parcel — Unified Courier Tracking | ViaSetu" description="Track shipments from Delhivery, XpressBees, Shadowfax, Shree Maruti and other couriers in one place by AWB number." path="/tracking" />
      <PageBackground variant="logistics" opacity={0.75} />
      
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-xl border-b border-white/20 p-4 sticky top-0 z-50">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">Track Order</h1>
            <p className="text-sm text-white/70">{orderInformation?.trackingId || currentAwb}</p>
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4 max-w-4xl mx-auto relative z-10">
        {universalSource && (
          <div className="rounded-md border border-primary/40 bg-primary/10 p-2.5 flex gap-2">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-white/80 leading-snug">
              Tracked via <span className="font-semibold text-white">{universalSource}</span>. This AWB was not booked through ViaSetu — data shown directly from the courier partner.
            </p>
          </div>
        )}

        {/* Search Again */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20">
          <CardContent className="p-3">
            <div className="flex gap-2">
              <Input
                placeholder="Enter AWB Number"
                value={awbInput}
                onChange={(e) => setAwbInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
                className="flex-1 bg-white/20 border-white/30 text-white placeholder:text-white/50"
              />
              <Button onClick={handleTrack} disabled={loading} size="sm">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Current Status */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-white">
              <span className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Current Status
              </span>
              <Badge className={getCategoryColor(latestStatus?.category)}>
                {latestStatus?.category?.replace(/_/g, ' ') || 'Unknown'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium text-white">{latestStatus?.subcategory || latestStatus?.status}</p>
            <p className="text-sm text-white/70 mt-1">
              {formatTimestamp(latestStatus?.statusTimestamp)}
            </p>
          </CardContent>
        </Card>

        {/* Order Info */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Truck className="h-5 w-5 text-primary" />
              Order Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-white/50" />
              <div>
                <p className="text-sm text-white/60">Booking Date</p>
                <p className="font-medium text-white">{formatDate(orderInformation?.bookingDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Package className="h-4 w-4 text-white/50" />
              <div>
                <p className="text-sm text-white/60">Service Type</p>
                <p className="font-medium capitalize text-white">{orderInformation?.serviceType || 'Standard'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pickup & Delivery Locations */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Shipment Route</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Pickup */}
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-primary/20">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-white/50">Pickup Location</p>
                <p className="font-medium text-white">{orderInformation?.senderDetails?.sender_name}</p>
                <p className="text-sm text-white/70">
                  {orderInformation?.sourceLocation?.address}, {orderInformation?.sourceLocation?.city}, {orderInformation?.sourceLocation?.state} - {orderInformation?.sourceLocation?.pincode}
                </p>
                <p className="text-sm text-white/60 flex items-center gap-1 mt-1">
                  <Phone className="h-3 w-3" />
                  {orderInformation?.senderDetails?.sender_mobile}
                </p>
              </div>
            </div>

            <div className="border-l-2 border-dashed border-white/30 ml-5 h-6" />

            {/* Delivery */}
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-red-500/20">
                <MapPin className="h-4 w-4 text-red-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-white/50">Delivery Location</p>
                <p className="font-medium text-white">{orderInformation?.receiverDetails?.receiver_name}</p>
                <p className="text-sm text-white/70">
                  {orderInformation?.destinationLocation?.address}, {orderInformation?.destinationLocation?.city}, {orderInformation?.destinationLocation?.state} - {orderInformation?.destinationLocation?.pincode}
                </p>
                <p className="text-sm text-white/60 flex items-center gap-1 mt-1">
                  <Phone className="h-3 w-3" />
                  {orderInformation?.receiverDetails?.receiver_mobile}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Timeline */}
        <Card className="bg-white/10 backdrop-blur-xl border-white/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Clock className="h-5 w-5 text-primary" />
              Tracking Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sortedStatuses.map((status, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className={`p-1.5 rounded-full ${index === 0 ? 'bg-primary' : 'bg-white/20'}`}>
                    <CheckCircle className={`h-4 w-4 ${index === 0 ? 'text-primary-foreground' : 'text-white/50'}`} />
                  </div>
                  <div className="flex-1 pb-4 border-b border-white/10 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={index === 0 ? "default" : "secondary"} className="text-xs">
                        {status.category?.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="font-medium text-sm text-white">{status.subcategory}</p>
                    {status.location && (
                      <p className="text-xs text-white/60 flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {status.location}
                      </p>
                    )}
                    <p className="text-xs text-white/50 mt-1">
                      {formatTimestamp(status.statusTimestamp)}
                    </p>
                    {status.deliveryPartnerName && (
                      <p className="text-xs text-white/50 capitalize">
                        Partner: {status.deliveryPartnerName}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cancellation notice — customers must email support */}
        {bookingMeta && isCancellable(latestStatus?.category || bookingMeta.status) && (
          <div className="rounded-lg border border-amber-300/60 bg-amber-50/90 p-3 flex gap-2">
            <Ban className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900">
              <strong>Need to cancel this order?</strong> Orders cannot be cancelled from the
              app once placed. Please email{' '}
              <a href="mailto:support@viasetu.com" className="font-semibold underline">
                support@viasetu.com
              </a>{' '}
              with your AWB number and we'll get back to you within a few hours.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="w-full bg-white/10 border-white/30 text-white hover:bg-white/20" onClick={() => navigate('/support')}>
            Get Help
          </Button>
          <Button variant="outline" className="w-full bg-white/10 border-white/30 text-white hover:bg-white/20" onClick={() => navigate('/history')}>
            All Orders
          </Button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default Tracking;