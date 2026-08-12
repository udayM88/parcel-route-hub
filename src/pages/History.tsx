import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Package, MapPin, Calendar, Eye, Navigation, Truck, FileDown, Edit, Copy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getAuthSession } from "@/lib/auth";
import EmptyBoxIllustration from "@/components/illustrations/EmptyBoxIllustration";
import PageBackground from "@/components/PageBackground";
import BottomNav from "@/components/BottomNav";
import PageSeo from "@/components/PageSeo";
import BalanceDueCard, { type BookingBalance } from "@/components/booking/BalanceDueCard";

interface OrderAddress {
  type: string;
  name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface ShipmentDocument {
  id: number;
  type: string;
  url?: string;
  number?: string;
  date?: string;
  is_active?: boolean;
}

interface PrayogOrder {
  orderId: string;
  orderDate: string;
  orderStatus: string;
  carrierName?: string;
  carrierId?: string;
  parcelCategory?: string;
  shipments?: Array<{
    awbNumber: string;
    partnerName: string;
    shipmentStatus: string;
    physicalWeight?: number;
    volumetricWeight?: number;
    dimensions?: { length: number; width: number; height: number };
    items?: Array<{ name?: string; description?: string; declaredValue?: number }>;
    documents?: ShipmentDocument[];
  }>;
  addresses?: OrderAddress[];
  payment?: {
    finalAmount?: number;
  };
  statusReason?: string | null;
}

const OrderCardSkeleton = () => (
  <Card className="p-4 animate-in bg-white/10 backdrop-blur-xl border-white/20">
    <div className="flex items-start justify-between mb-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-32 bg-white/20" />
          <Skeleton className="h-5 w-20 rounded-full bg-white/20" />
        </div>
        <Skeleton className="h-4 w-24 bg-white/20" />
        <Skeleton className="h-4 w-36 bg-white/20" />
      </div>
      <Skeleton className="h-10 w-10 rounded-md bg-white/20" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div className="flex items-start gap-2">
        <Skeleton className="h-4 w-4 mt-1 bg-white/20" />
        <div className="space-y-1 flex-1">
          <Skeleton className="h-3 w-12 bg-white/20" />
          <Skeleton className="h-4 w-24 bg-white/20" />
          <Skeleton className="h-3 w-full bg-white/20" />
        </div>
      </div>
      <div className="flex items-start gap-2">
        <Skeleton className="h-4 w-4 mt-1 bg-white/20" />
        <div className="space-y-1 flex-1">
          <Skeleton className="h-3 w-12 bg-white/20" />
          <Skeleton className="h-4 w-24 bg-white/20" />
          <Skeleton className="h-3 w-full bg-white/20" />
        </div>
      </div>
    </div>
    <Skeleton className="h-9 w-full bg-white/20" />
  </Card>
);

const History = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orders, setOrders] = useState<PrayogOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<any>(null);
  const [bookingsMap, setBookingsMap] = useState<Record<string, { id: string; booking_source: string; status: string; awb?: string | null; payment_status?: string | null }>>({});
  const [partialFailure, setPartialFailure] = useState<string | null>(null);
  const [balances, setBalances] = useState<Record<string, BookingBalance>>({});

  // Outstanding / recently settled price differences on re-booked shipments.
  const fetchBalances = async () => {
    try {
      const auth = getAuthSession();
      if (!auth) return;
      const { data } = await supabase.functions.invoke('booking-balance', {
        body: { action: 'list' },
        headers: { 'x-prayog-auth': JSON.stringify(auth) },
      });
      const map: Record<string, BookingBalance> = {};
      ((data as any)?.balances || []).forEach((b: BookingBalance) => {
        if (!map[b.booking_id] || b.status === 'pending') map[b.booking_id] = b;
      });
      setBalances(map);
    } catch (e) {
      console.error('Failed to load balances', e);
    }
  };



  useEffect(() => {
    fetchOrders();
    fetchBalances();

    try {
      const d = localStorage.getItem('booking_draft');
      if (d) setDraft(JSON.parse(d));
    } catch {}
  }, []);

  const fetchOrders = async () => {
    try {
      const auth = getAuthSession();

      if (!auth) {
        toast({
          title: "Authentication required",
          description: "Please sign in to view your orders",
          variant: "destructive",
        });
        navigate('/login');
        return;
      }

      const { data, error } = await supabase.functions.invoke('get-user-orders', {
        headers: { 'x-prayog-auth': JSON.stringify(auth) },
      });

      if (error) throw error;

      const localOrders = (data as any)?.orders || [];
      localOrders.sort((a: any, b: any) => {
        const da = new Date(a.orderDate || 0).getTime();
        const db = new Date(b.orderDate || 0).getTime();
        return db - da;
      });

      setOrders(localOrders);

      const map: Record<string, { id: string; booking_source: string; status: string; awb?: string | null; payment_status?: string | null }> = {};
      localOrders.forEach((o: any) => {
        if (o._booking) {
          const key = o._booking.prayog_order_id || o._booking.id;
          map[key] = {
            id: o._booking.id,
            booking_source: o._booking.booking_source || '',
            status: o._booking.status || '',
            awb: o._booking.awb || o._booking.prayog_awb || o._booking.tracking_id || null,
            payment_status: o._booking.payment_status || null,
          };
        }
      });
      setBookingsMap(map);
      setPartialFailure(null);
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      toast({
        title: "Error",
        description: "Failed to load orders",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case 'delivered':
        return 'bg-green-500';
      case 'in_transit':
      case 'intransit':
      case 'shipped':
        return 'bg-blue-500';
      case 'pending':
      case 'booked':
        return 'bg-yellow-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
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

  if (loading) {
    return (
      <div className="min-h-screen relative pb-24 md:pb-4">
        <PageBackground variant="shipping" opacity={0.75} />
        <header className="bg-white/10 backdrop-blur-xl border-b border-white/20 p-4 sticky top-0 z-50">
          <div className="flex items-center gap-3 max-w-4xl mx-auto">
            <Skeleton className="h-10 w-10 rounded-md bg-white/20" />
            <Skeleton className="h-7 w-32 bg-white/20" />
          </div>
        </header>
        <div className="p-4 max-w-4xl mx-auto space-y-4 relative z-10">
          <OrderCardSkeleton />
          <OrderCardSkeleton />
          <OrderCardSkeleton />
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative pb-24 md:pb-4">
      <PageSeo title="Order History — My Shipments | ViaSetu" description="View your past ViaSetu shipments, download invoices and labels, and reorder past bookings." path="/history" noindex />
      <PageBackground variant="shipping" opacity={0.75} />
      
      <header className="bg-white/10 backdrop-blur-xl border-b border-white/20 p-4 sticky top-0 z-50">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="text-white hover:bg-white/10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold text-white">Order History</h1>
        </div>
      </header>

      <div className="p-4 max-w-4xl mx-auto space-y-4 relative z-10">
        {partialFailure && (
          <Card className="p-3 bg-amber-500/10 backdrop-blur-xl border-amber-500/30">
            <p className="text-sm text-amber-200">{partialFailure}</p>
          </Card>
        )}
        {/* Draft Resume Card */}
        {draft && (
          <Card className="p-4 bg-amber-500/10 backdrop-blur-xl border-amber-500/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Edit className="h-4 w-4 text-amber-400" />
                  <h3 className="font-semibold text-white">Draft Booking</h3>
                  <Badge className="bg-amber-500/30 text-amber-200 border-0 text-xs">Incomplete</Badge>
                </div>
                <p className="text-sm text-white/60">
                  {draft.pickupPincode && draft.deliveryPincode 
                    ? `${draft.pickupPincode} → ${draft.deliveryPincode}` 
                    : 'Started booking'}
                  {draft.savedAt && ` • ${new Date(draft.savedAt).toLocaleDateString()}`}
                </p>
              </div>
              <Button size="sm" onClick={() => navigate('/booking')}>
                Resume
              </Button>
            </div>
          </Card>
        )}

        {orders.length === 0 && !draft ? (
          <Card className="p-8 text-center bg-white/10 backdrop-blur-xl border-white/20">
            <EmptyBoxIllustration className="mb-6" />
            <h2 className="text-xl font-semibold mb-2 text-white">No orders yet</h2>
            <p className="text-white/70 mb-6 max-w-xs mx-auto">
              Your delivery history will appear here once you book your first shipment
            </p>
            <Button onClick={() => navigate('/booking')} size="lg">
              Book Your First Delivery
            </Button>
          </Card>
        ) : (
          orders.map((order) => {
            const pickupAddress = order.addresses?.find(a => a.type === 'PICKUP');
            const deliveryAddress = order.addresses?.find(a => a.type === 'DELIVERY');
            
            const labelDocument = order.shipments?.[0]?.documents?.find(
              (doc) => doc.type === "label" && doc.url
            );
            const labelUrl = labelDocument?.url;
            
            const showLabelButton = !!labelUrl;
            
            return (
              <Card key={order.orderId} className="p-4 bg-white/10 backdrop-blur-xl border-white/20">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-lg text-white">
                        {order.shipments?.[0]?.awbNumber || order.orderId}
                      </h3>
                      {(() => {
                        // Prefer DB status when terminal — Prayog doesn't know
                        // about direct-partner cancellations/refunds, so its
                        // orderStatus can stay stale at "CREATED" forever.
                        const dbStatus = bookingsMap[order.orderId]?.status;
                        const terminal = ['CANCELLED', 'CANCELED', 'DELIVERED', 'RTO', 'FAILED'];
                        const displayStatus = (dbStatus && terminal.includes(dbStatus.toUpperCase()))
                          ? dbStatus
                          : (order.orderStatus || dbStatus || 'Unknown');
                        return (
                          <Badge className={getStatusColor(displayStatus)}>
                            {displayStatus}
                          </Badge>
                        );
                      })()}
                      {bookingsMap[order.orderId]?.payment_status === 'cop_pending' && (
                        <Badge className="bg-yellow-500/90 text-yellow-950 border-0 text-xs">
                          💵 COP Pending
                        </Badge>
                      )}
                    </div>
                    {order.carrierName && (
                      <p className="text-sm text-white/70 flex items-center gap-1">
                        <Truck className="h-3 w-3" />
                        {order.carrierName}
                      </p>
                    )}
                    <p className="text-sm text-white/70 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(order.orderDate)}
                    </p>
                    {order.statusReason && (
                      <p className="mt-1 text-xs text-red-200 bg-red-500/20 border border-red-400/40 rounded px-2 py-1 max-w-md">
                        {order.statusReason}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate('/tracking', { 
                      state: { 
                        awbNumber: order.shipments?.[0]?.awbNumber,
                        orderId: order.orderId 
                      } 
                    })}
                    className="text-primary hover:bg-white/10"
                  >
                    <Navigation className="h-5 w-5" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-white/50">Pickup</p>
                        <p className="text-sm font-medium text-white">{pickupAddress?.name || 'N/A'}</p>
                        <p className="text-xs text-white/60">
                          {pickupAddress?.street}{pickupAddress?.city ? `, ${pickupAddress.city}` : ''}{pickupAddress?.state ? `, ${pickupAddress.state}` : ''} - {pickupAddress?.zip || ''}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-red-400 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-white/50">Delivery</p>
                        <p className="text-sm font-medium text-white">{deliveryAddress?.name || 'N/A'}</p>
                        <p className="text-xs text-white/60">
                          {deliveryAddress?.street}{deliveryAddress?.city ? `, ${deliveryAddress.city}` : ''}{deliveryAddress?.state ? `, ${deliveryAddress.state}` : ''} - {deliveryAddress?.zip || ''}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {(() => {
                  const bookingId = (order as any)._localBookingId || bookingsMap[order.orderId]?.id;
                  const bal = bookingId ? balances[bookingId] : null;
                  return bal ? (
                    <BalanceDueCard
                      balance={bal}
                      onPaid={() => { fetchOrders(); fetchBalances(); }}
                    />
                  ) : null;

                })()}



                <div className="flex gap-2 flex-wrap">
                  {(() => {
                    const bm = bookingsMap[order.orderId];
                    const bookingId = (order as any)._localBookingId || bm?.id;
                    const canFetchLabel =
                      bm?.booking_source === 'delhivery_direct' ||
                      bm?.booking_source === 'urbanebolt_direct' ||
                      bm?.booking_source === 'xpressbees_direct' ||
                      bm?.booking_source === 'shree_maruti_direct' ||
                      !!labelUrl;
                    if (!canFetchLabel) return null;
                    return (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-white/10 border-white/30 text-white hover:bg-white/20"
                        onClick={async () => {
                          if (labelUrl) {
                            window.open(labelUrl, '_blank');
                            return;
                          }
                          try {
                            const auth = getAuthSession();
                            const { data, error } = await supabase.functions.invoke('get-booking-label', {
                              body: { booking_id: bookingId },
                              headers: { 'x-prayog-auth': JSON.stringify(auth) },
                            });
                            if (error) throw error;
                            if (data?.success && data?.label_url) {
                              window.open(data.label_url, '_blank');
                              fetchOrders();
                            } else {
                              toast({
                                title: 'Label Unavailable',
                                description: data?.error || 'Label could not be retrieved.',
                                variant: 'destructive',
                              });
                            }
                          } catch (e: any) {
                            toast({ title: 'Error', description: e.message || 'Failed to fetch label', variant: 'destructive' });
                          }
                        }}
                      >
                        <FileDown className="h-4 w-4 mr-2" />
                        Download Label
                      </Button>
                    );
                  })()}
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                    onClick={() => {
                      const bookingId = (order as any)._localBookingId;
                      navigate(`/order/${bookingId || order.orderId}`);
                    }}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Details
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                    onClick={() => {
                      const pickup = order.addresses?.find(a => a.type === 'PICKUP');
                      const delivery = order.addresses?.find(a => a.type === 'DELIVERY');
                      navigate('/booking', {
                        state: {
                           cloneData: {
                            senderData: {
                              name: pickup?.name || '',
                              phone: pickup?.phone || '',
                              flatNo: '',
                              address: pickup?.street || '',
                              city: pickup?.city || '',
                              state: pickup?.state || '',
                              pincode: pickup?.zip || '',
                            },
                            receiverData: {
                              name: delivery?.name || '',
                              phone: delivery?.phone || '',
                              flatNo: '',
                              address: delivery?.street || '',
                              city: delivery?.city || '',
                              state: delivery?.state || '',
                              pincode: delivery?.zip || '',
                            },
                            pickupPincode: pickup?.zip || '',
                            deliveryPincode: delivery?.zip || '',
                            goodsType: order.shipments?.[0]?.items?.[0]?.name || '',
                            packageWeight: order.shipments?.[0]?.physicalWeight ? String(order.shipments[0].physicalWeight) : '',
                            dimensions: order.shipments?.[0]?.dimensions ? {
                              length: String(order.shipments[0].dimensions.length || ''),
                              width: String(order.shipments[0].dimensions.width || ''),
                              height: String(order.shipments[0].dimensions.height || ''),
                            } : { length: '', width: '', height: '' },
                            shipmentValue: order.shipments?.[0]?.items?.[0]?.declaredValue ? String(order.shipments[0].items[0].declaredValue) : '',
                          }
                        }
                      });
                    }}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Repeat
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default History;