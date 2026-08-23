import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IndianRupee, TrendingUp, Download, Percent, Truck, RefreshCw, FileSpreadsheet, FileText, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { format, startOfDay, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { downloadAccountsWorkbook, type ExportBooking } from "@/lib/accounts-export";
import { bucketOfStatus } from "@/lib/booking-status";
import { isCollected, isCopPending, isRefunded } from "@/lib/revenue";

interface Booking {
  id: string;
  tracking_id: string | null;
  prayog_order_id?: string | null;
  prayog_awb?: string | null;
  payment_id?: string | null;
  refund_id?: string | null;
  booking_source?: string | null;
  courier_name: string;
  courier_price: number;
  status: string | null;
  created_at: string;
  sender_name: string;
  sender_city?: string | null;
  sender_state?: string | null;
  sender_pincode?: string | null;
  receiver_name: string;
  receiver_city?: string | null;
  receiver_state?: string | null;
  receiver_pincode?: string | null;
  goods_type?: string | null;
  package_weight?: string | null;
  chargeable_weight_g?: number | null;
  length?: string | null;
  width?: string | null;
  height?: string | null;
  shipment_value?: number | null;
  base_fare?: number | null;
  platform_fee?: number | null;
  consumer_platform_fee?: number | null;
  prayog_commission?: number | null;
  gst?: number | null;
  packaging_amount?: number | null;
  insurance_amount?: number | null;
  payment_status?: string | null;
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

// Real per-booking financial breakdown sourced from DB columns.
// IMPORTANT: base_fare in DB already includes the platform markup
// (baseFare = round(cardPrice * 3) + 50, see src/lib/pricing.ts).
// So Partner Payable (what we owe the courier) = base_fare - platform_fee,
// NOT base_fare itself. Otherwise platform_fee gets double-counted and
// partner + platform + gst exceeds the total customer paid.
const breakdownOf = (b: Booking) => {
  const total = num(b.courier_price);
  const platformRevenue = num(b.platform_fee);
  const flatPlatformFee = num(b.consumer_platform_fee);
  const gst = num(b.gst);
  const packaging = num(b.packaging_amount);
  const insurance = num(b.insurance_amount);
  const baseFare = num(b.base_fare);
  // Card price (true partner cost) is base_fare minus the embedded platform fee.
  // Fallback when base_fare is missing: derive from total.
  const partnerPayable = baseFare > 0
    ? Math.max(0, baseFare - platformRevenue)
    : Math.max(0, total - platformRevenue - gst - packaging - insurance);

  if (total > 0) {
    const sum = partnerPayable + platformRevenue + gst + packaging + insurance;
    if (Math.abs(sum - total) > 1) {
      // eslint-disable-next-line no-console
      console.warn(
        `[reconcile] booking ${b.id} split mismatch: ${sum} vs total ${total}`,
        { partnerPayable, platformRevenue, gst, packaging, insurance, total },
      );
    }
  }

  return { total, platformRevenue, flatPlatformFee, gst, packaging, insurance, partnerPayable };
};

const RevenueManagement = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("today");
  const { toast } = useToast();

  useEffect(() => {
    fetchBookings();
  }, []);

  // Debounced realtime refresh — avoids re-pulling all rows on every write.
  useRealtimeTable("bookings", () => fetchBookings(), {
    channelName: "admin-revenue",
    debounceMs: 2500,
  });

  const fetchBookings = async () => {
    try {
      setLoading(true);
      // Wide column set so the Excel export has everything it needs.
      const cols =
        "id,tracking_id,prayog_order_id,prayog_awb,payment_id,refund_id,booking_source,courier_name,courier_price,status,created_at,sender_name,sender_city,sender_state,sender_pincode,receiver_name,receiver_city,receiver_state,receiver_pincode,goods_type,package_weight,chargeable_weight_g,length,width,height,shipment_value,base_fare,platform_fee,consumer_platform_fee,prayog_commission,gst,packaging_amount,insurance_amount,payment_status";
      const { data, error } = await supabase
        .from("bookings")
        .select(cols)
        .order("created_at", { ascending: false })
        .limit(2000);

      if (error) throw error;
      setBookings((data as unknown as Booking[]) || []);
    } catch (error: any) {
      toast({
        title: "Error fetching data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Pull every booking (paged) for the lifetime accounts export.
  const fetchAllBookings = async (): Promise<Booking[]> => {
    const cols =
      "id,tracking_id,prayog_order_id,prayog_awb,payment_id,refund_id,booking_source,courier_name,courier_price,status,created_at,sender_name,sender_city,sender_state,sender_pincode,receiver_name,receiver_city,receiver_state,receiver_pincode,goods_type,package_weight,chargeable_weight_g,length,width,height,shipment_value,base_fare,platform_fee,consumer_platform_fee,prayog_commission,gst,packaging_amount,insurance_amount,payment_status";
    const pageSize = 1000;
    let from = 0;
    const all: Booking[] = [];
    // hard ceiling so a runaway loop can't hang the browser
    for (let i = 0; i < 200; i++) {
      const { data, error } = await supabase
        .from("bookings")
        .select(cols)
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const batch = (data as unknown as Booking[]) || [];
      all.push(...batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }
    return all;
  };

  const getFilteredBookings = () => {
    if (dateRange === "all") return bookings;
    const now = new Date();
    let startDate: Date;
    switch (dateRange) {
      case "today": startDate = startOfDay(now); break;
      case "week": startDate = startOfWeek(now); break;
      case "month": startDate = startOfMonth(now); break;
      case "year": startDate = subMonths(now, 12); break;
      default: startDate = startOfDay(now);
    }
    return bookings.filter(b => new Date(b.created_at) >= startDate);
  };

  const filteredBookings = getFilteredBookings();

  // Revenue recognition (shared rule — see src/lib/revenue.ts):
  // only payment_status='paid' contributes to collections, platform
  // revenue and partner payable. COP and refunded orders are tracked
  // separately so admins can see them without inflating totals.
  const copBookings = filteredBookings.filter(b => isCopPending(b.payment_status));
  const refundedBookings = filteredBookings.filter(b => isRefunded(b.payment_status));
  const collectedBookings = filteredBookings.filter(b => isCollected(b.payment_status));

  const sumBy = (rows: Booking[], pick: (k: ReturnType<typeof breakdownOf>) => number) =>
    rows.reduce((acc, b) => acc + pick(breakdownOf(b)), 0);

  const totalCollections = sumBy(collectedBookings, k => k.total);
  const partnerPayableTotal = sumBy(collectedBookings, k => k.partnerPayable);
  const platformRevenueTotal = sumBy(collectedBookings, k => k.platformRevenue);
  const gstCollected = sumBy(collectedBookings, k => k.gst);
  const copPendingTotal = sumBy(copBookings, k => k.total);
  const refundedTotal = sumBy(refundedBookings, k => k.total);

  const completedOrdersCount = filteredBookings.filter(b => bucketOfStatus(b.status) === "delivered").length;

  const revenueStats = [
    {
      title: "Total Collections",
      value: `₹${totalCollections.toLocaleString()}`,
      change: `${collectedBookings.length} paid orders`,
      icon: IndianRupee,
      color: "text-green-600",
    },
    {
      title: "Completed Orders",
      value: completedOrdersCount.toLocaleString(),
      change: "Delivered in this period",
      icon: CheckCircle,
      color: "text-emerald-600",
    },
    {
      title: "Pending COP Collection",
      value: `₹${copPendingTotal.toLocaleString()}`,
      change: `${copBookings.length} cash-on-pickup orders`,
      icon: IndianRupee,
      color: "text-yellow-600",
    },
    {
      title: "Refunded",
      value: `₹${refundedTotal.toLocaleString()}`,
      change: `${refundedBookings.length} orders refunded`,
      icon: RefreshCw,
      color: "text-red-600",
    },
    {
      title: "Amount Payable to Partners",
      value: `₹${partnerPayableTotal.toLocaleString()}`,
      change: "Owed to courier partners (paid orders)",
      icon: Truck,
      color: "text-purple-600",
    },
    {
      title: "Platform Revenue",
      value: `₹${platformRevenueTotal.toLocaleString()}`,
      change: "Net to Viasetu",
      icon: Percent,
      color: "text-blue-600",
    },
    {
      title: "GST Collected",
      value: `₹${gstCollected.toLocaleString()}`,
      change: "18% GST",
      icon: TrendingUp,
      color: "text-orange-600",
    },
  ];

  // Monthly revenue using real columns
  const getMonthlyData = () => {
    const monthlyMap = new Map<
      string,
      { revenue: number; orders: number; partner: number; platform: number; gst: number }
    >();
    bookings.forEach(b => {
      if (!isCollected(b.payment_status)) return;
      const k = breakdownOf(b);
      const monthKey = format(new Date(b.created_at), "MMM yyyy");
      const existing = monthlyMap.get(monthKey) || { revenue: 0, orders: 0, partner: 0, platform: 0, gst: 0 };
      monthlyMap.set(monthKey, {
        revenue: existing.revenue + k.total,
        orders: existing.orders + 1,
        partner: existing.partner + k.partnerPayable,
        platform: existing.platform + k.platformRevenue,
        gst: existing.gst + k.gst,
      });
    });
    return Array.from(monthlyMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .slice(0, 6);
  };

  const monthlyData = getMonthlyData();

  // Period-wide breakdown shares for the Price Breakdown tab
  const periodTotals = {
    partner: sumBy(collectedBookings, k => k.partnerPayable),
    platform: sumBy(collectedBookings, k => k.platformRevenue),
    gst: sumBy(collectedBookings, k => k.gst),
    packaging: sumBy(collectedBookings, k => k.packaging),
    insurance: sumBy(collectedBookings, k => k.insurance),
  };
  const periodGrand = totalCollections || 1;
  const pct = (n: number) => `${((n / periodGrand) * 100).toFixed(1)}%`;

  const handleExportCsv = () => {
    const headers = [
      "Order ID", "Date", "Courier", "Total",
      "Partner Payable", "Platform Revenue", "Platform Fee (flat)", "GST", "Packaging", "Insurance", "Status",
    ];
    const rows = filteredBookings.map(b => {
      const k = breakdownOf(b);
      return [
        b.tracking_id || b.id.slice(0, 8),
        format(new Date(b.created_at), "dd/MM/yyyy"),
        b.courier_name,
        k.total, k.partnerPayable, k.platformRevenue, k.flatPlatformFee, k.gst, k.packaging, k.insurance,
        b.status || "pending",
      ].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revenue-report-${dateRange}.csv`;
    a.click();
    toast({ title: "Report exported successfully" });
  };

  const [exporting, setExporting] = useState(false);
  const rangeLabel = (() => {
    switch (dateRange) {
      case "today": return "Today";
      case "week": return "This Week";
      case "month": return "This Month";
      case "year": return "This Year";
      case "all": return "All Time";
      default: return dateRange;
    }
  })();

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      // For "All Time" we page through every booking so historical orders
      // beyond the 2000-row in-memory cache are all included.
      const source: Booking[] = dateRange === "all"
        ? await fetchAllBookings()
        : filteredBookings;
      if (source.length === 0) {
        toast({ title: "Nothing to export", description: "No bookings in this range." });
        return;
      }
      downloadAccountsWorkbook(source as ExportBooking[], { rangeLabel });
      toast({
        title: "Accounts report ready",
        description: `${source.length} orders exported to Excel.`,
      });
    } catch (e: any) {
      toast({
        title: "Export failed",
        description: e?.message || "Could not generate Excel report.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case "delivered": return "default";
      case "pending": return "secondary";
      case "in_transit": return "outline";
      default: return "secondary";
    }
  };

  // Lifetime aggregates for the analytics tab
  const lifetimeCollected = bookings.filter(b => isCollected(b.payment_status));
  const lifetimeRevenue = sumBy(lifetimeCollected, k => k.total);
  const lifetimePlatform = sumBy(lifetimeCollected, k => k.platformRevenue);
  const lifetimePartner = sumBy(lifetimeCollected, k => k.partnerPayable);
  const lifetimeAvg = lifetimeCollected.length > 0 ? Math.round(lifetimeRevenue / lifetimeCollected.length) : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Revenue & Commission Tracking</h2>
          <p className="text-muted-foreground">Live financials sourced from each booking</p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="all">All Time (Till Date)</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchBookings}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={exporting}>
                <Download className={`h-4 w-4 mr-2 ${exporting ? "animate-pulse" : ""}`} />
                {exporting ? "Exporting…" : "Export"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onClick={handleExportExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                <div className="flex flex-col">
                  <span className="font-medium">Excel — Accounts Report</span>
                  <span className="text-xs text-muted-foreground">
                    Line items + GST split for bookkeeping
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCsv}>
                <FileText className="h-4 w-4 mr-2" />
                <div className="flex flex-col">
                  <span className="font-medium">CSV — Quick Export</span>
                  <span className="text-xs text-muted-foreground">
                    Basic columns for spreadsheets
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Revenue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {revenueStats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "..." : stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transactions">Transaction Details</TabsTrigger>
          <TabsTrigger value="breakdown">Price Breakdown</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Reports</TabsTrigger>
          <TabsTrigger value="analytics">Revenue Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>All Transactions</CardTitle>
              <CardDescription>Real per-booking values from each order</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : filteredBookings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No transactions found</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Courier</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Partner Payable</TableHead>
                        <TableHead>Platform Revenue</TableHead>
                        <TableHead>GST</TableHead>
                        <TableHead>Packaging</TableHead>
                        <TableHead>Insurance</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBookings.map((booking) => {
                        const k = breakdownOf(booking);
                        return (
                          <TableRow key={booking.id}>
                            <TableCell className="font-medium">
                              {booking.tracking_id || booking.id.slice(0, 8)}
                            </TableCell>
                            <TableCell>{format(new Date(booking.created_at), "dd MMM yyyy")}</TableCell>
                            <TableCell>{booking.courier_name}</TableCell>
                            <TableCell className="font-medium">₹{k.total.toLocaleString()}</TableCell>
                            <TableCell className="text-purple-600">₹{k.partnerPayable.toLocaleString()}</TableCell>
                            <TableCell className="text-blue-600">₹{k.platformRevenue.toLocaleString()}</TableCell>
                            <TableCell className="text-orange-600">₹{k.gst.toLocaleString()}</TableCell>
                            <TableCell>₹{k.packaging.toLocaleString()}</TableCell>
                            <TableCell>₹{k.insurance.toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge variant={getStatusColor(booking.status)}>
                                {booking.status || "Pending"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown">
          <Card>
            <CardHeader>
              <CardTitle>Price Breakdown ({dateRange})</CardTitle>
              <CardDescription>Where collected revenue actually went</CardDescription>
            </CardHeader>
            <CardContent>
              {totalCollections === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No collected revenue in this period
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg">Distribution</h3>
                    <div className="flex justify-between items-center p-4 border rounded-lg bg-purple-50">
                      <div>
                        <p className="font-medium text-purple-700">Partner Payable</p>
                        <p className="text-sm text-muted-foreground">Owed to courier partners</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">₹{periodTotals.partner.toLocaleString()}</p>
                        <Badge variant="outline">{pct(periodTotals.partner)}</Badge>
                      </div>
                    </div>
                    <div className="flex justify-between items-center p-4 border rounded-lg bg-blue-50">
                      <div>
                        <p className="font-medium text-blue-700">Platform Revenue</p>
                        <p className="text-sm text-muted-foreground">Net to Viasetu</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">₹{periodTotals.platform.toLocaleString()}</p>
                        <Badge variant="outline">{pct(periodTotals.platform)}</Badge>
                      </div>
                    </div>
                    <div className="flex justify-between items-center p-4 border rounded-lg bg-orange-50">
                      <div>
                        <p className="font-medium text-orange-700">GST (18%)</p>
                        <p className="text-sm text-muted-foreground">Government tax</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">₹{periodTotals.gst.toLocaleString()}</p>
                        <Badge variant="outline">{pct(periodTotals.gst)}</Badge>
                      </div>
                    </div>
                    <div className="flex justify-between items-center p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">Packaging</p>
                        <p className="text-sm text-muted-foreground">Optional add-on</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">₹{periodTotals.packaging.toLocaleString()}</p>
                        <Badge variant="outline">{pct(periodTotals.packaging)}</Badge>
                      </div>
                    </div>
                    <div className="flex justify-between items-center p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">Insurance</p>
                        <p className="text-sm text-muted-foreground">Optional add-on</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">₹{periodTotals.insurance.toLocaleString()}</p>
                        <Badge variant="outline">{pct(periodTotals.insurance)}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg">Period Totals</h3>
                    <Card className="bg-muted">
                      <CardContent className="pt-6 space-y-2">
                        <div className="flex justify-between">
                          <span>Total Collections</span>
                          <span className="font-medium">₹{totalCollections.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-purple-600">
                          <span>− Payable to Partners</span>
                          <span className="font-medium">₹{periodTotals.partner.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-orange-600">
                          <span>− GST (passes through)</span>
                          <span className="font-medium">₹{periodTotals.gst.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>− Packaging / Insurance</span>
                          <span className="font-medium">
                            ₹{(periodTotals.packaging + periodTotals.insurance).toLocaleString()}
                          </span>
                        </div>
                        <div className="border-t pt-2 flex justify-between font-bold text-blue-700">
                          <span>= Platform Revenue</span>
                          <span>₹{periodTotals.platform.toLocaleString()}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Revenue Reports</CardTitle>
              <CardDescription>Historical revenue trends</CardDescription>
            </CardHeader>
            <CardContent>
              {monthlyData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No data available</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Total Orders</TableHead>
                      <TableHead>Total Revenue</TableHead>
                      <TableHead>Partner Payable</TableHead>
                      <TableHead>Platform Revenue</TableHead>
                      <TableHead>GST</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyData.map((data, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{data.month}</TableCell>
                        <TableCell>{data.orders}</TableCell>
                        <TableCell className="font-medium">₹{data.revenue.toLocaleString()}</TableCell>
                        <TableCell className="text-purple-600">₹{data.partner.toLocaleString()}</TableCell>
                        <TableCell className="text-blue-600">₹{data.platform.toLocaleString()}</TableCell>
                        <TableCell className="text-orange-600">₹{data.gst.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Summary</CardTitle>
                <CardDescription>Lifetime financial health</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Total Lifetime Revenue</p>
                    <p className="text-sm text-muted-foreground">{lifetimeCollected.length} paid orders</p>
                  </div>
                  <p className="text-2xl font-bold text-primary">
                    ₹{lifetimeRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Total Platform Revenue</p>
                    <p className="text-sm text-muted-foreground">Net to Viasetu</p>
                  </div>
                  <p className="text-xl font-bold text-blue-600">
                    ₹{lifetimePlatform.toLocaleString()}
                  </p>
                </div>
                <div className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Total Payable to Partners</p>
                    <p className="text-sm text-muted-foreground">Owed to couriers</p>
                  </div>
                  <p className="text-xl font-bold text-purple-600">
                    ₹{lifetimePartner.toLocaleString()}
                  </p>
                </div>
                <div className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Average Order Value</p>
                    <p className="text-sm text-muted-foreground">Per booking</p>
                  </div>
                  <p className="text-xl font-bold">₹{lifetimeAvg.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Couriers by Revenue</CardTitle>
                <CardDescription>Best performing courier partners</CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const courierMap = new Map<string, { revenue: number; orders: number; partner: number }>();
                  lifetimeCollected.forEach(b => {
                    const k = breakdownOf(b);
                    const existing = courierMap.get(b.courier_name) || { revenue: 0, orders: 0, partner: 0 };
                    courierMap.set(b.courier_name, {
                      revenue: existing.revenue + k.total,
                      orders: existing.orders + 1,
                      partner: existing.partner + k.partnerPayable,
                    });
                  });
                  const topCouriers = Array.from(courierMap.entries())
                    .map(([name, data]) => ({ name, ...data }))
                    .sort((a, b) => b.revenue - a.revenue)
                    .slice(0, 5);

                  return topCouriers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No data</div>
                  ) : (
                    <div className="space-y-3">
                      {topCouriers.map((courier, index) => (
                        <div key={courier.name} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium">{courier.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {courier.orders} orders · ₹{courier.partner.toLocaleString()} payable
                              </p>
                            </div>
                          </div>
                          <p className="font-bold">₹{courier.revenue.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RevenueManagement;
