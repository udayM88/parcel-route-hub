import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Package, Clock, AlertCircle, CheckCircle, MapPin, User, Eye, Search, IndianRupee, Truck, Phone, Calendar as CalendarIcon, FileText, ExternalLink, Navigation, XCircle, Download, Loader2, RefreshCw, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, startOfDay, endOfDay, isWithinInterval, subDays, startOfMonth, endOfMonth } from "date-fns";
import { CURRENT_ENV } from "@/config/environment";
import { useCancelOrder, isCancellable } from "@/hooks/useCancelOrder";
import CancelOrderDialog from "@/components/booking/CancelOrderDialog";
import ManualAwbDialog from "@/components/admin/ManualAwbDialog";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { useAdminAuth } from "@/contexts/useAdminAuth";
import ParcelPhotoGallery from "@/components/admin/ParcelPhotoGallery";
import { bucketOfStatus } from "@/lib/booking-status";
import { cn } from "@/lib/utils";

import { resolvePartnerKey, trackingFunctionFor, labelFunctionFor, trackingBody } from "@/lib/partner-functions";

// Resolve the courier partner from partner_id / booking_source / courier_name.
// Assisted + manually-attached orders have booking_source like "admin_assisted",
// so we must not rely on booking_source alone.
const partnerKeyOf = (b: { partner_id?: string | null; booking_source?: string | null; courier_name?: string | null }) =>
  resolvePartnerKey(b.partner_id, `${b.booking_source || ""} ${b.courier_name || ""}`);


interface Booking {
  id: string;
  tracking_id: string | null;
  status: string | null;
  courier_name: string;
  courier_price: number;
  sender_name: string;
  sender_phone: string;
  sender_address: string;
  sender_city: string;
  sender_state: string;
  sender_pincode: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  receiver_city: string;
  receiver_state: string;
  receiver_pincode: string;
  goods_type: string;
  package_weight: string;
  dead_weight_g?: number | null;
  volumetric_weight_g?: number | null;
  chargeable_weight_g?: number | null;
  urgency: string;
  delivery_time: string;
  shipment_value: number | null;
  insurance_required: boolean | null;
  packaging_required: boolean | null;
  created_at: string;
  updated_at: string;
  length: string | null;
  width: string | null;
  height: string | null;
  base_fare?: number;
  platform_fee?: number;
  prayog_commission?: number;
  gst?: number;
  insurance_amount?: number;
  packaging_amount?: number;
  payment_id?: string;
  payment_status?: string;
  prayog_order_id?: string;
  prayog_awb?: string;
  booking_source?: string | null;
  partner_id?: string | null;
  label_url?: string | null;
  failure_reason?: string | null;
  failure_step?: string | null;
  partner_error_raw?: string | null;
  refund_id?: string | null;
  refund_reason?: string | null;
  parcel_photos?: any;
}

