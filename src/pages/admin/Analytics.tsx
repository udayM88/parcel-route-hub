import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, TrendingUp, Users, Package, Clock, MapPin, Download, IndianRupee, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { format, startOfDay, startOfWeek, startOfMonth, subMonths, subDays } from "date-fns";
import { isBookedOrder, isCollected } from "@/lib/revenue";
import { bucketOfStatus } from "@/lib/booking-status";

interface Booking {
  id: string;
  courier_name: string;
  courier_price: number;
  platform_fee: number | null;
  payment_status: string | null;
  status: string | null;
  created_at: string;
  sender_city: string;
  receiver_city: string;
  delivery_time: string;
  urgency: string;
}

const Analytics = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("month");
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  useRealtimeTable(["bookings", "profiles"], () => fetchData(), { channelName: "admin-analytics", debounceMs: 2500 });

  const fetchData = async () => {
    try {
      setLoading(true);
      // Narrow column projection — Analytics only uses these columns.
      const cols = "id,courier_name,courier_price,platform_fee,payment_status,status,created_at,sender_city,receiver_city,delivery_time,urgency";
      const [bookingsRes, profilesRes] = await Promise.all([
        supabase.from("bookings").select(cols).order("created_at", { ascending: false }).limit(2000),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);

      if (bookingsRes.error) throw bookingsRes.error;
      setBookings((bookingsRes.data as Booking[]) || []);
      setUserCount(profilesRes.count || 0);
    } catch (error: any) {
      toast({ title: "Error loading analytics", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getFilteredBookings = () => {
    const now = new Date();
    let startDate: Date;
    switch (dateRange) {
      case "today": startDate = startOfDay(now); break;
      case "week": startDate = startOfWeek(now); break;
      case "month": startDate = startOfMonth(now); break;
      case "quarter": startDate = subMonths(now, 3); break;
      default: startDate = startOfMonth(now);
    }
    return bookings.filter(b => new Date(b.created_at) >= startDate);
  };

  const filtered = getFilteredBookings();
  // Revenue recognition (shared rule — see src/lib/revenue.ts + RevenueManagement):
  // Only payment_status='paid' rows contribute to collected revenue and platform
  // commission. Delivered/completed counts use bucketOfStatus so partner API
  // status strings (DELIVERED, delivered, Delivered_to_customer, …) all match.
  const collected = filtered.filter(b => isCollected(b.payment_status));
  const totalRevenue = collected.reduce((sum, b) => sum + (Number(b.courier_price) || 0), 0);
  const deliveredCount = filtered.filter(b => bucketOfStatus(b.status) === "delivered").length;
  const completionRate = filtered.length > 0 ? Math.round((deliveredCount / filtered.length) * 100) : 0;
  const avgOrderValue = collected.length > 0 ? Math.round(totalRevenue / collected.length) : 0;
  // Real platform revenue from the platform_fee column (paid orders only) —
  // matches AdminDashboard "Platform Revenue" and RevenueManagement.
  const platformCommission = collected.reduce((sum, b) => sum + (Number(b.platform_fee) || 0), 0);
  const pendingOrdersCount = filtered.filter(b => {
    const bucket = bucketOfStatus(b.status);
    return bucket === "created" || bucket === "confirmed";
  }).length;

  // Compare with previous period
  const getPreviousPeriodBookings = () => {
    const now = new Date();
    let startDate: Date, endDate: Date;
    switch (dateRange) {
      case "today": startDate = subDays(now, 2); endDate = subDays(now, 1); break;
      case "week": startDate = subDays(startOfWeek(now), 7); endDate = startOfWeek(now); break;
      case "month": startDate = subMonths(startOfMonth(now), 1); endDate = startOfMonth(now); break;
      case "quarter": startDate = subMonths(now, 6); endDate = subMonths(now, 3); break;
      default: startDate = subMonths(startOfMonth(now), 1); endDate = startOfMonth(now);
    }
    return bookings.filter(b => {
      const d = new Date(b.created_at);
      return d >= startDate && d < endDate;
    });
  };

  const prevPeriod = getPreviousPeriodBookings();
  const prevRevenue = prevPeriod
    .filter(b => isCollected(b.payment_status))
    .reduce((sum, b) => sum + (Number(b.courier_price) || 0), 0);
  const revenueChange = prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : 0;
  const orderChange = prevPeriod.length > 0 ? Math.round(((filtered.length - prevPeriod.length) / prevPeriod.length) * 100) : 0;

  // Courier partner analytics — revenue only from collected (paid) bookings,
  // delivered count uses shared status bucket so it matches OrderMonitoring.
  const courierStats = () => {
    const map = new Map<string, { orders: number; revenue: number; delivered: number }>();
    filtered.forEach(b => {
      const existing = map.get(b.courier_name) || { orders: 0, revenue: 0, delivered: 0 };
      map.set(b.courier_name, {
        orders: existing.orders + 1,
        revenue: existing.revenue + (isCollected(b.payment_status) ? (Number(b.courier_price) || 0) : 0),
        delivered: existing.delivered + (bucketOfStatus(b.status) === "delivered" ? 1 : 0),
      });
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data, successRate: data.orders > 0 ? Math.round((data.delivered / data.orders) * 100) : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
  };

  // City/route analytics — revenue restricted to collected (paid) bookings.
  const cityStats = () => {
    const map = new Map<string, { orders: number; revenue: number }>();
    filtered.forEach(b => {
      const route = `${b.sender_city} → ${b.receiver_city}`;
      const existing = map.get(route) || { orders: 0, revenue: 0 };
      map.set(route, {
        orders: existing.orders + 1,
        revenue: existing.revenue + (isCollected(b.payment_status) ? (Number(b.courier_price) || 0) : 0),
      });
    });
    return Array.from(map.entries())
      .map(([route, data]) => ({ route, ...data }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 10);
  };

  // Time-based analytics — revenue restricted to collected (paid) bookings.
  const timeStats = () => {
    const slots: Record<string, { orders: number; revenue: number }> = {
      "6 AM - 10 AM": { orders: 0, revenue: 0 },
      "10 AM - 2 PM": { orders: 0, revenue: 0 },
      "2 PM - 6 PM": { orders: 0, revenue: 0 },
      "6 PM - 10 PM": { orders: 0, revenue: 0 },
      "10 PM - 6 AM": { orders: 0, revenue: 0 },
    };
    filtered.forEach(b => {
      const hour = new Date(b.created_at).getHours();
      let slot: string;
      if (hour >= 6 && hour < 10) slot = "6 AM - 10 AM";
      else if (hour >= 10 && hour < 14) slot = "10 AM - 2 PM";
      else if (hour >= 14 && hour < 18) slot = "2 PM - 6 PM";
      else if (hour >= 18 && hour < 22) slot = "6 PM - 10 PM";
      else slot = "10 PM - 6 AM";
      slots[slot].orders += 1;
      slots[slot].revenue += (isCollected(b.payment_status) ? (Number(b.courier_price) || 0) : 0);
    });
    return Object.entries(slots).map(([time, data]) => ({ time, ...data }));
  };


  const getDemandLevel = (orders: number, maxOrders: number) => {
    const pct = maxOrders > 0 ? orders / maxOrders : 0;
    if (pct > 0.7) return "Very High";
    if (pct > 0.4) return "High";
    if (pct > 0.15) return "Medium";
    return "Low";
  };

  const getDemandColor = (demand: string) => {
    switch (demand) {
      case "Very High": return "destructive";
      case "High": return "default";
      case "Medium": return "secondary";
      default: return "outline";
    }
  };

  const kpiStats = [
    { title: "Orders", value: filtered.length.toString(), change: `${orderChange >= 0 ? '+' : ''}${orderChange}%`, icon: Package, color: "text-blue-600" },
    { title: "Completion Rate", value: `${completionRate}%`, change: `${deliveredCount} delivered`, icon: Clock, color: "text-green-600" },
    { title: "Active Users", value: userCount.toString(), change: "Total registered", icon: Users, color: "text-purple-600" },
    { title: "Revenue Growth", value: `${revenueChange >= 0 ? '+' : ''}${revenueChange}%`, change: `₹${totalRevenue.toLocaleString()} total`, icon: TrendingUp, color: "text-orange-600" },
  ];

  const handleExportReport = () => {
    const headers = ["Order ID", "Date", "Route", "Courier", "Amount", "Status"];
    const rows = filtered.map(b => [
      b.id.slice(0, 8), format(new Date(b.created_at), "dd/MM/yyyy"),
      `${b.sender_city}-${b.receiver_city}`, b.courier_name,
      b.courier_price, b.status || "pending"
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `analytics-${dateRange}.csv`; a.click();
    toast({ title: "Report exported successfully" });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics & Insights</h2>
          <p className="text-muted-foreground">Comprehensive platform analytics from real data</p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" onClick={handleExportReport}>
            <Download className="h-4 w-4 mr-2" />Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiStats.map((stat) => (
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

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance KPIs</TabsTrigger>
          <TabsTrigger value="partners">Courier Analytics</TabsTrigger>
          <TabsTrigger value="geographic">Route Analysis</TabsTrigger>
          <TabsTrigger value="time">Time-based Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="performance">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Metrics</CardTitle>
                <CardDescription>Current period performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-4 border rounded">
                  <div><p className="font-medium">Total Orders</p><p className="text-2xl font-bold">{filtered.length}</p></div>
                  <Badge variant={orderChange >= 0 ? "default" : "destructive"}>{orderChange >= 0 ? '+' : ''}{orderChange}%</Badge>
                </div>
                <div className="flex justify-between items-center p-4 border rounded">
                  <div><p className="font-medium">Completion Rate</p><p className="text-2xl font-bold">{completionRate}%</p></div>
                  <Badge variant="default">{deliveredCount} delivered</Badge>
                </div>
                <div className="flex justify-between items-center p-4 border rounded">
                  <div><p className="font-medium">Pending Orders</p><p className="text-2xl font-bold">{pendingOrdersCount}</p></div>
                  <Badge variant="secondary">Needs attention</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Metrics</CardTitle>
                <CardDescription>Financial performance indicators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-4 border rounded">
                  <div><p className="font-medium">Total Revenue</p><p className="text-2xl font-bold">₹{totalRevenue.toLocaleString()}</p></div>
                  <Badge variant={revenueChange >= 0 ? "default" : "destructive"}>{revenueChange >= 0 ? '+' : ''}{revenueChange}%</Badge>
                </div>
                <div className="flex justify-between items-center p-4 border rounded">
                  <div><p className="font-medium">Average Order Value</p><p className="text-2xl font-bold">₹{avgOrderValue.toLocaleString()}</p></div>
                  <Badge variant="secondary">Per booking</Badge>
                </div>
                <div className="flex justify-between items-center p-4 border rounded">
                  <div><p className="font-medium">Platform Revenue</p><p className="text-2xl font-bold">₹{platformCommission.toLocaleString()}</p></div>
                  <Badge variant="default">Net to Viasetu</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="partners">
          <Card>
            <CardHeader>
              <CardTitle>Courier Partner Performance</CardTitle>
              <CardDescription>Rankings based on actual booking data</CardDescription>
            </CardHeader>
            <CardContent>
              {courierStats().length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No data for this period</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Courier</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Success Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courierStats().map((c, i) => (
                      <TableRow key={c.name}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.orders}</TableCell>
                        <TableCell>₹{c.revenue.toLocaleString()}</TableCell>
                        <TableCell><Badge variant={c.successRate > 80 ? "default" : "secondary"}>{c.successRate}%</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="geographic">
          <Card>
            <CardHeader>
              <CardTitle>Top Routes by Volume</CardTitle>
              <CardDescription>Most popular shipping routes from real bookings</CardDescription>
            </CardHeader>
            <CardContent>
              {cityStats().length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No data for this period</div>
              ) : (
                <div className="space-y-4">
                  {(() => {
                    const routes = cityStats();
                    const maxOrders = routes[0]?.orders || 1;
                    return routes.map((route, i) => (
                      <div key={i} className="flex items-center justify-between p-4 border rounded">
                        <div className="flex items-center gap-4">
                          <MapPin className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{route.route}</p>
                            <p className="text-sm text-muted-foreground">₹{route.revenue.toLocaleString()} revenue</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-medium">{route.orders} orders</p>
                            <Badge variant={getDemandColor(getDemandLevel(route.orders, maxOrders))}>
                              {getDemandLevel(route.orders, maxOrders)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="time">
          <Card>
            <CardHeader>
              <CardTitle>Time-based Order Analysis</CardTitle>
              <CardDescription>When orders are placed, based on real data</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const times = timeStats();
                const maxOrders = Math.max(...times.map(t => t.orders), 1);
                return (
                  <div className="space-y-4">
                    {times.map((slot, i) => (
                      <div key={i} className="flex items-center justify-between p-4 border rounded">
                        <div className="flex items-center gap-4">
                          <Clock className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{slot.time}</p>
                            <p className="text-sm text-muted-foreground">₹{slot.revenue.toLocaleString()} revenue</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-medium">{slot.orders} orders</p>
                            <Badge variant={getDemandColor(getDemandLevel(slot.orders, maxOrders))}>
                              {getDemandLevel(slot.orders, maxOrders)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Analytics;
