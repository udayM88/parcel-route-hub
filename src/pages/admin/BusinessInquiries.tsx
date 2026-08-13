import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Mail, Phone, Building2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Inquiry = {
  id: string;
  name: string;
  company_name: string;
  email: string;
  phone: string;
  business_type: string;
  monthly_volume: string;
  status: string;
  notes: string | null;
  created_at: string;
};

const STATUSES = ["new", "contacted", "qualified", "converted", "closed"];

const statusVariant = (s: string): "default" | "secondary" | "outline" =>
  s === "new" ? "default" : s === "converted" ? "secondary" : "outline";

export default function BusinessInquiries() {
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("business_inquiries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setRows((data || []) as Inquiry[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("business_inquiries").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status } : x)));
    toast.success("Status updated");
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.name, r.company_name, r.email, r.phone, r.business_type].some((v) =>
        String(v || "").toLowerCase().includes(q),
      );
    });
  }, [rows, search, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Business Inquiries</h1>
          <p className="text-sm text-muted-foreground">Leads submitted from the For Business page.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input placeholder="Search name, company, email or phone…" value={search}
               onChange={(e) => setSearch(e.target.value)} className="sm:max-w-sm" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-48"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">No inquiries found.</Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.name}</span>
                    <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                    <Badge variant="outline">{r.monthly_volume} / month</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{r.company_name}</span>
                    <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 hover:underline"><Mail className="h-3.5 w-3.5" />{r.email}</a>
                    <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 hover:underline"><Phone className="h-3.5 w-3.5" />{r.phone}</a>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.business_type} · {new Date(r.created_at).toLocaleString("en-IN")}
                  </div>
                </div>
                <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v)}>
                  <SelectTrigger className="w-full lg:w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