const OrderMonitoring = () => {
  const { adminUser } = useAdminAuth();
  const isSuperAdmin = adminUser?.role === "super_admin";
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [manualAwbOpen, setManualAwbOpen] = useState(false);
  const [tracking, setTracking] = useState<{ loading: boolean; data: any | null; error: string | null }>({ loading: false, data: null, error: null });
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [labelLoading, setLabelLoading] = useState(false);
  const { toast } = useToast();
  const { cancelOrder, cancelling } = useCancelOrder({
    onSuccess: () => {
      setCancelDialogOpen(false);
      fetchBookings();
      if (selectedBooking) fetchTrackingForBooking(selectedBooking);
    },
  });

  useEffect(() => {
    fetchBookings();
  }, []);

  useRealtimeTable("bookings", () => fetchBookings(), { channelName: "admin-order-monitoring", debounceMs: 2500 });

  const fetchBookings = async () => {
    try {
      setLoading(true);
      // Cap to recent 1000 orders — anything older is reachable via search/filters
      // (the details dialog itself loads the full row lazily if needed).
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) throw error;
      setBookings(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching bookings",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (bucketOfStatus(status)) {
      case "delivered": return "default";
      case "in_transit":
      case "out_for_delivery":
      case "picked_up":
      case "confirmed": return "secondary";
      case "cancelled":
      case "rto": return "destructive";
      default: return "outline";
    }
  };

  const getStatusLabel = (status: string | null) => {
    if (!status) return "Pending";
    return status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  const inTransitBuckets = new Set(["confirmed", "picked_up", "in_transit", "out_for_delivery"]);

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = 
      booking.tracking_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.sender_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.receiver_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.id.toLowerCase().includes(searchTerm.toLowerCase());

    const bookingDate = new Date(booking.created_at);
    const matchesDate =
      (!dateFrom && !dateTo) ||
      (dateFrom && !dateTo && bookingDate >= startOfDay(dateFrom)) ||
      (!dateFrom && dateTo && bookingDate <= endOfDay(dateTo)) ||
      (dateFrom && dateTo && isWithinInterval(bookingDate, {
        start: startOfDay(dateFrom),
        end: endOfDay(dateTo),
      }));

    const bucket = bucketOfStatus(booking.status);

    if (selectedFilter === "all") return matchesSearch && matchesDate;
    if (selectedFilter === "pending") return matchesSearch && matchesDate && bucket === "created";
    if (selectedFilter === "in_transit") return matchesSearch && matchesDate && inTransitBuckets.has(bucket);
    if (selectedFilter === "delivered") return matchesSearch && matchesDate && bucket === "delivered";
    if (selectedFilter === "cancelled") return matchesSearch && matchesDate && (bucket === "cancelled" || bucket === "rto");
    if (selectedFilter === "cop_pending") return matchesSearch && matchesDate && booking.payment_status === "cop_pending";
    return matchesSearch && matchesDate;
  });

  const countByBucket = (predicate: (b: string) => boolean) =>
    bookings.filter(b => predicate(bucketOfStatus(b.status))).length.toString();

  const stats = [
    {
      title: "Total Orders",
      value: bookings.length.toString(),
      icon: Package,
      color: "text-blue-600"
    },
    {
      title: "In Transit",
      value: countByBucket(b => inTransitBuckets.has(b)),
      icon: Truck,
      color: "text-green-600"
    },
    {
      title: "Pending",
      value: countByBucket(b => b === "created"),
      icon: Clock,
      color: "text-yellow-600"
    },
    {
      title: "Delivered",
      value: countByBucket(b => b === "delivered"),
      icon: CheckCircle,
      color: "text-purple-600"
    },
    {
      title: "Cancelled",
      value: countByBucket(b => b === "cancelled" || b === "rto"),
      icon: XCircle,
      color: "text-red-600"
    },
  ];

  const calculatePriceBreakdown = (booking: Booking) => {
    const courierPrice = Number(booking.courier_price) || 0;
    const platformFee = Number(booking.platform_fee) || 0;
    const prayogCommission = Number(booking.prayog_commission) || 0;
    const gst = Number(booking.gst) || 0;
    const insurance = Number(booking.insurance_amount) || 0;
    const packaging = Number(booking.packaging_amount) || 0;
    const baseFareCol = Number(booking.base_fare) || 0;
    // base_fare in DB embeds the platform markup (baseFare = round(card*3)+50).
    // True partner payable = base_fare - platform_fee (the card price).
    const partnerPayable = baseFareCol > 0
      ? Math.max(0, baseFareCol - platformFee)
      : Math.max(0, courierPrice - platformFee - gst - insurance - packaging);

    return {
      partnerPayable,
      platformFee,
      prayogCommission,
      gst,
      insurance,
      packaging,
      total: courierPrice,
    };
  };

  const openDetails = (booking: Booking) => {
    setSelectedBooking(booking);
    setDetailsOpen(true);
    setTracking({ loading: false, data: null, error: null });
    fetchTrackingForBooking(booking);
  };

  const fetchTrackingForBooking = async (booking: Booking) => {
    const key = partnerKeyOf(booking);
    const awb = booking.prayog_awb || booking.tracking_id;
    if (!key || !awb) {
      setTracking({ loading: false, data: null, error: !key ? `Tracking not supported for ${booking.courier_name || booking.booking_source || "this partner"}` : "No AWB on order yet" });
      return;
    }
    setTracking({ loading: true, data: null, error: null });
    try {
      const { data, error } = await supabase.functions.invoke(trackingFunctionFor(key), {
        body: { ...trackingBody(key, awb, booking.prayog_order_id), awb, client_request_id: awb },
        headers: { "x-environment": CURRENT_ENV },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTracking({ loading: false, data, error: null });
    } catch (e: any) {
      setTracking({ loading: false, data: null, error: e.message || "Failed to load tracking" });
    }
  };

  const handleDownloadLabel = async () => {
    if (!selectedBooking) return;
    if (selectedBooking.label_url) {
      window.open(selectedBooking.label_url, "_blank");
      return;
    }
    const key = partnerKeyOf(selectedBooking);
    const awb = selectedBooking.prayog_awb || selectedBooking.tracking_id;
    if (!key || !awb) {
      toast({ title: "Label unavailable", description: "Label not supported for this partner or AWB missing.", variant: "destructive" });
      return;
    }
    setLabelLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(labelFunctionFor(key), {
        body: { waybill: awb, awb, booking_id: selectedBooking.id, order_id: selectedBooking.prayog_order_id || awb },
        headers: { "x-environment": CURRENT_ENV },
      });
      if (error) throw error;
      const url = data?.label_url || data?.url;
      if (!url) throw new Error(data?.error || "No label URL returned");
      window.open(url, "_blank");
    } catch (e: any) {
      toast({ title: "Label error", description: e.message || "Failed to fetch label", variant: "destructive" });
    } finally {
      setLabelLoading(false);
    }
  };

  const handleCancelConfirm = async (reason: any) => {
    if (!selectedBooking) return;
    await cancelOrder({
      orderId: selectedBooking.prayog_order_id || selectedBooking.id,
      bookingSource: selectedBooking.booking_source || "",
      bookingId: selectedBooking.id,
      reason,
      awb: selectedBooking.prayog_awb || selectedBooking.tracking_id,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Order Monitoring</h2>
        <p className="text-muted-foreground">Real-time order tracking with complete visibility</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by ID, name, or tracking..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedFilter} onValueChange={setSelectedFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="cop_pending">💵 COP Pending</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[140px] justify-start text-left font-normal",
                    !dateFrom && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, "dd MMM yyyy") : "From date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={setDateFrom}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[140px] justify-start text-left font-normal",
                    !dateTo && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, "dd MMM yyyy") : "To date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={setDateTo}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {(dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}
              >
                Clear
              </Button>
            )}
          </div>

          <Button variant="outline" onClick={fetchBookings}>
            Refresh
          </Button>
        </div>

        {/* Date presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Quick filters:</span>
          {[
            { label: "Today", from: startOfDay(new Date()), to: endOfDay(new Date()) },
            { label: "Last 7 days", from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) },
            { label: "Last 30 days", from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) },
            { label: "This month", from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
          ].map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              onClick={() => { setDateFrom(preset.from); setDateTo(preset.to); }}
            >
              {preset.label}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}
          >
            All time
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Orders ({bookings.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({bookings.filter(b => bucketOfStatus(b.status) !== "delivered" && bucketOfStatus(b.status) !== "cancelled" && bucketOfStatus(b.status) !== "rto").length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({bookings.filter(b => bucketOfStatus(b.status) === "delivered").length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Orders</CardTitle>
              <CardDescription>Complete list of all bookings with pricing details</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading orders...</div>
              ) : filteredBookings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No orders found</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Sender</TableHead>
                        <TableHead>Receiver</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Courier</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Photos</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBookings.map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span className="text-xs text-muted-foreground">{booking.id.slice(0, 8)}...</span>
                              {booking.tracking_id && (
                                <span className="text-xs font-medium text-primary">{booking.tracking_id}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(booking.created_at), "dd MMM yyyy")}
                            <br />
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(booking.created_at), "HH:mm")}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{booking.sender_name}</span>
                              <span className="text-xs text-muted-foreground">{booking.sender_city}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{booking.receiver_name}</span>
                              <span className="text-xs text-muted-foreground">{booking.receiver_city}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <span>{booking.sender_pincode}</span>
                              <span>→</span>
                              <span>{booking.receiver_pincode}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{booking.courier_name}</TableCell>
                          <TableCell className="font-medium">
                            ₹{booking.courier_price?.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {Array.isArray(booking.parcel_photos) && booking.parcel_photos.length > 0 ? (
                              <Badge variant="outline" className="gap-1">
                                <Camera className="h-3 w-3" />
                                {booking.parcel_photos.length}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground gap-1">
                                <Camera className="h-3 w-3 opacity-50" />
                                0
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 items-start">
                              <Badge variant={getStatusColor(booking.status)}>
                                {getStatusLabel(booking.status)}
                              </Badge>
                              {booking.payment_status === 'cop_pending' && (
                                <Badge className="bg-yellow-500 text-yellow-950 text-xs">💵 COP</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => openDetails(booking)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>Active Orders</CardTitle>
              <CardDescription>Orders in progress</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Sender → Receiver</TableHead>
                        <TableHead>Courier</TableHead>
                        <TableHead>ETA</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBookings.filter(b => { const bk = bucketOfStatus(b.status); return bk !== "delivered" && bk !== "cancelled" && bk !== "rto"; }).map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell className="font-medium">
                            {booking.tracking_id || booking.id.slice(0, 8)}
                          </TableCell>
                          <TableCell>
                            {booking.sender_city} → {booking.receiver_city}
                          </TableCell>
                          <TableCell>{booking.courier_name}</TableCell>
                          <TableCell>{booking.delivery_time}</TableCell>
                          <TableCell className="font-medium">₹{booking.courier_price}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 items-start">
                              <Badge variant={getStatusColor(booking.status)}>
                                {getStatusLabel(booking.status)}
                              </Badge>
                              {booking.payment_status === 'cop_pending' && (
                                <Badge className="bg-yellow-500 text-yellow-950 text-xs">💵 COP</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => openDetails(booking)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed">
          <Card>
            <CardHeader>
              <CardTitle>Completed Orders</CardTitle>
              <CardDescription>Successfully delivered orders</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Completed On</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Courier</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBookings.filter(b => bucketOfStatus(b.status) === "delivered").map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell className="font-medium">
                            {booking.tracking_id || booking.id.slice(0, 8)}
                          </TableCell>
                          <TableCell>{format(new Date(booking.updated_at), "dd MMM yyyy")}</TableCell>
                          <TableCell>{booking.sender_city} → {booking.receiver_city}</TableCell>
                          <TableCell>{booking.courier_name}</TableCell>
                          <TableCell className="font-medium">₹{booking.courier_price}</TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => openDetails(booking)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ManualAwbDialog
        open={manualAwbOpen}
        onOpenChange={setManualAwbOpen}
        booking={selectedBooking}
        onSuccess={() => { setDetailsOpen(false); fetchBookings(); }}
      />

      {/* Order Details Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Order Details
            </DialogTitle>
            <DialogDescription>
              {selectedBooking?.tracking_id && (
                <span className="font-medium">Tracking: {selectedBooking.tracking_id}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedBooking && (
            <div className="space-y-6">
              {/* Manual AWB — for orders booked directly on a courier portal */}
              {!selectedBooking.prayog_awb && !selectedBooking.tracking_id ? (
                <div className="flex items-center justify-between gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50">
                  <div className="text-sm text-amber-900">
                    <p className="font-medium">No AWB on this order yet</p>
                    <p className="text-xs">If it was booked directly with the courier, add the AWB to enable tracking and labels.</p>
                  </div>
                  <Button size="sm" onClick={() => setManualAwbOpen(true)}>Add AWB manually</Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 p-4 rounded-lg border bg-muted/40">
                  <div className="text-sm">
                    <p className="font-medium">Shipment moved to another courier?</p>
                    <p className="text-xs text-muted-foreground">Replace the AWB, courier partner and label. The customer sees the update in History.</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setManualAwbOpen(true)}>Update AWB / label</Button>
                </div>
              )}

              {/* Status Bar */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Order Status</p>
                  <Badge variant={getStatusColor(selectedBooking.status)} className="mt-1">
                    {getStatusLabel(selectedBooking.status)}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">{format(new Date(selectedBooking.created_at), "dd MMM yyyy, HH:mm")}</p>
                </div>
              </div>

              {/* Failure Diagnostics — visible to everyone, raw payload super-admin only */}
              {(selectedBooking.failure_reason || selectedBooking.failure_step || selectedBooking.partner_error_raw) && (
                <Card className="border-destructive/40 bg-destructive/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      Failure Diagnostics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {selectedBooking.failure_step && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Failed at step</span>
                        <span className="font-mono">{selectedBooking.failure_step}</span>
                      </div>
                    )}
                    {selectedBooking.failure_reason && (
                      <div>
                        <p className="text-muted-foreground mb-1">Customer-facing reason</p>
                        <p className="font-medium">{selectedBooking.failure_reason}</p>
                      </div>
                    )}
                    {selectedBooking.refund_id && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Refund ID</span>
                        <span className="font-mono text-xs">{selectedBooking.refund_id}</span>
                      </div>
                    )}
                    {isSuperAdmin ? (
                      selectedBooking.partner_error_raw ? (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-muted-foreground">Raw partner response (super admin)</p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => {
                                navigator.clipboard.writeText(selectedBooking.partner_error_raw || "");
                                toast({ title: "Copied to clipboard" });
                              }}
                            >
                              Copy
                            </Button>
                          </div>
                          <pre className="bg-background border rounded p-2 text-xs whitespace-pre-wrap break-words max-h-60 overflow-auto">
{selectedBooking.partner_error_raw}
                          </pre>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          No raw partner response stored for this booking (failed before the new diagnostics column was added).
                        </p>
                      )
                    ) : null}
                  </CardContent>
                </Card>
              )}

              {/* Price Breakdown - Admin Only View */}
              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <IndianRupee className="h-5 w-5" />
                    Price Breakdown (Admin View)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const breakdown = calculatePriceBreakdown(selectedBooking);
                    return (
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Partner Payable (Courier)</span>
                          <span className="font-medium">₹{breakdown.partnerPayable.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Platform Revenue</span>
                          <span className="font-medium">₹{breakdown.platformFee.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Prayog Commission</span>
                          <span className="font-medium">₹{breakdown.prayogCommission.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">GST (18%)</span>
                          <span className="font-medium">₹{breakdown.gst.toLocaleString()}</span>
                        </div>
                        {selectedBooking.insurance_required && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Insurance</span>
                            <span className="font-medium">₹{breakdown.insurance.toLocaleString()}</span>
                          </div>
                        )}
                        {selectedBooking.packaging_required && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Packaging</span>
                            <span className="font-medium">₹{breakdown.packaging.toLocaleString()}</span>
                          </div>
                        )}
                        <Separator />
                        <div className="flex justify-between text-lg font-bold">
                          <span>Total Amount</span>
                          <span className="text-primary">₹{breakdown.total.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Sender & Receiver Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-green-600" />
                      Pickup (Sender)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{selectedBooking.sender_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedBooking.sender_phone}</span>
                    </div>
                    <p className="text-muted-foreground">
                      {selectedBooking.sender_address}
                      <br />
                      {selectedBooking.sender_city}, {selectedBooking.sender_state} - {selectedBooking.sender_pincode}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-red-600" />
                      Delivery (Receiver)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{selectedBooking.receiver_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedBooking.receiver_phone}</span>
                    </div>
                    <p className="text-muted-foreground">
                      {selectedBooking.receiver_address}
                      <br />
                      {selectedBooking.receiver_city}, {selectedBooking.receiver_state} - {selectedBooking.receiver_pincode}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Package & Shipping Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Package Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Goods Type</span>
                      <span className="font-medium capitalize">{selectedBooking.goods_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Weight (chargeable)</span>
                      <span className="font-medium">{selectedBooking.package_weight} kg</span>
                    </div>
                    {(selectedBooking.dead_weight_g != null || selectedBooking.volumetric_weight_g != null || selectedBooking.chargeable_weight_g != null) && (
                      <div className="rounded-md border border-primary/20 bg-primary/5 p-2 space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Dead</span>
                          <span>{selectedBooking.dead_weight_g ?? '—'} g</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Volumetric</span>
                          <span>{selectedBooking.volumetric_weight_g ?? '—'} g</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span>Chargeable (billed)</span>
                          <span className="text-primary">{selectedBooking.chargeable_weight_g ?? '—'} g</span>
                        </div>
                      </div>
                    )}
                    {(selectedBooking.length || selectedBooking.width || selectedBooking.height) && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Dimensions</span>
                        <span className="font-medium">
                          {selectedBooking.length} × {selectedBooking.width} × {selectedBooking.height} cm
                        </span>
                      </div>
                    )}
                    {selectedBooking.shipment_value && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Declared Value</span>
                        <span className="font-medium">₹{selectedBooking.shipment_value.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Insurance</span>
                      <Badge variant={selectedBooking.insurance_required ? "default" : "outline"}>
                        {selectedBooking.insurance_required ? "Yes" : "No"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Packaging</span>
                      <Badge variant={selectedBooking.packaging_required ? "default" : "outline"}>
                        {selectedBooking.packaging_required ? "Yes" : "No"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Shipping Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Courier</span>
                      <span className="font-medium">{selectedBooking.courier_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Urgency</span>
                      <Badge variant="outline" className="capitalize">{selectedBooking.urgency}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Est. Delivery</span>
                      <span className="font-medium">{selectedBooking.delivery_time}</span>
                    </div>
                    {selectedBooking.prayog_order_id && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Prayog Order ID</span>
                        <span className="font-medium text-xs">{selectedBooking.prayog_order_id}</span>
                      </div>
                    )}
                    {selectedBooking.prayog_awb && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">AWB Number</span>
                        <span className="font-medium">{selectedBooking.prayog_awb}</span>
                      </div>
                    )}
                    {selectedBooking.payment_id && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Payment ID</span>
                        <span className="font-medium text-xs">{selectedBooking.payment_id}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Parcel Photos uploaded by customer */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Parcel Photos (Customer Uploaded)
                  </CardTitle>
                  <CardDescription>
                    Verify parcel condition before pickup and on delivery.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ParcelPhotoGallery bookingId={selectedBooking.id} />
                </CardContent>
              </Card>

              {/* Live Tracking from Partner API */}
              <Card className="border-primary/20">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Navigation className="h-5 w-5" />
                    Live Tracking ({selectedBooking.booking_source || "n/a"})
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetchTrackingForBooking(selectedBooking)}
                    disabled={tracking.loading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${tracking.loading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </CardHeader>
                <CardContent>
                  {tracking.loading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Fetching from partner API…
                    </div>
                  )}
                  {tracking.error && !tracking.loading && (
                    <p className="text-sm text-destructive">{tracking.error}</p>
                  )}
                  {tracking.data && !tracking.loading && (
                    <div className="space-y-2">
                      {(tracking.data.statuses || []).slice(0, 6).map((s: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 text-sm border-l-2 border-primary/40 pl-3">
                          <div className="flex-1">
                            <p className="font-medium">{s.status || s.event || s.category}</p>
                            {s.location && <p className="text-xs text-muted-foreground">{s.location}</p>}
                            {s.statusTimestamp && (
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(s.statusTimestamp), "dd MMM yyyy HH:mm")}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                      {(!tracking.data.statuses || tracking.data.statuses.length === 0) && (
                        <pre className="text-xs bg-muted p-3 rounded max-h-60 overflow-auto">
                          {JSON.stringify(tracking.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {(selectedBooking.tracking_id || selectedBooking.prayog_awb) && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(`/admin/tracking?id=${selectedBooking.prayog_awb || selectedBooking.tracking_id}`, '_self')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in Tracking Console
                  </Button>
                )}
                {(selectedBooking.label_url || partnerKeyOf(selectedBooking)) && (selectedBooking.prayog_awb || selectedBooking.tracking_id) && (
                  <Button variant="outline" onClick={handleDownloadLabel} disabled={labelLoading}>
                    {labelLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                    Download Label
                  </Button>
                )}
                {isCancellable(selectedBooking.status) && (
                  <Button variant="destructive" onClick={() => setCancelDialogOpen(true)} disabled={cancelling}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel Order
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CancelOrderDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        onConfirm={handleCancelConfirm}
        cancelling={cancelling}
      />
    </div>
  );
};

export default OrderMonitoring;