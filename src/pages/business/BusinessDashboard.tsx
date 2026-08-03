import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Package, IndianRupee, Boxes, LogOut, Plus } from "lucide-react";
import { useBusinessAuth } from "@/contexts/useBusinessAuth";
import PageSeo from "@/components/PageSeo";

type BusinessBooking = {
  id: string;
  created_at: string;
  receiver_city: string | null;
  receiver_pincode: string | null;
  courier_name: string | null;
  courier_price: number | null;
  box_count: number | null;
  status: string | null;
  tracking_id: string | null;
};

const BusinessDashboard = () => {
  const navigate = useNavigate();
  const { business } = useBusinessAuth();
  const [bookings, setBookings] = useState<BusinessBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!business) return;
      setLoading(true);
      const { data } = await supabase
        .from("bookings")
        .select("id,created_at,receiver_city,receiver_pincode,courier_name,courier_price,box_count,status,tracking_id")
        .eq("business_account_id", business.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setBookings((data ?? []) as BusinessBooking[]);
      setLoading(false);
    };
    load();
  }, [business]);

  const stats = useMemo(() => {
    const totalBoxes = bookings.reduce((sum, b) => sum + (b.box_count || 1), 0);
    const totalSpend = bookings.reduce((sum, b) => sum + Number(b.courier_price || 0), 0);
    return { shipments: bookings.length, totalBoxes, totalSpend };
  }, [bookings]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/viasetuforbusinesses");
  };

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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Shipments</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{stats.shipments}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Boxes Shipped</CardTitle>
              <Boxes className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{stats.totalBoxes}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">₹{Math.round(stats.totalSpend)}</p></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Shipments</CardTitle>
            <CardDescription>Business rate: courier price + ₹15 per box, all inclusive.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading...</p>
            ) : bookings.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No shipments yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Courier</TableHead>
                      <TableHead className="text-center">Boxes</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((b) => (
                      <TableRow key={b.id} className="cursor-pointer" onClick={() => navigate(`/order/${b.id}`)}>
                        <TableCell>{new Date(b.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>{b.receiver_city || "—"} {b.receiver_pincode}</TableCell>
                        <TableCell>{b.courier_name || "—"}</TableCell>
                        <TableCell className="text-center">{b.box_count || 1}</TableCell>
                        <TableCell className="text-right">₹{Math.round(Number(b.courier_price || 0))}</TableCell>
                        <TableCell><Badge variant="secondary">{b.status || "created"}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default BusinessDashboard;
